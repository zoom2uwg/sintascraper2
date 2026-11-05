const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const {
  extractPageData,
  toBorangResearchItem,
} = require('../src/parsers');

const REPO_ROOT = path.resolve(__dirname, '../..');

function readRootHtml(filename) {
  return fs.readFileSync(path.join(REPO_ROOT, filename), 'utf8');
}

test('Groundtruth 1: Affiliation Departments HTML extracts header, search, top-dept chart, dept row & deduplicated pagination', () => {
  const html = readRootHtml('SINTA - Science and Technology Index-Affiliation.html');
  const data = extractPageData(html);

  assert.equal(data.pageType, 'affiliation_departments');
  assert.equal(data.session.isLoggedIn, true);
  assert.equal(data.session.accountName, 'SYAHRONI');

  // Search banner & filters
  assert.equal(data.searchAndFilters.query, 'sistem');
  assert.equal(
    data.searchAndFilters.clearSearchUrl,
    'https://sinta.kemdiktisaintek.go.id/affiliations/departments/2058/071030'
  );
  assert.equal(data.searchAndFilters.sort.selected.label, 'Sinta Score 3Yr');

  // Affiliation header
  assert.equal(data.header.entityType, 'affiliation');
  assert.equal(data.header.name, 'Universitas Widya Gama');
  assert.equal(data.header.affiliation.id, '2058');
  assert.equal(data.header.affiliation.code, '071030');
  assert.equal(data.header.affiliation.abbreviation, 'UWG');
  assert.equal(data.header.affiliation.location, 'KOTA MALANG - JAWA TIMUR, ID');

  // Inline ECharts Top Department chart
  assert.ok(data.charts.topDepartments);
  assert.equal(data.charts.topDepartments.items.length, 11);
  assert.deepEqual(data.charts.topDepartments.ranked[0], {
    department: 'Teknik Informatika (S1)',
    score_3yr: 2799,
  });

  // Pagination (Affiliation HTML has 2 identical pagination navs; parser must not double-count)
  assert.equal(data.pagination.hasPagination, true);
  assert.equal(data.pagination.currentPage, 1);
  assert.equal(data.pagination.totalPages, 1);
  assert.equal(data.pagination.totalRecords, 1);
  assert.equal(data.pagination.pageLinks.length, 1);
  assert.equal(data.pagination.hasNext, false);

  // Department row (.row.d-item)
  assert.equal(data.departments.length, 1);
  const sti = data.departments[0];
  assert.equal(sti.name, 'Sistem dan Teknologi Informasi');
  assert.equal(sti.level, 'S1');
  assert.equal(sti.code_prodi, '59201');
  assert.equal(sti.id, '895FD91B-B0F2-41E7-99EB-F2D3997A9B0F');
  assert.equal(sti.parent_key, '420D8E73-68F0-4044-86CF-5138D1419B20');
  assert.equal(
    sti.legacy_url,
    'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/071030/59201'
  );
  assert.equal(sti.preview_authors.length, 2);
  assert.equal(sti.preview_authors[0].sinta_id, 6937019);
  assert.equal(sti.preview_authors[0].name, 'AFFI NIZAR SUKSMAWATI');
  assert.equal(sti.preview_authors[1].sinta_id, 6973267);
  assert.equal(sti.preview_authors[1].name, 'ISMAIL AKBAR');
});

test('Groundtruth 2: DepartmentProfile HTML extracts Bisnis Digital header, scores, stat-table, charts, tabs & IPR item', () => {
  const html = readRootHtml('SINTA - Science and Technology Index-DepartmentProfile.html');
  const data = extractPageData(html);

  assert.equal(data.pageType, 'department_profile');
  assert.equal(data.activeView, 'iprs');
  assert.equal(data.header.name, 'Bisnis Digital');
  assert.equal(data.header.department.codeProdi, '61209');
  assert.equal(data.header.department.id, 'BB930200-F625-4220-BD63-94F4D1FD2E50');
  assert.equal(data.header.affiliation.id, '2058');
  assert.equal(data.header.affiliation.code, '071030');

  // Stat counter cards & SINTA scores
  assert.equal(data.statCounts.authors, 4);
  assert.deepEqual(data.scores, {
    overall: 439,
    three_year: 218,
    productivity_overall: 88,
    productivity_3yr: 44,
  });

  // Summary matrix (.stat-table including hidden WOS column)
  assert.deepEqual(data.summaryMatrix, {
    scopus: { article: 2, citation: 4 },
    gscholar: { article: 104, citation: 305 },
    wos: { article: 0, citation: 0 },
  });

  // ECharts quartile pie & research radar
  assert.deepEqual(data.charts.quartilePie.distribution, {
    Q1: 0,
    Q2: 0,
    Q3: 1,
    Q4: 0,
    'No-Q': 1,
  });
  assert.deepEqual(data.charts.researchRadar.breakdown, {
    Conference: 1,
    Articles: 1,
    Others: 0,
  });

  // Dynamic views including WOS and commented Arts tab
  assert.ok(data.navigation.availableViews.includes('wos'));
  assert.ok(data.navigation.availableViews.includes('iprs'));
  assert.ok(data.navigation.availableViews.includes('matrics'));
  assert.equal(data.navigation.commentedTabs[0].view, 'arts');

  // IPR record
  assert.equal(data.items.length, 1);
  const ipr = data.items[0];
  assert.equal(ipr.dedup_key, 'iprs:EC002024234761');
  assert.equal(ipr.title, 'Logo Bebras-Biro UWG');
  assert.equal(ipr.inventor, 'Ahmad Fairuzabadi, Fitri Marisa');
  assert.equal(ipr.holder_pub, 'Ahmad Fairuzabadi, Fitri Marisa');
  assert.equal(ipr.year, 2024);
  assert.equal(ipr.nomor_permohonan, 'EC002024234761');
  assert.equal(ipr.ipr_type, 'Hak Cipta');
  assert.equal(ipr.is_dummy_link, true);
  assert.equal(ipr.detail_url, null);
});

test('Groundtruth 3: AuthorResearch HTML extracts all 9 researches, personil IDs, Rupiah & yearly chart matching sample fixture', () => {
  const html = readRootHtml('SINTA - Science and Technology Index-AuthorResearch.html');
  const data = extractPageData(html);
  const expectedFixture = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../fixtures/sample-researches.json'), 'utf8')
  );

  assert.equal(data.pageType, 'author_profile');
  assert.equal(data.activeView, 'researches');
  assert.equal(data.pagination.totalRecords, 9);
  assert.equal(data.items.length, 9);

  // Yearly trend chart (2020..2026, sum = 9)
  const researchTrend = data.charts.yearlyTrends['research-chart-articles'];
  assert.ok(researchTrend);
  assert.equal(researchTrend.total, 9);
  assert.equal(researchTrend.byYear['2026'], 1);
  assert.equal(researchTrend.byYear['2025'], 2);

  // Verify 100% parity with sample-researches.json
  const borangItems = data.items.map(toBorangResearchItem);
  for (let i = 0; i < expectedFixture.length; i++) {
    assert.equal(borangItems[i].judul, expectedFixture[i].judul);
    assert.equal(borangItems[i].leader, expectedFixture[i].leader);
    assert.equal(borangItems[i].scheme, expectedFixture[i].scheme);
    assert.equal(borangItems[i].year, expectedFixture[i].year);
    assert.equal(borangItems[i].fund_rp, expectedFixture[i].fund_rp);
    assert.equal(borangItems[i].status, expectedFixture[i].status);
    assert.equal(borangItems[i].source, expectedFixture[i].source);
    assert.deepEqual(borangItems[i].members, expectedFixture[i].members);
  }
});

test('Groundtruth 4: AuthorsProfile HTML extracts author profile, subjects, hidden WOS tab, H-index matrix & Scopus EID item', () => {
  const html = readRootHtml('SINTA - Science and Technology Index-AuthorsProfile.html');
  const data = extractPageData(html);

  assert.equal(data.pageType, 'author_profile');
  assert.equal(data.activeView, 'scopus');
  assert.equal(data.header.sintaId, 259792);
  assert.equal(data.header.isVerified, true);
  assert.equal(data.header.name, 'SYAHRONI WAHYU IRIANANDA');
  assert.equal(data.header.department.level, 'S1');
  assert.equal(data.header.department.name, 'Teknik Informatika');
  assert.equal(data.header.department.codeProdi, '55201');
  assert.equal(data.header.subjects.length, 4);
  assert.equal(data.header.subjects[0].name, 'Artificial Intelligent');
  assert.equal(data.header.subjects[0].id, 52338);

  assert.deepEqual(data.scores, {
    overall: 474,
    three_year: 190,
    affil: 474,
    affil_3yr: 190,
  });

  assert.equal(data.summaryMatrix.scopus.article, 1);
  assert.equal(data.summaryMatrix.scopus.g_index, 1);
  assert.equal(data.summaryMatrix.gscholar.g_index, 1);
  assert.equal(data.summaryMatrix.wos.article, 0);

  // Hidden WOS tab detected
  const wosTab = data.navigation.articleSubTabs.find((t) => t.view === 'wos');
  assert.ok(wosTab);
  assert.equal(wosTab.hidden, true);
  assert.ok(data.navigation.availableViews.includes('wos'));
  assert.ok(data.navigation.availableViews.includes('pak'));
  assert.ok(data.navigation.availableViews.includes('kepakaran'));

  // Scopus item
  assert.equal(data.items.length, 1);
  const scopusItem = data.items[0];
  assert.equal(scopusItem.dedup_key, 'scopus:2-s2.0-105029558167');
  assert.equal(scopusItem.scopus_eid, '2-s2.0-105029558167');
  assert.equal(scopusItem.scopus_source_id, '21101392033');
  assert.equal(scopusItem.quartile_short, 'no-Q');
  assert.equal(scopusItem.author_order, '0 of 5');
  assert.equal(scopusItem.author_order_index, 0);
  assert.equal(scopusItem.author_total, 5);
  assert.equal(scopusItem.creator, 'Nugroho K.S.');
  assert.equal(scopusItem.year, 2025);
  assert.equal(scopusItem.cited, 0);
  assert.equal(scopusItem.is_external, true);
});

test('Additional Views: Books, Garuda, Metrics content tables, Author list cards & Login page detection', () => {
  // Books + Garuda items + Metrics table
  const booksAndMetricsHtml = `
    <html><body>
      <div class="content-box">
        <div class="profile-article">
          <div class="ar-list-item mb-5">
            <div class="ar-title"><a href="#!">Pengantar Machine Learning Modern</a></div>
            <div class="ar-meta">
              <a class="ar-quartile" href="#!">Buku Referensi</a>
              <a href="#!">Creator : Budi Raharjo</a>
              <a class="ar-pub" href="#!">Penerbit Informatika</a>
            </div>
            <div class="ar-meta">
              <a class="ar-year" href="#!">2025</a>
              <a class="ar-cited" href="#!">ISBN : 978-602-1234-56-7</a>
            </div>
          </div>
          <table class="table table-bordered">
            <caption>Rekap Skor Matrics</caption>
            <thead><tr><th>Komponen</th><th>Bobot</th><th>Nilai</th></tr></thead>
            <tbody><tr><td>Artikel Jurnal Internasional</td><td>40</td><td>120</td></tr></tbody>
          </table>
        </div>
      </div>
    </body></html>
  `;
  const parsed = extractPageData(booksAndMetricsHtml, {
    url: 'https://sinta.kemdiktisaintek.go.id/authors/profile/259792/?view=books',
  });
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].dedup_key, 'books:978-602-1234-56-7');
  assert.equal(parsed.items[0].isbn, '978-602-1234-56-7');
  assert.equal(parsed.items[0].publisher, 'Penerbit Informatika');
  assert.equal(parsed.items[0].book_category, 'Buku Referensi');
  assert.equal(parsed.contentTables.length, 1);
  assert.deepEqual(parsed.contentTables[0].objects[0], {
    Komponen: 'Artikel Jurnal Internasional',
    Bobot: '40',
    Nilai: '120',
  });

  // Login page detection
  const loginHtml = `
    <html><body>
      <form action="https://sinta.kemdiktisaintek.go.id/logins/do_login" method="post">
        <input type="text" name="username" />
        <input type="password" name="password" />
      </form>
    </body></html>
  `;
  const loginData = extractPageData(loginHtml, { url: 'https://sinta.kemdiktisaintek.go.id/logins' });
  assert.equal(loginData.pageType, 'login');
  assert.equal(loginData.session.isLoggedIn, false);
  assert.equal(loginData.session.isLoginPage, true);
});
