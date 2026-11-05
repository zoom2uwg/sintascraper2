const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cheerio = require('cheerio');
const ExcelJS = require('exceljs');

const {
  buildPaginatedUrl,
  parsePagination,
  crawlPaginatedPages,
} = require('../src/pagination');
const { exportAllFormats } = require('../src/exporter');

/**
 * Helper to synthesize realistic SINTA paginated HTML pages.
 */
function buildMockSintaPage({
  baseUrl,
  view = 'scopus',
  page = 1,
  totalPages = 4,
  totalRecords = 35,
  items = [],
  includePaginationText = true,
  slidingWindowMax = null,
}) {
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  const prevHref = prevDisabled
    ? `${baseUrl}?page=&view=${view}`
    : `${baseUrl}?page=${page - 1}&view=${view}`;
  const nextHref = nextDisabled
    ? `${baseUrl}?page=&view=${view}`
    : `${baseUrl}?page=${page + 1}&view=${view}`;

  const maxShown = slidingWindowMax ? Math.min(totalPages, slidingWindowMax) : totalPages;
  const pageLis = [];
  for (let p = 1; p <= maxShown; p++) {
    pageLis.push(
      `<li class="page-item ${p === page ? 'active' : ''}"><a class="page-link" href="${baseUrl}?page=${p}&view=${view}">${p}</a></li>`
    );
  }
  if (slidingWindowMax && totalPages > slidingWindowMax) {
    pageLis.push(
      `<li class="page-item"><a class="page-link" href="${baseUrl}?page=${totalPages}&view=${view}">Last</a></li>`
    );
  }

  const cardsHtml = items
    .map(
      (it) => `
      <div class="ar-list-item mb-5">
        <div class="ar-title">
          <a href="https://www.scopus.com/record/display.uri?eid=${it.eid}&origin=resultslist" target="_blank">${it.title}</a>
        </div>
        <div class="ar-meta">
          <a class="ar-quartile" href="#!">${it.quartile || 'Q2 Journal'}</a>
          <a class="ar-pub" href="https://www.scopus.com/sourceid/12345" target="_blank">${it.journal || 'Journal of Computing'}</a>
          <a href="#!">Author Order : 1 of 3</a>
          <a href="#!">Creator : ${it.creator || 'Doe J.'}</a>
        </div>
        <div class="ar-meta">
          <a class="ar-year" href="#!">${it.year || 2025}</a>
          <a class="ar-cited" href="#!">${it.cited ?? 4} cited</a>
        </div>
      </div>`
    )
    .join('\n');

  return `
    <html>
      <body>
        <nav class="navbar">
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#">SYAHRONI</a>
            <a class="dropdown-item" href="https://sinta.kemdiktisaintek.go.id/logins/logout">Logout</a>
          </li>
        </nav>
        <div class="content-box">
          <div class="univ-profile">
            <div class="univ-name">
              <h3><a href="${baseUrl}">Teknik Informatika</a></h3>
              <div class="meta-profile">
                <a href="https://sinta.kemdiktisaintek.go.id/affiliations/profile/2058">UNIVERSITAS WIDYA GAMA</a>
                <a class="affil-code" href="#!">CODE PRODI : 55201 CODE PT : 071030</a>
              </div>
            </div>
          </div>
          <div class="profile-article">
            ${cardsHtml}
            <nav aria-label="pagination-sample" class="mb-4 mt-2">
              <ul class="pagination justify-content-center">
                <li class="page-item ${prevDisabled ? 'disabled' : ''}">
                  <a class="page-link" href="${prevHref}" ${prevDisabled ? 'aria-disabled="true"' : ''}>Previous</a>
                </li>
                ${pageLis.join('\n')}
                <li class="page-item ${nextDisabled ? 'disabled' : ''}">
                  <a class="page-link" href="${nextHref}" ${nextDisabled ? 'aria-disabled="true"' : ''}>Next</a>
                </li>
              </ul>
              ${
                includePaginationText
                  ? `<div class="text-center pagination-text"><small>Page ${page} of ${totalPages} | Total Records ${totalRecords}</small></div>`
                  : ''
              }
            </nav>
          </div>
        </div>
      </body>
    </html>
  `;
}

test('buildPaginatedUrl preserves query parameters (view, q, sort) and strips #! hashes', () => {
  const url1 = buildPaginatedUrl(
    'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/abc/def/?view=researches#!',
    3
  );
  assert.equal(
    url1,
    'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/abc/def/?page=3&view=researches'
  );

  const url2 = buildPaginatedUrl(
    'https://sinta.kemdiktisaintek.go.id/affiliations/departments/2058/071030?page=1&q=sistem&sort=1',
    2
  );
  assert.equal(
    url2,
    'https://sinta.kemdiktisaintek.go.id/affiliations/departments/2058/071030?page=2&q=sistem&sort=1'
  );
});

test('parsePagination handles sliding-window Last link and formatted thousand separators', () => {
  const html = `
    <nav aria-label="pagination-sample">
      <ul class="pagination">
        <li class="page-item disabled"><a class="page-link" href="?page=&view=googlescholar">Previous</a></li>
        <li class="page-item active"><a class="page-link" href="?page=1&view=googlescholar">1</a></li>
        <li class="page-item"><a class="page-link" href="?page=2&view=googlescholar">2</a></li>
        <li class="page-item"><a class="page-link" href="?page=3&view=googlescholar">3</a></li>
        <li class="page-item"><a class="page-link" href="?page=2&view=googlescholar">Next</a></li>
        <li class="page-item"><a class="page-link" href="?page=125&view=googlescholar">Last</a></li>
      </ul>
      <div class="pagination-text"><small>Page 1 of 125 | Total Records 1,248</small></div>
    </nav>
  `;
  const $ = cheerio.load(html);
  const pag = parsePagination(
    $,
    'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/p/d/?view=googlescholar'
  );

  assert.equal(pag.currentPage, 1);
  assert.equal(pag.totalPages, 125);
  assert.equal(pag.totalRecords, 1248);
  assert.equal(pag.hasPrev, false);
  assert.equal(pag.hasNext, true);
  assert.equal(
    pag.nextUrl,
    'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/p/d/?page=2&view=googlescholar'
  );
  assert.equal(
    pag.lastUrl,
    'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/p/d/?page=125&view=googlescholar'
  );
  assert.equal(pag.allPageUrls.length, 125);
});

test('crawlPaginatedPages crawls all 4 pages (35 records) and verifies completeness', async () => {
  const baseUrl =
    'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/8A894EDC-B2F1-4575-95B8-91EB1E708F4F/';

  // Generate 35 records split across 4 pages (10, 10, 10, 5)
  const pagesData = [[], [], [], []];
  for (let i = 1; i <= 35; i++) {
    const bucket = Math.floor((i - 1) / 10);
    pagesData[bucket].push({
      eid: `2-s2.0-1000${i}`,
      title: `Paper Number ${i} on Deep Learning`,
      year: 2020 + (i % 6),
      cited: i,
    });
  }

  const requestedPages = [];
  const result = await crawlPaginatedPages({
    startUrl: baseUrl,
    view: 'scopus',
    fetchPageHtml: async (url, pageNum) => {
      requestedPages.push(pageNum);
      return {
        html: buildMockSintaPage({
          baseUrl,
          view: 'scopus',
          page: pageNum,
          totalPages: 4,
          totalRecords: 35,
          items: pagesData[pageNum - 1],
          slidingWindowMax: 3,
        }),
        finalUrl: url,
      };
    },
  });

  assert.deepEqual(requestedPages, [1, 2, 3, 4]);
  assert.equal(result.items.length, 35);
  assert.equal(result.paginationSummary.pagesScraped, 4);
  assert.equal(result.paginationSummary.reportedTotalRecords, 35);
  assert.equal(result.paginationSummary.extractedCount, 35);
  assert.equal(result.paginationSummary.isComplete, true);
  assert.equal(result.paginationSummary.warnings.length, 0);

  // Check page attribution on first & last items
  assert.equal(result.items[0].page, 1);
  assert.equal(result.items[34].page, 4);
  assert.equal(result.items[34].scopus_eid, '2-s2.0-100035');

  const capped = await crawlPaginatedPages({
    startUrl: baseUrl,
    view: 'scopus',
    maxPages: 2,
    fetchPageHtml: async (url, pageNum) => ({
      html: buildMockSintaPage({
        baseUrl,
        view: 'scopus',
        page: pageNum,
        totalPages: 4,
        totalRecords: 35,
        items: pagesData[pageNum - 1],
        slidingWindowMax: 3,
      }),
      finalUrl: url,
    }),
  });
  assert.equal(capped.paginationSummary.pagesScraped, 2);
  assert.equal(capped.paginationSummary.isComplete, false);
});

test('crawlPaginatedPages follows Next links even when .pagination-text is absent', async () => {
  const baseUrl = 'https://sinta.kemdiktisaintek.go.id/authors/profile/259792/';
  const perPage = [
    [{ eid: '2-s2.0-A1', title: 'First Page Doc' }],
    [{ eid: '2-s2.0-A2', title: 'Second Page Doc' }],
    [{ eid: '2-s2.0-A3', title: 'Third Page Doc' }],
  ];

  const result = await crawlPaginatedPages({
    startUrl: baseUrl,
    view: 'scopus',
    fetchPageHtml: async (url, pageNum) => ({
      html: buildMockSintaPage({
        baseUrl,
        view: 'scopus',
        page: pageNum,
        totalPages: 3,
        totalRecords: 3,
        items: perPage[pageNum - 1],
        includePaginationText: false,
      }),
      finalUrl: url,
    }),
  });

  assert.equal(result.items.length, 3);
  assert.equal(result.paginationSummary.pagesScraped, 3);
});

test('crawlPaginatedPages crawls multi-page Department Authors directory (.au-item)', async () => {
  const authorsBase =
    'https://sinta.kemdiktisaintek.go.id/departments/authors/2058/420D8E73-68F0-4044-86CF-5138D1419B20/8A894EDC-B2F1-4575-95B8-91EB1E708F4F';

  const makeAuthorPage = (pageNum) => {
    const startId = (pageNum - 1) * 2 + 1;
    return `
      <html><body><div class="content-box">
        <div class="au-item">
          <div class="profile-name"><a href="https://sinta.kemdiktisaintek.go.id/authors/profile/100${startId}">Dosen ${startId}</a></div>
          <div class="profile-hindex"><span class="profile-id">SINTA Score Overall : ${500 + startId}</span></div>
        </div>
        <div class="au-item">
          <div class="profile-name"><a href="https://sinta.kemdiktisaintek.go.id/authors/profile/100${startId + 1}">Dosen ${startId + 1}</a></div>
          <div class="profile-hindex"><span class="profile-id">SINTA Score Overall : ${500 + startId + 1}</span></div>
        </div>
        <nav aria-label="pagination-sample">
          <ul class="pagination">
            <li class="page-item ${pageNum === 1 ? 'disabled' : ''}"><a class="page-link" href="${authorsBase}?page=${pageNum > 1 ? pageNum - 1 : ''}">Previous</a></li>
            <li class="page-item ${pageNum === 1 ? 'active' : ''}"><a class="page-link" href="${authorsBase}?page=1">1</a></li>
            <li class="page-item ${pageNum === 2 ? 'active' : ''}"><a class="page-link" href="${authorsBase}?page=2">2</a></li>
            <li class="page-item ${pageNum === 2 ? 'disabled' : ''}"><a class="page-link" href="${authorsBase}?page=${pageNum < 2 ? pageNum + 1 : ''}">Next</a></li>
          </ul>
          <div class="pagination-text"><small>Page ${pageNum} of 2 | Total Records 4</small></div>
        </nav>
      </div></body></html>
    `;
  };

  const result = await crawlPaginatedPages({
    startUrl: authorsBase,
    fetchPageHtml: async (url, pageNum) => ({ html: makeAuthorPage(pageNum), finalUrl: url }),
  });

  assert.equal(result.authors.length, 4);
  assert.equal(result.authors[0].sinta_id, 1001);
  assert.equal(result.authors[0].sinta_score_overall, 501);
  assert.equal(result.authors[3].sinta_id, 1004);
  assert.equal(result.paginationSummary.pagesScraped, 2);
  assert.equal(result.paginationSummary.isComplete, true);
});

test('crawlPaginatedPages handles duplicate-page guard, empty view, and login-gated View more', async () => {
  const baseUrl = 'https://sinta.kemdiktisaintek.go.id/authors/profile/259792/';

  // 1. Server ignores ?page=2 and returns identical items -> stops cleanly with DUPLICATE_PAGE_CONTENT
  const dupRes = await crawlPaginatedPages({
    startUrl: baseUrl,
    view: 'scopus',
    fetchPageHtml: async (url, pageNum) => ({
      html: buildMockSintaPage({
        baseUrl,
        view: 'scopus',
        page: pageNum,
        totalPages: 5,
        totalRecords: 50,
        items: [{ eid: '2-s2.0-SAME', title: 'Identical Paper' }],
      }),
      finalUrl: url,
    }),
  });
  assert.equal(dupRes.items.length, 1);
  assert.ok(dupRes.paginationSummary.warnings.some((w) => w.includes('DUPLICATE_PAGE_CONTENT')));

  // 2. Empty 0-record view
  const emptyRes = await crawlPaginatedPages({
    startUrl: baseUrl,
    view: 'wos',
    fetchPageHtml: async (url) => ({
      html: `<html><body><div class="content-box"><div class="pagination-text"><small>Page 1 of 0 | Total Records 0</small></div></div></body></html>`,
      finalUrl: url,
    }),
  });
  assert.equal(emptyRes.items.length, 0);
  assert.equal(emptyRes.paginationSummary.emptyVerified, true);
  assert.equal(emptyRes.paginationSummary.pagesScraped, 1);

  // 3. Anonymous View more requiring login
  const anonRes = await crawlPaginatedPages({
    startUrl: baseUrl,
    view: 'googlescholar',
    fetchPageHtml: async (url) => ({
      html: `<html><body><div class="content-box"><div class="profile-article">
        <div class="ar-list-item"><div class="ar-title"><a href="#!">Sample Paper</a></div></div>
        <a class="btn btn-primary" href="https://sinta.kemdiktisaintek.go.id/logins">View more articles</a>
      </div></div></body></html>`,
      finalUrl: url,
    }),
  });
  assert.equal(anonRes.paginationSummary.truncatedByAuth, true);
  assert.ok(anonRes.paginationSummary.warnings.some((w) => w.includes('ANONYMOUS_TRUNCATED')));
});

test('exportAllFormats writes multi-sheet XLSX, UTF-8 BOM CSV, standalone HTML & Borang JSONs', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sinta-export-test-'));

  try {
    const res = await exportAllFormats(
      {
        affiliation: {
          header: {
            name: 'Universitas Widya Gama',
            affiliation: { id: '2058', code: '071030', abbreviation: 'UWG', location: 'Malang' },
          },
          charts: { topDepartments: { ranked: [{ department: 'Teknik Informatika (S1)', score_3yr: 2799 }] } },
        },
        affiliationDepartments: [
          { id: '895FD91B', code_prodi: '59201', level: 'S1', name: 'STI', preview_authors: [] },
        ],
        departmentProfiles: [
          {
            header: { name: 'Bisnis Digital', department: { codeProdi: '61209', id: 'BB930200' } },
            statCounts: { authors: 4 },
            scores: { overall: 439, three_year: 218 },
            summaryMatrix: { scopus: { article: 2, citation: 4 } },
            charts: { quartilePie: { distribution: { Q3: 1, 'No-Q': 1 } } },
          },
        ],
        authors: [
          {
            sinta_id: 259792,
            name: 'Syahroni Wahyu Iriananda',
            is_verified: true,
            study_program: 'Teknik Informatika',
            scores: { overall: 474, three_year: 190 },
            summaryMatrix: { scopus: { article: 1, citation: 0, h_index: 0 } },
            profile_url: 'https://sinta.kemdiktisaintek.go.id/authors/profile/259792',
          },
        ],
        items: [
          {
            dedup_key: 'scopus:2-s2.0-105029558167',
            view: 'scopus',
            page: 1,
            title: 'Speech Emotion Recognition',
            year: 2025,
            quartile: 'no-Q',
            journal: 'ICITRI',
            scopus_eid: '2-s2.0-105029558167',
            creator: 'Nugroho K.S.',
            cited: 0,
            detail_url: 'https://www.scopus.com/record/display.uri?eid=2-s2.0-105029558167',
            sinta_source_url: 'https://sinta.kemdiktisaintek.go.id/authors/profile/259792?page=1&view=scopus',
          },
          {
            dedup_key: 'researches:abc123',
            view: 'researches',
            page: 2,
            title: 'Riset IndoBERT',
            year: 2026,
            leader: 'Syahroni Wahyu Iriananda',
            scheme: 'PENELITIAN HIBAH INSTITUSI ( PERINTIS )',
            members: [{ sinta_id: 6738705, nama: 'Hanif Rani Iswari' }],
            personil_names: ['Hanif Rani Iswari'],
            personil_ids: [6738705],
            fund_rp: 'Rp. 4.000.000',
            fund_amount: 4000000,
            status: 'Approved',
            source: 'INTERNAL SOURCE',
          },
        ],
        contentTables: [
          {
            caption: 'Summary Metrics',
            columns: ['Metric', 'Value'],
            objects: [{ Metric: 'Articles', Value: '4' }],
          },
        ],
        paginationAudit: [
          {
            scope: 'Author:259792',
            view: 'researches',
            pagesScraped: 2,
            reportedTotalPages: 2,
            reportedTotalRecords: 11,
            extractedCount: 11,
            isComplete: true,
            warnings: [],
          },
        ],
      },
      {
        baseDir: tmpDir,
        dataDir: path.join(tmpDir, 'data'),
      }
    );

    assert.equal(res.uniqueItemsCount, 2);
    assert.ok(fs.existsSync(res.files.xlsx));
    assert.ok(fs.existsSync(res.files.csv));
    assert.ok(fs.existsSync(res.files.html));
    assert.ok(fs.existsSync(path.join(tmpDir, 'data', 'content-tables.json')));
    const tables = JSON.parse(fs.readFileSync(path.join(tmpDir, 'data', 'content-tables.json'), 'utf8'));
    assert.equal(tables[0].caption, 'Summary Metrics');

    // Verify UTF-8 BOM in CSV
    const csvBuf = fs.readFileSync(res.files.csv);
    assert.equal(csvBuf[0], 0xef);
    assert.equal(csvBuf[1], 0xbb);
    assert.equal(csvBuf[2], 0xbf);

    // Verify Excel sheets
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(res.files.xlsx);
    const sheetNames = wb.worksheets.map((w) => w.name);
    assert.ok(sheetNames.includes('All_Items'));
    assert.ok(sheetNames.includes('Publications'));
    assert.ok(sheetNames.includes('Researches_Services'));
    assert.ok(sheetNames.includes('Authors'));
    assert.ok(sheetNames.includes('Departments_Summary'));
    assert.ok(sheetNames.includes('Pagination_Audit'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
