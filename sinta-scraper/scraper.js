const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { loadConfig } = require('./src/config');
const { authenticateSinta } = require('./src/auth');
const { navigateWithRetry, scrapePaginatedEndpoint, politeDelay } = require('./src/navigator');
const { extractPageData } = require('./src/parsers');
const { crawlPaginatedPages } = require('./src/pagination');
const { exportAllFormats } = require('./src/exporter');

/**
 * Merge configured views with views dynamically discovered from `nav.profile-nav` and `ul.article-tab`
 * (including hidden `.d-none` tabs such as `wos`).
 */
function resolveViewsToScrape(configuredViews, navigation, discoverViews = true) {
  const ordered = [];
  const add = (v) => {
    const clean = String(v || '').trim().toLowerCase();
    if (clean && clean !== 'articles' && !ordered.includes(clean)) {
      ordered.push(clean);
    }
  };
  (configuredViews || []).forEach(add);
  if (discoverViews && navigation && Array.isArray(navigation.availableViews)) {
    navigation.availableViews.forEach(add);
  }
  return ordered;
}

/**
 * Process local HTML files/directories offline (without launching browser) and export all formats.
 */
async function runOfflineHtmlExtraction(targetPath, cfg) {
  const resolved = path.resolve(process.cwd(), targetPath);
  const htmlFiles = [];

  if (fs.statSync(resolved).isDirectory()) {
    for (const entry of fs.readdirSync(resolved)) {
      if (entry.toLowerCase().endsWith('.html') || entry.toLowerCase().endsWith('.htm')) {
        htmlFiles.push(path.join(resolved, entry));
      }
    }
  } else {
    htmlFiles.push(resolved);
  }

  let affiliation = null;
  const affiliationDepartments = [];
  const departmentProfiles = [];
  const authors = [];
  const items = [];
  const contentTables = [];
  const paginationAudit = [];

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const pageData = extractPageData(html);

    if (pageData.pageType === 'affiliation_profile' || pageData.pageType === 'affiliation_departments') {
      if (!affiliation || pageData.pageType === 'affiliation_profile') {
        affiliation = pageData;
      }
      affiliationDepartments.push(...(pageData.departments || []));
    } else if (pageData.pageType === 'department_profile') {
      departmentProfiles.push(pageData);
    } else if (pageData.pageType === 'author_profile') {
      const h = pageData.header;
      authors.push({
        sinta_id: h.sintaId,
        name: h.name,
        nama: h.name,
        is_verified: h.isVerified,
        nidn: h.nidn,
        affiliation: h.affiliation,
        study_program: h.department?.name || null,
        code_prodi: h.department?.codeProdi || null,
        department: h.department,
        subjects: h.subjects,
        scores: pageData.scores,
        summaryMatrix: pageData.summaryMatrix,
        charts: pageData.charts,
        profile_url: h.url,
        avatar_url: h.imageUrl,
      });
    } else if (pageData.pageType === 'department_authors' || pageData.pageType === 'affiliation_authors') {
      authors.push(...(pageData.authors || []));
    }

    items.push(...(pageData.items || []));
    contentTables.push(...(pageData.contentTables || []));

    paginationAudit.push({
      scope: path.basename(file),
      view: pageData.activeView || pageData.pageType,
      pagesScraped: 1,
      reportedTotalPages: pageData.pagination.reportedTotalPages,
      effectiveTotalPages: pageData.pagination.totalPages,
      reportedTotalRecords: pageData.pagination.totalRecords,
      extractedCount:
        pageData.items.length || pageData.departments.length || pageData.authors.length,
      isComplete:
        pageData.pagination.totalPages <= 1 &&
        (pageData.pagination.totalRecords == null ||
          (pageData.items.length || pageData.departments.length || pageData.authors.length) >=
            pageData.pagination.totalRecords),
      emptyVerified:
        pageData.pagination.totalRecords === 0 &&
        pageData.items.length === 0 &&
        pageData.departments.length === 0,
      warnings:
        pageData.pagination.totalPages > 1
          ? [`OFFLINE_SINGLE_FILE: Snapshot indicates ${pageData.pagination.totalPages} total pages`]
          : [],
      startUrl: pageData.url,
    });
  }

  return exportAllFormats(
    {
      affiliation,
      affiliationDepartments,
      departmentProfiles,
      authors,
      items,
      contentTables,
      paginationAudit,
    },
    { dataDir: cfg.outputDir }
  );
}

/**
 * Main SINTAScraper orchestrator:
 * 1. Authenticates & maintains active session guard
 * 2. Extracts Affiliation Profile + full paginated Departments Index
 * 3. Extracts each Department's Profile, Scores, Stat Tables, ECharts, and ALL views across ALL pagination pages
 * 4. Extracts each Department's paginated Authors list, then each Author's full Profile & ALL sub-views across ALL pagination pages
 * 5. Deduplicates and exports to multi-sheet XLSX, UTF-8 BOM CSV, standalone interactive HTML, and JSON/Borang files
 */
async function runScraper(customArgv) {
  const cfg = loadConfig(customArgv);

  if (cfg.cli['offline-html']) {
    console.log(`[OFFLINE] Mengekstrak informasi dari file/direktori HTML lokal: ${cfg.cli['offline-html']}`);
    const result = await runOfflineHtmlExtraction(cfg.cli['offline-html'], cfg);
    console.log(
      `[SELESAI] Total ${result.uniqueItemsCount} item unik & ${result.uniqueAuthorsCount} dosen diekspor ke:`,
      result.files
    );
    return result;
  }

  console.log('==========================================================');
  console.log(' Starting SINTAScraper (Full Page Info + Pagination Mode) ');
  console.log('==========================================================');
  console.log('Browser:', cfg.chromeExecutablePath || 'Default Puppeteer Chromium');

  const launchOptions = {
    headless: cfg.headless ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  };
  if (cfg.chromeExecutablePath) {
    launchOptions.executablePath = cfg.chromeExecutablePath;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 860 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7' });

  let affiliationProfile = null;
  const affiliationDepartments = [];
  const departmentProfiles = [];
  const allAuthorsMap = new Map(); // sinta_id/url -> author record
  const processedAuthorKeys = new Set();
  const allExtractedItems = [];
  const allContentTables = [];
  const paginationAudit = [];
  let authState = null;
  const checkpointPath = path.join(cfg.outputDir, 'checkpoint.json');
  let checkpoint = { version: 1, completed: {} };
  if (cfg.resume && fs.existsSync(checkpointPath)) {
    try {
      checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
      if (!checkpoint.completed || typeof checkpoint.completed !== 'object') checkpoint.completed = {};
      console.log(`[RESUME] Memuat ${Object.keys(checkpoint.completed).length} endpoint dari checkpoint.`);
    } catch (err) {
      console.warn(`[RESUME] Checkpoint tidak valid, memulai dari awal: ${err.message}`);
      checkpoint = { version: 1, completed: {} };
    }
  }

  const saveCheckpoint = () => {
    fs.mkdirSync(cfg.outputDir, { recursive: true });
    const temporaryPath = `${checkpointPath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(checkpoint), 'utf8');
    fs.renameSync(temporaryPath, checkpointPath);
  };

  const crawlEndpoint = async (url, options) => {
    const key = `${options.scopeSlug || 'general'}::${options.view || 'index'}::${url}`;
    if (cfg.resume && checkpoint.completed[key]) {
      console.log(`[RESUME] Menggunakan hasil tersimpan: ${options.label || key}`);
      return checkpoint.completed[key];
    }
    const result = await scrapePaginatedEndpoint(page, url, {
      ...options,
      cfg,
      authState,
    });
    checkpoint.completed[key] = result;
    saveCheckpoint();
    return result;
  };

  const registerAuthorCandidate = (aut, deptMeta = null) => {
    const key = aut.sinta_id ? `id:${aut.sinta_id}` : aut.profile_url || aut.url;
    if (!key) return;
    if (!allAuthorsMap.has(key)) {
      allAuthorsMap.set(key, {
        ...aut,
        name: aut.name || aut.nama || null,
        nama: aut.nama || aut.name || null,
        profile_url: aut.profile_url || aut.url || null,
        dept_ids: deptMeta?.id ? [deptMeta.id] : [],
      });
    } else if (deptMeta?.id) {
      const existing = allAuthorsMap.get(key);
      if (!existing.dept_ids.includes(deptMeta.id)) {
        existing.dept_ids.push(deptMeta.id);
      }
    }
  };

  try {
    // --- STEP 0: Authentication ---
    authState = await authenticateSinta(page, cfg);

    // --- STEP 1: Affiliation Profile & Paginated Departments Index ---
    if (!cfg.skipAffiliation) {
      console.log(`\n=== [1/4] Scraping Affiliation Profile: ${cfg.affiliationUrl} ===`);
      try {
        const affilRes = await navigateWithRetry(page, cfg.affiliationUrl, cfg, authState);
        affiliationProfile = extractPageData(affilRes.html, {
          currentUrl: affilRes.finalUrl,
          entityType: 'Affiliation',
        });
        console.log(
          `  Afiliasi: ${affiliationProfile.header.name || cfg.affiliationName} | Scores:`,
          affiliationProfile.scores
        );
        await politeDelay(cfg.navDelayMs);

        console.log(`  Scraping Paginated Affiliation Departments: ${cfg.affiliationDepartmentsUrl}`);
        const deptIndexCrawl = await crawlEndpoint(
          cfg.affiliationDepartmentsUrl,
          {
            cfg,
            authState,
            scopeSlug: `affil_${cfg.affiliationId}_departments`,
            label: 'Affiliation Depts',
          }
        );

        if (!affiliationProfile.charts?.topDepartments && deptIndexCrawl.firstPage?.charts?.topDepartments) {
          affiliationProfile.charts.topDepartments = deptIndexCrawl.firstPage.charts.topDepartments;
        }

        affiliationDepartments.push(...deptIndexCrawl.departments);
        paginationAudit.push({
          scope: `Affiliation:${cfg.affiliationId}:Departments`,
          ...deptIndexCrawl.paginationSummary,
        });
        console.log(
          `  Total departemen pada afiliasi terekstrak: ${affiliationDepartments.length} prodi (${deptIndexCrawl.paginationSummary.pagesScraped} halaman)`
        );
      } catch (err) {
        console.warn(`[WARN] Gagal mengambil data afiliasi: ${err.message}`);
      }
    }

    // --- STEP 2: Target Departments (Header + All Views with Pagination) ---
    console.log(`\n=== [2/4] Scraping ${cfg.departments.length} Target Departments ===`);
    for (const dept of cfg.departments) {
      const deptBaseUrl = (dept.canonicalUrl || dept.url || '').replace(/\/+$/, '');
      const deptSlug = dept.slug || dept.codeProdi || dept.name.toLowerCase().replace(/\s+/g, '-');
      console.log(`\n--- Department: ${dept.name} (${dept.codeProdi || dept.id}) ---`);

      // Seed preview authors from affiliation index if matching prodi exists
      const indexedMatch = affiliationDepartments.find(
        (d) =>
          (dept.id && d.id && d.id.toLowerCase() === dept.id.toLowerCase()) ||
          (dept.codeProdi && d.code_prodi === String(dept.codeProdi))
      );
      if (indexedMatch && Array.isArray(indexedMatch.preview_authors)) {
        indexedMatch.preview_authors.forEach((pa) => registerAuthorCandidate(pa, dept));
      }

      if (!cfg.skipDeptViews) {
        // First crawl initial view to capture full Department Profile + discover dynamic tabs
        const initialView = cfg.views[0] || 'scopus';
        console.log(`  Scraping Dept View [${initialView}] (with pagination): ${deptBaseUrl}/?view=${initialView}`);
        const firstViewCrawl = await crawlEndpoint(deptBaseUrl, {
          cfg,
          authState,
          view: initialView,
          scopeSlug: `dept_${deptSlug}`,
          label: `${dept.name}:${initialView}`,
          context: {
            entityType: 'Department',
            entityName: dept.name,
            deptId: dept.id,
            deptName: dept.name,
            deptSlug,
          },
        });

        const deptProfilePage = firstViewCrawl.firstPage;
        departmentProfiles.push(deptProfilePage);
        allExtractedItems.push(...firstViewCrawl.items);
        if (deptProfilePage.contentTables?.length) {
          allContentTables.push(
            ...deptProfilePage.contentTables.map((t) => ({
              scope: `Department:${dept.name}`,
              view: initialView,
              ...t,
            }))
          );
        }
        paginationAudit.push({
          scope: `Department:${dept.name}`,
          ...firstViewCrawl.paginationSummary,
        });

        const viewsToCrawl = resolveViewsToScrape(
          cfg.views,
          deptProfilePage.navigation,
          cfg.discoverViews
        ).filter((v) => v !== initialView);

        for (const view of viewsToCrawl) {
          console.log(`  Scraping Dept View [${view}] (with pagination): ${deptBaseUrl}/?view=${view}`);
          try {
            const viewCrawl = await crawlEndpoint(deptBaseUrl, {
              cfg,
              authState,
              view,
              scopeSlug: `dept_${deptSlug}`,
              label: `${dept.name}:${view}`,
              context: {
                entityType: 'Department',
                entityName: dept.name,
                deptId: dept.id,
                deptName: dept.name,
                deptSlug,
              },
            });

            allExtractedItems.push(...viewCrawl.items);
            if (viewCrawl.firstPage?.contentTables?.length) {
              allContentTables.push(
                ...viewCrawl.firstPage.contentTables.map((t) => ({
                  scope: `Department:${dept.name}`,
                  view,
                  ...t,
                }))
              );
            }
            paginationAudit.push({
              scope: `Department:${dept.name}`,
              ...viewCrawl.paginationSummary,
            });
          } catch (err) {
            console.warn(`  [WARN] Gagal scrape view ${view} pada ${dept.name}: ${err.message}`);
          }
        }
      }

      // --- STEP 3: Paginated Department Authors List ---
      if (!cfg.skipAuthors && dept.authorsUrl) {
        console.log(`  Scraping Paginated Authors List for ${dept.name}: ${dept.authorsUrl}`);
        try {
          const authListCrawl = await crawlEndpoint(dept.authorsUrl, {
            cfg,
            authState,
            scopeSlug: `dept_${deptSlug}_authors`,
            label: `${dept.name}:Authors`,
          });

          authListCrawl.authors.forEach((a) => registerAuthorCandidate(a, dept));
          paginationAudit.push({
            scope: `Department:${dept.name}:AuthorsList`,
            ...authListCrawl.paginationSummary,
          });
          console.log(
            `  Ditemukan ${authListCrawl.authors.length} dosen pada ${dept.name} (${authListCrawl.paginationSummary.pagesScraped} halaman)`
          );
        } catch (err) {
          console.warn(`  [WARN] Gagal mengambil daftar dosen ${dept.name}: ${err.message}`);
        }
      }
    }

    // --- STEP 4: Individual Author Profiles & All Sub-Views (with Pagination) ---
    if (!cfg.skipAuthors && allAuthorsMap.size > 0) {
      console.log(`\n=== [3/4] Scraping ${allAuthorsMap.size} Unique Author Profiles & Sub-Views ===`);
      for (const [authorKey, authorEntry] of allAuthorsMap.entries()) {
        if (processedAuthorKeys.has(authorKey)) continue;
        processedAuthorKeys.add(authorKey);

        const authorBaseUrl = (
          authorEntry.profile_url ||
          (authorEntry.sinta_id
            ? `${cfg.sintaBase}/authors/profile/${authorEntry.sinta_id}`
            : '')
        ).replace(/\/+$/, '');
        if (!authorBaseUrl) continue;

        console.log(
          `\n--- Author: ${authorEntry.name || authorEntry.sinta_id} (${authorBaseUrl}) ---`
        );

        try {
          const initialView = cfg.views[0] || 'scopus';
          const firstAuthCrawl = await crawlEndpoint(authorBaseUrl, {
            cfg,
            authState,
            view: initialView,
            scopeSlug: `author_${authorEntry.sinta_id || 'unknown'}`,
            label: `Author:${authorEntry.sinta_id || authorEntry.name}:${initialView}`,
            context: {
              entityType: 'Author',
              entityName: authorEntry.name,
              authorId: authorEntry.sinta_id,
              authorName: authorEntry.name,
            },
          });

          const ap = firstAuthCrawl.firstPage;
          const h = ap.header || {};

          // Enrich stored author profile with full header, scores, H-index matrix, subjects & charts
          allAuthorsMap.set(authorKey, {
            ...authorEntry,
            sinta_id: h.sintaId || authorEntry.sinta_id || null,
            name: h.name || authorEntry.name || null,
            nama: h.name || authorEntry.nama || authorEntry.name || null,
            is_verified: h.isVerified ?? authorEntry.is_verified ?? false,
            nidn: h.nidn || authorEntry.nidn || null,
            affiliation: h.affiliation || authorEntry.affiliation || null,
            study_program: h.department?.name || authorEntry.department || null,
            code_prodi: h.department?.codeProdi || null,
            department: h.department || authorEntry.department || null,
            subjects: h.subjects?.length ? h.subjects : authorEntry.subjects || [],
            scores: ap.scores || {},
            summaryMatrix: ap.summaryMatrix || null,
            charts: ap.charts || null,
            profile_url: h.url || authorBaseUrl,
            avatar_url: h.imageUrl || authorEntry.avatar_url || null,
          });

          allExtractedItems.push(...firstAuthCrawl.items);
          if (ap.contentTables?.length) {
            allContentTables.push(
              ...ap.contentTables.map((t) => ({
                scope: `Author:${h.name || authorEntry.sinta_id}`,
                view: initialView,
                ...t,
              }))
            );
          }
          paginationAudit.push({
            scope: `Author:${h.name || authorEntry.sinta_id}`,
            ...firstAuthCrawl.paginationSummary,
          });

          const authorViews = resolveViewsToScrape(
            cfg.views,
            ap.navigation,
            cfg.discoverViews
          ).filter((v) => v !== initialView);

          for (const view of authorViews) {
            try {
              const subCrawl = await crawlEndpoint(authorBaseUrl, {
                cfg,
                authState,
                view,
                scopeSlug: `author_${h.sintaId || authorEntry.sinta_id || 'unknown'}`,
                label: `Author:${h.sintaId || authorEntry.name}:${view}`,
                context: {
                  entityType: 'Author',
                  entityName: h.name || authorEntry.name,
                  authorId: h.sintaId || authorEntry.sinta_id,
                  authorName: h.name || authorEntry.name,
                  deptName: h.department?.name || null,
                },
              });

              allExtractedItems.push(...subCrawl.items);
              if (subCrawl.firstPage?.contentTables?.length) {
                allContentTables.push(
                  ...subCrawl.firstPage.contentTables.map((t) => ({
                    scope: `Author:${h.name || authorEntry.sinta_id}`,
                    view,
                    ...t,
                  }))
                );
              }
              paginationAudit.push({
                scope: `Author:${h.name || authorEntry.sinta_id}`,
                ...subCrawl.paginationSummary,
              });
            } catch (err) {
              console.warn(
                `  [WARN] Gagal scrape author view ${view} (${authorBaseUrl}): ${err.message}`
              );
            }
          }
        } catch (err) {
          console.warn(`[WARN] Gagal memproses profil dosen ${authorBaseUrl}: ${err.message}`);
        }
      }
    }

    // --- STEP 5: Export All Formats ---
    console.log(
      `\n=== [4/4] Exporting Dataset (${allExtractedItems.length} raw records collected) ===`
    );
    const exportResult = await exportAllFormats(
      {
        affiliation: affiliationProfile,
        affiliationDepartments,
        departmentProfiles,
        authors: [...allAuthorsMap.values()],
        items: allExtractedItems,
        contentTables: allContentTables,
        paginationAudit,
      },
      { dataDir: cfg.outputDir }
    );

    console.log(
      `\nSelesai! ${exportResult.uniqueItemsCount} item unik & ${exportResult.uniqueAuthorsCount} profil dosen berhasil diekspor:`
    );
    console.log(`  - Excel : ${exportResult.files.xlsx}`);
    console.log(`  - CSV   : ${exportResult.files.csv}`);
    console.log(`  - HTML  : ${exportResult.files.html}`);
    console.log(`  - JSON  : ${exportResult.files.dataDir}`);

    return exportResult;
  } catch (err) {
    console.error('An error occurred during scraping:', err);
    throw err;
  } finally {
    await browser.close();
    console.log('Browser closed. Process finished.');
  }
}

if (require.main === module) {
  runScraper().catch(() => process.exit(1));
}

module.exports = {
  runScraper,
  runOfflineHtmlExtraction,
  resolveViewsToScrape,
  extractPageData,
  crawlPaginatedPages,
  exportAllFormats,
};
