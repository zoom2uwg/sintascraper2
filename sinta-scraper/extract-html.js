#!/usr/bin/env node
/**
 * Offline HTML extractor: parse one or more saved SINTA pages or a directory tree.
 * Usage: node extract-html.js [file-or-directory ...] [--export] [--out DIR]
 */
const fs = require('fs');
const path = require('path');
const { extractPageData } = require('./src/parsers');
const { exportAllFormats } = require('./src/exporter');
const { parseCliArgs } = require('./src/config');

const DEFAULT_GROUNDTRUTH_FILES = [
  '../SINTA - Science and Technology Index-Affiliation.html',
  '../SINTA - Science and Technology Index-DepartmentProfile.html',
  '../SINTA - Science and Technology Index-AuthorResearch.html',
  '../SINTA - Science and Technology Index-AuthorsProfile.html',
];
const VALUE_FLAGS = new Set(['out']);

function positionalArgs(argv) {
  const targets = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      targets.push(arg);
      continue;
    }
    const key = arg.slice(2).split('=', 1)[0];
    if (!arg.includes('=') && VALUE_FLAGS.has(key) && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      i++;
    }
  }
  return targets;
}

function collectHtmlFiles(targets) {
  const files = [];
  const seen = new Set();
  const walk = (target) => {
    if (!fs.existsSync(target)) return;
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target).sort()) walk(path.join(target, entry));
    } else if (/\.html?$/i.test(target)) {
      const absolute = path.resolve(target);
      if (!seen.has(absolute)) {
        seen.add(absolute);
        files.push(absolute);
      }
    }
  };
  targets.forEach((target) => walk(path.resolve(__dirname, target)));
  return files;
}

async function main(argv = process.argv.slice(2)) {
  const flags = parseCliArgs(argv);
  const targets = positionalArgs(argv).length ? positionalArgs(argv) : DEFAULT_GROUNDTRUTH_FILES;
  const files = collectHtmlFiles(targets);
  if (!files.length) {
    throw new Error(`Tidak ada file HTML yang ditemukan. Target: ${targets.join(', ')}`);
  }

  const bundle = {
    affiliation: null,
    affiliationDepartments: [],
    departmentProfiles: [],
    authors: [],
    items: [],
    contentTables: [],
    paginationAudit: [],
  };
  const summaries = [];

  for (const filePath of files) {
    const data = extractPageData(fs.readFileSync(filePath, 'utf8'));
    const recordCount = data.items.length || data.departments.length || data.authors.length;
    summaries.push({
      file: path.basename(filePath),
      pageType: data.pageType,
      url: data.url,
      loggedInAs: data.session.accountName,
      entityName: data.header.name,
      activeView: data.activeView,
      availableViews: data.navigation.availableViews,
      scores: data.scores,
      summaryMatrix: data.summaryMatrix,
      pagination: {
        currentPage: data.pagination.currentPage,
        totalPages: data.pagination.totalPages,
        totalRecords: data.pagination.totalRecords,
        hasNext: data.pagination.hasNext,
        nextUrl: data.pagination.nextUrl,
      },
      extractedCounts: {
        items: data.items.length,
        departments: data.departments.length,
        authors: data.authors.length,
        contentTables: data.contentTables.length,
      },
    });

    if (data.pageType === 'affiliation_profile' || data.pageType === 'affiliation_departments') {
      bundle.affiliation = data;
      bundle.affiliationDepartments.push(...data.departments);
    } else if (data.pageType === 'department_profile') {
      bundle.departmentProfiles.push(data);
    } else if (data.pageType === 'author_profile') {
      const h = data.header;
      bundle.authors.push({
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
        scores: data.scores,
        summaryMatrix: data.summaryMatrix,
        charts: data.charts,
        profile_url: h.url,
        avatar_url: h.imageUrl,
      });
    } else if (data.pageType === 'department_authors' || data.pageType === 'affiliation_authors') {
      bundle.authors.push(...data.authors);
    }

    bundle.items.push(...data.items);
    bundle.contentTables.push(...data.contentTables);
    bundle.paginationAudit.push({
      scope: path.basename(filePath),
      view: data.activeView || data.pageType,
      pagesScraped: 1,
      reportedTotalPages: data.pagination.reportedTotalPages,
      effectiveTotalPages: data.pagination.totalPages,
      reportedTotalRecords: data.pagination.totalRecords,
      extractedCount: recordCount,
      isComplete:
        data.pagination.totalPages <= 1 &&
        (data.pagination.totalRecords == null || recordCount >= data.pagination.totalRecords),
      emptyVerified: data.pagination.totalRecords === 0 && recordCount === 0,
      warnings:
        data.pagination.totalPages > 1
          ? [`OFFLINE_SINGLE_FILE: Snapshot indicates ${data.pagination.totalPages} pages; provide snapshots for every page to complete offline extraction.`]
          : [],
      startUrl: data.url,
    });
  }

  console.log(JSON.stringify(summaries, null, 2));
  if (flags.export) {
    const outputDir = path.resolve(__dirname, flags.out || './data');
    const result = await exportAllFormats(bundle, {
      baseDir: outputDir,
      dataDir: path.join(outputDir, 'data'),
    });
    console.log('\nExport berhasil dibuat:', result.files);
  }
  return { summaries, bundle };
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Gagal mengekstrak HTML:', err.message);
    process.exit(1);
  });
}

module.exports = { collectHtmlFiles, positionalArgs, main };
