const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { toBorangResearchItem } = require('./parsers');

/**
 * Deduplicate and enrich items across Department and Author scrapes using `(view, dedup_key)`.
 */
function deduplicateItems(rawItems = []) {
  const map = new Map();

  for (const item of rawItems) {
    const key = `${item.view || 'item'}::${item.dedup_key || item.title}`;
    if (!map.has(key)) {
      map.set(key, {
        ...item,
        author_ids: item.author_id ? [item.author_id] : [],
        author_names: item.author_name ? [item.author_name] : [],
        dept_names: item.dept_name ? [item.dept_name] : [],
      });
    } else {
      const existing = map.get(key);
      // Merge missing scalar fields from subsequent sightings
      for (const [k, v] of Object.entries(item)) {
        if ((existing[k] === null || existing[k] === undefined || existing[k] === '') && v != null && v !== '') {
          existing[k] = v;
        }
      }
      if (item.author_id && !existing.author_ids.includes(item.author_id)) {
        existing.author_ids.push(item.author_id);
      }
      if (item.author_name && !existing.author_names.includes(item.author_name)) {
        existing.author_names.push(item.author_name);
      }
      if (item.dept_name && !existing.dept_names.includes(item.dept_name)) {
        existing.dept_names.push(item.dept_name);
      }
    }
  }

  return [...map.values()];
}

/**
 * Deduplicate and merge author profiles by `sinta_id` (or `profile_url`).
 */
function deduplicateAuthors(rawAuthors = []) {
  const map = new Map();
  for (const aut of rawAuthors) {
    const key = aut.sinta_id ? `id:${aut.sinta_id}` : aut.profile_url || aut.name;
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        ...aut,
        nama: aut.nama || aut.name || null,
        name: aut.name || aut.nama || null,
      });
    } else {
      const prev = map.get(key);
      for (const [k, v] of Object.entries(aut)) {
        const prevEmpty =
          prev[k] == null ||
          prev[k] === '' ||
          (Array.isArray(prev[k]) && prev[k].length === 0) ||
          (typeof prev[k] === 'object' && !Array.isArray(prev[k]) && Object.keys(prev[k]).length === 0);
        if (prevEmpty && v != null) {
          prev[k] = v;
        }
      }
    }
  }
  return [...map.values()];
}

/**
 * Escape a CSV value safely.
 */
function escapeCsvCell(val, delimiter = ',') {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(delimiter) || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Write UTF-8 with BOM CSV file from rows and column definitions.
 */
function writeCsvWithBom(filePath, columns, rows, delimiter = ',') {
  const headerLine = columns.map((c) => escapeCsvCell(c.header, delimiter)).join(delimiter);
  const bodyLines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(row[c.key], delimiter)).join(delimiter)
  );
  const content = '\uFEFF' + [headerLine, ...bodyLines].join('\r\n') + '\r\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Style an ExcelJS worksheet with frozen header row, AutoFilter, header fill, and hyperlink cells.
 */
function styleWorksheet(ws, columns, rows, urlKeys = []) {
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || 22,
  }));

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2B4C7E' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };

  rows.forEach((r) => {
    const added = ws.addRow(r);
    urlKeys.forEach((uKey) => {
      const val = r[uKey];
      if (val && typeof val === 'string' && /^https?:\/\//i.test(val)) {
        const colIdx = columns.findIndex((c) => c.key === uKey) + 1;
        if (colIdx > 0) {
          const cell = added.getCell(colIdx);
          cell.value = { text: val, hyperlink: val };
          cell.font = { color: { argb: 'FF1D6FB8' }, underline: true };
        }
      }
    });
  });

  if (columns.length > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, rows.length + 1), column: columns.length },
    };
  }
}

/**
 * Flatten an item into a flat row object for Excel/CSV export.
 */
function flattenItemForExport(item) {
  return {
    dedup_key: item.dedup_key || '',
    entityType: item.entity_type || '',
    entityName: item.entity_name || '',
    deptName: item.dept_name || (item.dept_names || []).join('; ') || '',
    authorId: item.author_id || (item.author_ids || []).join('; ') || '',
    authorName: item.author_name || (item.author_names || []).join('; ') || '',
    category: item.view || '',
    page: item.page || 1,
    title: item.title || '',
    year: item.year ?? '',
    quartile: item.quartile || item.accreditation || '',
    journal: item.journal || item.scheme || item.publisher || '',
    scopusEid: item.scopus_eid || '',
    authorOrder: item.author_order || '',
    creator: item.creator || item.authors || '',
    leader: item.leader || '',
    inventor: item.inventor || '',
    personilNames: (item.personil_names || []).join('; '),
    personilIds: (item.personil_ids || []).join('; '),
    fundRp: item.fund_rp || '',
    fundAmount: item.fund_amount ?? '',
    status: item.status || '',
    source: item.source || '',
    nomorPermohonan: item.nomor_permohonan || '',
    iprType: item.ipr_type || '',
    isbn: item.isbn || '',
    doi: item.doi || '',
    cited: item.cited ?? '',
    rawMetadata: item.raw_metadata || '',
    link: item.detail_url || '',
    sintaSourceUrl: item.sinta_source_url || '',
    scrapedAt: item.scraped_at || '',
  };
}

/**
 * Build standalone interactive HTML dashboard containing all extracted page data & pagination audit.
 */
function generateInteractiveDashboardHtml(bundle) {
  const {
    affiliation = null,
    affiliationDepartments = [],
    departmentProfiles = [],
    authors = [],
    uniqueItems = [],
    contentTables = [],
    paginationAudit = [],
    generatedAt = new Date().toISOString(),
  } = bundle;

  const totalPagesCrawled = paginationAudit.reduce((acc, a) => acc + (a.pagesScraped || 0), 0);
  const safeJsonPayload = JSON.stringify({
    items: uniqueItems.map(flattenItemForExport),
    authors,
    departmentProfiles,
    affiliation,
    affiliationDepartments,
    contentTables,
    paginationAudit,
  }).replace(/<\//g, '<\\/');

  const affilTitle =
    affiliation?.header?.name ||
    departmentProfiles[0]?.header?.affiliation?.name ||
    'SINTA Scraper Dataset';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SINTA Scraper Dashboard — ${escapeHtml(affilTitle)}</title>
  <style>
    :root {
      --primary: #1e3a8a;
      --primary-light: #2563eb;
      --bg: #f1f5f9;
      --card: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --success: #15803d;
      --warn: #b45309;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 20px;
    }
    .wrap { max-width: 1440px; margin: 0 auto; }
    .hero {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: #fff;
      padding: 28px 32px;
      border-radius: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .hero h1 { font-size: 1.65rem; margin-bottom: 4px; }
    .hero p { opacity: 0.9; font-size: 0.92rem; }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .kpi {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px 20px;
    }
    .kpi .lbl { font-size: 0.78rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; }
    .kpi .val { font-size: 1.75rem; font-weight: 700; color: var(--primary); margin-top: 4px; }
    .tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .tab-btn {
      border: 1px solid var(--border);
      background: var(--card);
      color: var(--text);
      padding: 9px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .tab-btn.active {
      background: var(--primary);
      color: #fff;
      border-color: var(--primary);
    }
    .panel {
      display: none;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
    }
    .panel.active { display: block; }
    .toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 14px;
      align-items: center;
    }
    .toolbar input, .toolbar select {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.88rem;
      background: #fff;
    }
    .toolbar input { min-width: 260px; flex: 1; }
    .table-wrap { overflow-x: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    caption {
      text-align: left;
      font-size: 0.82rem;
      color: var(--muted);
      margin-bottom: 8px;
    }
    th, td {
      border-bottom: 1px solid var(--border);
      padding: 9px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    tr:hover td { background: #f8fafc; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: #dbeafe;
      color: #1e40af;
    }
    .badge.ok { background: #dcfce7; color: var(--success); }
    .badge.warn { background: #fef3c7; color: var(--warn); }
    .pager {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 14px;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 0.86rem;
    }
    .pager button {
      padding: 6px 12px;
      border: 1px solid var(--border);
      background: #fff;
      border-radius: 6px;
      cursor: pointer;
    }
    .pager button:disabled { opacity: 0.45; cursor: default; }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 16px;
    }
    .info-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      background: #fafafa;
    }
    .info-card h3 { font-size: 1.05rem; color: var(--primary); margin-bottom: 8px; }
    .kv-list { font-size: 0.85rem; }
    .kv-list div { margin-bottom: 4px; }
    a { color: var(--primary-light); text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div>
        <h1>SINTA Complete Extraction &amp; Pagination Report</h1>
        <p>${escapeHtml(affilTitle)} &bull; Dibuat pada: ${escapeHtml(generatedAt)}</p>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="lbl">Total Unique Records</div><div class="val">${uniqueItems.length}</div></div>
      <div class="kpi"><div class="lbl">Departments Profiled</div><div class="val">${departmentProfiles.length || affiliationDepartments.length}</div></div>
      <div class="kpi"><div class="lbl">Authors Extracted</div><div class="val">${authors.length}</div></div>
      <div class="kpi"><div class="lbl">Total Pages Crawled</div><div class="val">${totalPagesCrawled}</div></div>
      <div class="kpi"><div class="lbl">Paginated Endpoints</div><div class="val">${paginationAudit.length}</div></div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="items">Publikasi, Riset, HKI &amp; Buku (${uniqueItems.length})</button>
      <button class="tab-btn" data-tab="departments">Profil Departemen &amp; Grafik (${departmentProfiles.length})</button>
      <button class="tab-btn" data-tab="authors">Profil Dosen &amp; Metrik (${authors.length})</button>
      <button class="tab-btn" data-tab="affil">Afiliasi &amp; Indeks Prodi (${affiliationDepartments.length})</button>
      <button class="tab-btn" data-tab="pagination">Audit Pagination (${paginationAudit.length})</button>
    </div>

    <div id="panel-items" class="panel active">
      <div class="toolbar">
        <input type="text" id="searchInput" placeholder="Cari judul, penulis, ketua, skema, jurnal, nomor HKI, EID..." />
        <select id="viewFilter"><option value="">Semua View</option></select>
        <select id="deptFilter"><option value="">Semua Departemen</option></select>
        <select id="yearFilter"><option value="">Semua Tahun</option></select>
        <select id="pageSizeSelect">
          <option value="25">25 / hal</option>
          <option value="50">50 / hal</option>
          <option value="100">100 / hal</option>
          <option value="999999">Semua</option>
        </select>
      </div>
      <div class="table-wrap">
        <table id="itemsTable">
          <caption id="itemsCaption"></caption>
          <thead>
            <tr>
              <th data-col="category">View</th>
              <th data-col="page">Hal</th>
              <th data-col="title">Judul</th>
              <th data-col="year">Tahun</th>
              <th data-col="creator">Penulis / Ketua / Inventor</th>
              <th data-col="journal">Jurnal / Skema / Penerbit</th>
              <th data-col="quartile">Quartile / Tipe</th>
              <th data-col="fundRp">Dana / Sitasi / No. HKI</th>
              <th data-col="deptName">Prodi / Entitas</th>
              <th>Tautan</th>
            </tr>
          </thead>
          <tbody id="itemsTbody"></tbody>
        </table>
      </div>
      <div class="pager">
        <div id="pagerInfo"></div>
        <div>
          <button id="prevBtn">Sebelumnya</button>
          <button id="nextBtn">Selanjutnya</button>
        </div>
      </div>
    </div>

    <div id="panel-departments" class="panel">
      <div class="cards-grid" id="deptCards"></div>
    </div>

    <div id="panel-authors" class="panel">
      <div class="table-wrap">
        <table>
          <caption>Daftar Dosen beserta Skor SINTA, Bidang Keahlian, dan Ringkasan Scopus / GScholar / WOS</caption>
          <thead>
            <tr>
              <th>SINTA ID</th>
              <th>Nama Dosen</th>
              <th>Prodi</th>
              <th>Subjects</th>
              <th>Score Overall / 3Yr</th>
              <th>Scopus (Art/Cit/H)</th>
              <th>GScholar (Art/Cit/H)</th>
              <th>WOS (Art/Cit/H)</th>
              <th>Profil</th>
            </tr>
          </thead>
          <tbody id="authorsTbody"></tbody>
        </table>
      </div>
    </div>

    <div id="panel-affil" class="panel">
      <div id="affilSummary" style="margin-bottom:16px;"></div>
      <div class="table-wrap">
        <table>
          <caption>Indeks Program Studi pada Afiliasi</caption>
          <thead>
            <tr>
              <th>Jenjang</th>
              <th>Kode Prodi</th>
              <th>Nama Program Studi</th>
              <th>Preview Dosen</th>
              <th>URL Kanonis</th>
            </tr>
          </thead>
          <tbody id="affilDeptsTbody"></tbody>
        </table>
      </div>
    </div>

    <div id="panel-pagination" class="panel">
      <div class="table-wrap">
        <table>
          <caption>Verifikasi Kelengkapan Pagination per Halaman &amp; View</caption>
          <thead>
            <tr>
              <th>Scope</th>
              <th>View</th>
              <th>Halaman Diambil</th>
              <th>Total Halaman SINTA</th>
              <th>Total Records SINTA</th>
              <th>Item Terekstrak</th>
              <th>Status</th>
              <th>URL Awal</th>
            </tr>
          </thead>
          <tbody id="pagAuditTbody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    const DATA = ${safeJsonPayload};

    // Tabs switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      });
    });

    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    // Populate filter dropdowns
    const views = [...new Set(DATA.items.map(i => i.category).filter(Boolean))].sort();
    const depts = [...new Set(DATA.items.map(i => i.deptName || i.entityName).filter(Boolean))].sort();
    const years = [...new Set(DATA.items.map(i => i.year).filter(Boolean))].sort((a,b) => b - a);

    const viewSel = document.getElementById('viewFilter');
    views.forEach(v => viewSel.insertAdjacentHTML('beforeend', '<option value="'+esc(v)+'">'+esc(v)+'</option>'));
    const deptSel = document.getElementById('deptFilter');
    depts.forEach(d => deptSel.insertAdjacentHTML('beforeend', '<option value="'+esc(d)+'">'+esc(d)+'</option>'));
    const yearSel = document.getElementById('yearFilter');
    years.forEach(y => yearSel.insertAdjacentHTML('beforeend', '<option value="'+esc(y)+'">'+esc(y)+'</option>'));

    let sortCol = 'year';
    let sortAsc = false;
    let curPage = 1;

    function renderItems() {
      const q = document.getElementById('searchInput').value.trim().toLowerCase();
      const vf = viewSel.value;
      const df = deptSel.value;
      const yf = yearSel.value;
      const pageSize = parseInt(document.getElementById('pageSizeSelect').value, 10) || 25;

      let filtered = DATA.items.filter(it => {
        if (vf && it.category !== vf) return false;
        if (df && (it.deptName || it.entityName) !== df) return false;
        if (yf && String(it.year) !== yf) return false;
        if (q) {
          const hay = [it.title, it.creator, it.leader, it.inventor, it.personilNames, it.journal, it.nomorPermohonan, it.scopusEid, it.rawMetadata].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      filtered.sort((a, b) => {
        const va = a[sortCol] ?? '';
        const vb = b[sortCol] ?? '';
        if (va < vb) return sortAsc ? -1 : 1;
        if (va > vb) return sortAsc ? 1 : -1;
        return 0;
      });

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      if (curPage > totalPages) curPage = totalPages;
      const slice = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);

      document.getElementById('itemsCaption').textContent =
        'Menampilkan ' + slice.length + ' dari ' + total + ' item terfilter (Total keseluruhan: ' + DATA.items.length + ')';

      document.getElementById('itemsTbody').innerHTML = slice.map(r => {
        const extra = [
          r.fundRp ? r.fundRp : '',
          r.status ? '(' + r.status + ')' : '',
          r.cited !== '' ? r.cited + ' cited' : '',
          r.nomorPermohonan ? 'No: ' + r.nomorPermohonan : '',
          r.isbn ? 'ISBN: ' + r.isbn : ''
        ].filter(Boolean).join(' ');
        const qBadge = r.quartile || r.iprType || '-';
        const docLink = r.link ? '<a href="'+esc(r.link)+'" target="_blank" rel="noopener">Dokumen</a>' : '';
        const srcLink = r.sintaSourceUrl ? '<a href="'+esc(r.sintaSourceUrl)+'" target="_blank" rel="noopener">SINTA</a>' : '';
        return '<tr>' +
          '<td><span class="badge">'+esc(r.category)+'</span></td>' +
          '<td>'+esc(r.page)+'</td>' +
          '<td><strong>'+esc(r.title)+'</strong></td>' +
          '<td>'+esc(r.year)+'</td>' +
          '<td>'+esc(r.creator || r.leader || r.inventor || '-')+'</td>' +
          '<td>'+esc(r.journal || '-')+'</td>' +
          '<td>'+esc(qBadge)+'</td>' +
          '<td>'+esc(extra || '-')+'</td>' +
          '<td>'+esc(r.deptName || r.entityName || '-')+'</td>' +
          '<td>'+[docLink, srcLink].filter(Boolean).join(' | ')+'</td>' +
          '</tr>';
      }).join('');

      document.getElementById('pagerInfo').textContent = 'Halaman ' + curPage + ' dari ' + totalPages;
      document.getElementById('prevBtn').disabled = curPage <= 1;
      document.getElementById('nextBtn').disabled = curPage >= totalPages;
    }

    ['searchInput', 'viewFilter', 'deptFilter', 'yearFilter', 'pageSizeSelect'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => { curPage = 1; renderItems(); });
      document.getElementById(id).addEventListener('change', () => { curPage = 1; renderItems(); });
    });
    document.getElementById('prevBtn').addEventListener('click', () => { if (curPage > 1) { curPage--; renderItems(); } });
    document.getElementById('nextBtn').addEventListener('click', () => { curPage++; renderItems(); });
    document.querySelectorAll('#itemsTable th[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const c = th.dataset.col;
        if (sortCol === c) sortAsc = !sortAsc;
        else { sortCol = c; sortAsc = true; }
        renderItems();
      });
    });

    // Render Department Cards
    document.getElementById('deptCards').innerHTML = (DATA.departmentProfiles || []).map(dp => {
      const h = dp.header || {};
      const sc = dp.scores || {};
      const sm = dp.summaryMatrix || {};
      const qp = dp.charts?.quartilePie?.distribution || {};
      return '<div class="info-card">' +
        '<h3>' + esc(h.name || 'Department') + ' (' + esc(h.department?.codeProdi || '-') + ')</h3>' +
        '<div class="kv-list">' +
          '<div><strong>Authors:</strong> ' + esc(dp.statCounts?.authors ?? '-') + '</div>' +
          '<div><strong>SINTA Score Overall / 3Yr:</strong> ' + esc(sc.overall ?? '-') + ' / ' + esc(sc.three_year ?? '-') + '</div>' +
          '<div><strong>Productivity Overall / 3Yr:</strong> ' + esc(sc.productivity_overall ?? '-') + ' / ' + esc(sc.productivity_3yr ?? '-') + '</div>' +
          '<div><strong>Scopus (Art / Cit):</strong> ' + esc(sm.scopus?.article ?? 0) + ' / ' + esc(sm.scopus?.citation ?? 0) + '</div>' +
          '<div><strong>GScholar (Art / Cit):</strong> ' + esc(sm.gscholar?.article ?? 0) + ' / ' + esc(sm.gscholar?.citation ?? 0) + '</div>' +
          '<div><strong>Quartile Pie:</strong> ' + esc(JSON.stringify(qp)) + '</div>' +
          '<div><strong>Views Tersedia:</strong> ' + esc((dp.navigation?.availableViews || []).join(', ')) + '</div>' +
        '</div>' +
      '</div>';
    }).join('') || '<p>Belum ada data profil departemen.</p>';

    // Render Authors
    document.getElementById('authorsTbody').innerHTML = (DATA.authors || []).map(a => {
      const sc = a.scores || {};
      const sm = a.summary || a.summaryMatrix || {};
      const fmtSrc = s => s ? [s.article ?? 0, s.citation ?? 0, s.h_index ?? 0].join(' / ') : '-';
      const subs = (a.subjects || []).map(s => typeof s === 'string' ? s : s.name).join(', ');
      return '<tr>' +
        '<td>' + esc(a.sinta_id || '-') + '</td>' +
        '<td><strong>' + esc(a.name || a.nama || '-') + '</strong></td>' +
        '<td>' + esc(a.study_program || a.department || '-') + '</td>' +
        '<td>' + esc(subs || '-') + '</td>' +
        '<td>' + esc((sc.overall ?? a.sinta_score_overall ?? '-') + ' / ' + (sc.three_year ?? a.sinta_score_3yr ?? '-')) + '</td>' +
        '<td>' + esc(fmtSrc(sm.scopus)) + '</td>' +
        '<td>' + esc(fmtSrc(sm.gscholar || sm.google_scholar)) + '</td>' +
        '<td>' + esc(fmtSrc(sm.wos)) + '</td>' +
        '<td>' + (a.profile_url ? '<a href="'+esc(a.profile_url)+'" target="_blank">Profil</a>' : '-') + '</td>' +
      '</tr>';
    }).join('');

    // Render Affiliation & Dept Index
    if (DATA.affiliation) {
      const ah = DATA.affiliation.header || {};
      const topDepts = DATA.affiliation.charts?.topDepartments?.ranked || [];
      document.getElementById('affilSummary').innerHTML =
        '<div class="info-card"><h3>' + esc(ah.name || 'Afiliasi') + ' (' + esc(ah.affiliation?.abbreviation || '') + ')</h3>' +
        '<div class="kv-list">' +
          '<div><strong>ID / Kode PT:</strong> ' + esc(ah.affiliation?.id || '-') + ' / ' + esc(ah.affiliation?.code || '-') + '</div>' +
          '<div><strong>Lokasi:</strong> ' + esc(ah.affiliation?.location || '-') + '</div>' +
          (topDepts.length ? '<div><strong>Top Dept (3Yr Score):</strong> ' + esc(topDepts.slice(0,5).map(d => d.department + ': ' + d.score_3yr).join(' | ')) + '</div>' : '') +
        '</div></div>';
    }
    document.getElementById('affilDeptsTbody').innerHTML = (DATA.affiliationDepartments || []).map(d => {
      const prev = (d.preview_authors || []).map(p => p.name + ' (' + p.sinta_id + ')').join(', ');
      return '<tr>' +
        '<td>' + esc(d.level || '-') + '</td>' +
        '<td>' + esc(d.code_prodi || '-') + '</td>' +
        '<td><strong>' + esc(d.name || '-') + '</strong></td>' +
        '<td>' + esc(prev || '-') + '</td>' +
        '<td>' + (d.canonical_url ? '<a href="'+esc(d.canonical_url)+'" target="_blank">Buka Prodi</a>' : '-') + '</td>' +
      '</tr>';
    }).join('');

    // Render Pagination Audit
    document.getElementById('pagAuditTbody').innerHTML = (DATA.paginationAudit || []).map(p => {
      const ok = p.isComplete && (!p.warnings || p.warnings.length === 0);
      return '<tr>' +
        '<td>' + esc(p.scope || '-') + '</td>' +
        '<td><span class="badge">' + esc(p.view || 'index') + '</span></td>' +
        '<td>' + esc(p.pagesScraped) + '</td>' +
        '<td>' + esc(p.reportedTotalPages ?? p.effectiveTotalPages ?? '-') + '</td>' +
        '<td>' + esc(p.reportedTotalRecords ?? '-') + '</td>' +
        '<td>' + esc(p.extractedCount ?? 0) + '</td>' +
        '<td><span class="badge ' + (ok ? 'ok' : 'warn') + '">' + esc(p.emptyVerified ? 'Empty (0)' : ok ? 'Lengkap' : (p.warnings || []).join('; ') || 'Partial') + '</span></td>' +
        '<td>' + (p.startUrl ? '<a href="'+esc(p.startUrl)+'" target="_blank">Link</a>' : '-') + '</td>' +
      '</tr>';
    }).join('');

    renderItems();
  </script>
</body>
</html>`;
}

/**
 * Export full scraped dataset to JSON files (`data/`), multi-sheet Excel (`sinta_export.xlsx`),
 * UTF-8 BOM CSV (`sinta_export.csv`), and standalone interactive HTML (`sinta_export.html`).
 */
async function exportAllFormats(bundle, options = {}) {
  const baseDir = options.baseDir || path.resolve(__dirname, '..');
  const dataDir = options.dataDir || path.join(baseDir, 'data');
  const csvDelimiter = options.csvDelimiter || process.env.CSV_DELIMITER || ',';

  fs.mkdirSync(dataDir, { recursive: true });

  const uniqueItems = deduplicateItems(bundle.items || []);
  const uniqueAuthors = deduplicateAuthors(bundle.authors || []);
  const affiliation = bundle.affiliation || null;
  const affiliationDepartments = bundle.affiliationDepartments || [];
  const departmentProfiles = bundle.departmentProfiles || [];
  const contentTables = bundle.contentTables || [];
  const paginationAudit = bundle.paginationAudit || [];

  // 1. Save structured JSON files (including Borang-compatible researches & services)
  const researchesBorang = uniqueItems
    .filter((i) => i.view === 'researches')
    .map(toBorangResearchItem);
  const servicesBorang = uniqueItems
    .filter((i) => i.view === 'services')
    .map(toBorangResearchItem);

  fs.writeFileSync(
    path.join(dataDir, 'affiliation.json'),
    JSON.stringify({ affiliation, departments: affiliationDepartments }, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dataDir, 'departments.json'),
    JSON.stringify(departmentProfiles, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dataDir, 'authors.json'),
    JSON.stringify(uniqueAuthors, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dataDir, 'items.json'),
    JSON.stringify(uniqueItems, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dataDir, 'researches.json'),
    JSON.stringify(researchesBorang, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dataDir, 'services.json'),
    JSON.stringify(servicesBorang, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dataDir, 'content-tables.json'),
    JSON.stringify(contentTables, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(dataDir, 'pagination-audit.json'),
    JSON.stringify(paginationAudit, null, 2),
    'utf8'
  );

  // 2. Export CSV (UTF-8 BOM)
  const itemColumns = [
    { header: 'Dedup Key', key: 'dedup_key', width: 26 },
    { header: 'Entity Type', key: 'entityType', width: 14 },
    { header: 'Entity Name', key: 'entityName', width: 28 },
    { header: 'Department', key: 'deptName', width: 28 },
    { header: 'Author ID', key: 'authorId', width: 14 },
    { header: 'Author Name', key: 'authorName', width: 26 },
    { header: 'Category / View', key: 'category', width: 16 },
    { header: 'Page', key: 'page', width: 8 },
    { header: 'Title', key: 'title', width: 55 },
    { header: 'Year', key: 'year', width: 10 },
    { header: 'Quartile / Accreditation', key: 'quartile', width: 22 },
    { header: 'Journal / Scheme / Publisher', key: 'journal', width: 42 },
    { header: 'Scopus EID', key: 'scopusEid', width: 24 },
    { header: 'Author Order', key: 'authorOrder', width: 14 },
    { header: 'Creator / Authors', key: 'creator', width: 32 },
    { header: 'Leader', key: 'leader', width: 26 },
    { header: 'Inventor', key: 'inventor', width: 28 },
    { header: 'Personil Names', key: 'personilNames', width: 35 },
    { header: 'Personil SINTA IDs', key: 'personilIds', width: 22 },
    { header: 'Fund (Rp)', key: 'fundRp', width: 18 },
    { header: 'Fund Amount', key: 'fundAmount', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Funding Source', key: 'source', width: 20 },
    { header: 'Nomor Permohonan', key: 'nomorPermohonan', width: 22 },
    { header: 'IPR Type', key: 'iprType', width: 18 },
    { header: 'ISBN', key: 'isbn', width: 20 },
    { header: 'DOI', key: 'doi', width: 24 },
    { header: 'Cited', key: 'cited', width: 10 },
    { header: 'Raw Metadata', key: 'rawMetadata', width: 50 },
    { header: 'Document Link', key: 'link', width: 40 },
    { header: 'SINTA Source URL', key: 'sintaSourceUrl', width: 45 },
    { header: 'Scraped At', key: 'scrapedAt', width: 24 },
  ];

  const flatRows = uniqueItems.map(flattenItemForExport);
  const csvPath = options.csvPath || path.join(baseDir, 'sinta_export.csv');
  writeCsvWithBom(csvPath, itemColumns, flatRows, csvDelimiter);

  // 3. Export Multi-Sheet Excel (.xlsx)
  const xlsxPath = options.xlsxPath || path.join(baseDir, 'sinta_export.xlsx');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SINTAScraper';
  wb.created = new Date();

  // Sheet 1: All Items
  const wsAll = wb.addWorksheet('All_Items');
  styleWorksheet(wsAll, itemColumns, flatRows, ['link', 'sintaSourceUrl']);

  // Sheet 2: Publications (scopus, wos, garuda, googlescholar, rama)
  const pubRows = flatRows.filter((r) =>
    ['scopus', 'wos', 'garuda', 'googlescholar', 'rama', 'articles'].includes(r.category)
  );
  if (pubRows.length > 0) {
    const wsPub = wb.addWorksheet('Publications');
    styleWorksheet(
      wsPub,
      [
        { header: 'View', key: 'category', width: 14 },
        { header: 'Page', key: 'page', width: 8 },
        { header: 'Title', key: 'title', width: 55 },
        { header: 'Year', key: 'year', width: 10 },
        { header: 'Quartile / Accred.', key: 'quartile', width: 22 },
        { header: 'Journal / Venue', key: 'journal', width: 42 },
        { header: 'Creator / Authors', key: 'creator', width: 30 },
        { header: 'Author Order', key: 'authorOrder', width: 14 },
        { header: 'Cited', key: 'cited', width: 10 },
        { header: 'Scopus EID', key: 'scopusEid', width: 24 },
        { header: 'DOI', key: 'doi', width: 24 },
        { header: 'Department', key: 'deptName', width: 26 },
        { header: 'Author SINTA', key: 'authorName', width: 26 },
        { header: 'Document Link', key: 'link', width: 40 },
        { header: 'SINTA Source URL', key: 'sintaSourceUrl', width: 42 },
      ],
      pubRows,
      ['link', 'sintaSourceUrl']
    );
  }

  // Sheet 3: Researches & Community Services
  const resServRows = flatRows.filter((r) => ['researches', 'services'].includes(r.category));
  if (resServRows.length > 0) {
    const wsRes = wb.addWorksheet('Researches_Services');
    styleWorksheet(
      wsRes,
      [
        { header: 'View', key: 'category', width: 14 },
        { header: 'Page', key: 'page', width: 8 },
        { header: 'Title', key: 'title', width: 55 },
        { header: 'Year', key: 'year', width: 10 },
        { header: 'Leader', key: 'leader', width: 28 },
        { header: 'Scheme', key: 'journal', width: 40 },
        { header: 'Personil Names', key: 'personilNames', width: 36 },
        { header: 'Personil IDs', key: 'personilIds', width: 22 },
        { header: 'Fund (Rp)', key: 'fundRp', width: 18 },
        { header: 'Fund Amount', key: 'fundAmount', width: 16 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Source', key: 'source', width: 20 },
        { header: 'Department', key: 'deptName', width: 26 },
        { header: 'SINTA Source URL', key: 'sintaSourceUrl', width: 42 },
      ],
      resServRows,
      ['sintaSourceUrl']
    );
  }

  // Sheet 4: IPRs & Books
  const iprBookRows = flatRows.filter((r) => ['iprs', 'books'].includes(r.category));
  if (iprBookRows.length > 0) {
    const wsIpr = wb.addWorksheet('IPRs_Books');
    styleWorksheet(
      wsIpr,
      [
        { header: 'View', key: 'category', width: 12 },
        { header: 'Page', key: 'page', width: 8 },
        { header: 'Title', key: 'title', width: 50 },
        { header: 'Year', key: 'year', width: 10 },
        { header: 'Inventor / Creator', key: 'creator', width: 32 },
        { header: 'Holder / Publisher', key: 'journal', width: 34 },
        { header: 'Nomor Permohonan', key: 'nomorPermohonan', width: 22 },
        { header: 'IPR Type', key: 'iprType', width: 18 },
        { header: 'ISBN', key: 'isbn', width: 20 },
        { header: 'Department', key: 'deptName', width: 26 },
        { header: 'SINTA Source URL', key: 'sintaSourceUrl', width: 42 },
      ],
      iprBookRows,
      ['sintaSourceUrl']
    );
  }

  // Sheet 5: Authors
  const authorRows = uniqueAuthors.map((a) => {
    const sc = a.scores || {};
    const sm = a.summary || a.summaryMatrix || {};
    const subs = (a.subjects || []).map((s) => (typeof s === 'string' ? s : s.name)).join('; ');
    return {
      sinta_id: a.sinta_id ?? '',
      name: a.name || a.nama || '',
      verified: a.is_verified ? 'Yes' : 'No',
      nidn: a.nidn || '',
      affiliation: a.affiliation?.name || a.affiliation || '',
      study_program: a.study_program || a.department?.name || a.department || '',
      code_prodi: a.code_prodi || a.department?.codeProdi || '',
      subjects: subs,
      score_overall: sc.overall ?? a.sinta_score_overall ?? '',
      score_3yr: sc.three_year ?? a.sinta_score_3yr ?? '',
      score_affil: sc.affil ?? a.affil_score ?? '',
      score_affil_3yr: sc.affil_3yr ?? '',
      scopus_articles: sm.scopus?.article ?? '',
      scopus_citations: sm.scopus?.citation ?? '',
      scopus_h_index: sm.scopus?.h_index ?? '',
      gs_articles: (sm.gscholar || sm.google_scholar)?.article ?? '',
      gs_citations: (sm.gscholar || sm.google_scholar)?.citation ?? '',
      gs_h_index: (sm.gscholar || sm.google_scholar)?.h_index ?? '',
      wos_articles: sm.wos?.article ?? '',
      wos_citations: sm.wos?.citation ?? '',
      profile_url: a.profile_url || a.url || '',
    };
  });
  const wsAuthors = wb.addWorksheet('Authors');
  styleWorksheet(
    wsAuthors,
    [
      { header: 'SINTA ID', key: 'sinta_id', width: 14 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Verified', key: 'verified', width: 10 },
      { header: 'NIDN', key: 'nidn', width: 16 },
      { header: 'Affiliation', key: 'affiliation', width: 28 },
      { header: 'Study Program', key: 'study_program', width: 28 },
      { header: 'Code Prodi', key: 'code_prodi', width: 14 },
      { header: 'Subjects', key: 'subjects', width: 42 },
      { header: 'Score Overall', key: 'score_overall', width: 15 },
      { header: 'Score 3Yr', key: 'score_3yr', width: 14 },
      { header: 'Affil Score', key: 'score_affil', width: 14 },
      { header: 'Affil Score 3Yr', key: 'score_affil_3yr', width: 16 },
      { header: 'Scopus Articles', key: 'scopus_articles', width: 15 },
      { header: 'Scopus Citations', key: 'scopus_citations', width: 16 },
      { header: 'Scopus H-Index', key: 'scopus_h_index', width: 15 },
      { header: 'GS Articles', key: 'gs_articles', width: 14 },
      { header: 'GS Citations', key: 'gs_citations', width: 14 },
      { header: 'GS H-Index', key: 'gs_h_index', width: 14 },
      { header: 'WOS Articles', key: 'wos_articles', width: 14 },
      { header: 'WOS Citations', key: 'wos_citations', width: 15 },
      { header: 'Profile URL', key: 'profile_url', width: 42 },
    ],
    authorRows,
    ['profile_url']
  );

  // Sheet 6: Department Profiles & Summary
  const deptSummaryRows = departmentProfiles.map((dp) => {
    const h = dp.header || {};
    const sc = dp.scores || {};
    const sm = dp.summaryMatrix || {};
    const qp = dp.charts?.quartilePie?.distribution || {};
    return {
      name: h.name || '',
      code_prodi: h.department?.codeProdi || '',
      dept_id: h.department?.id || '',
      authors_count: dp.statCounts?.authors ?? '',
      score_overall: sc.overall ?? '',
      score_3yr: sc.three_year ?? '',
      prod_overall: sc.productivity_overall ?? '',
      prod_3yr: sc.productivity_3yr ?? '',
      scopus_articles: sm.scopus?.article ?? '',
      scopus_citations: sm.scopus?.citation ?? '',
      gs_articles: sm.gscholar?.article ?? '',
      gs_citations: sm.gscholar?.citation ?? '',
      wos_articles: sm.wos?.article ?? '',
      q1: qp.Q1 ?? '',
      q2: qp.Q2 ?? '',
      q3: qp.Q3 ?? '',
      q4: qp.Q4 ?? '',
      no_q: qp['No-Q'] ?? '',
      canonical_url: h.department?.canonicalUrl || h.url || '',
      legacy_url: h.department?.legacyUrl || '',
    };
  });
  const wsDepts = wb.addWorksheet('Departments_Summary');
  styleWorksheet(
    wsDepts,
    [
      { header: 'Department', key: 'name', width: 30 },
      { header: 'Code Prodi', key: 'code_prodi', width: 14 },
      { header: 'UUID', key: 'dept_id', width: 38 },
      { header: 'Authors Count', key: 'authors_count', width: 15 },
      { header: 'Score Overall', key: 'score_overall', width: 15 },
      { header: 'Score 3Yr', key: 'score_3yr', width: 14 },
      { header: 'Productivity Overall', key: 'prod_overall', width: 18 },
      { header: 'Productivity 3Yr', key: 'prod_3yr', width: 16 },
      { header: 'Scopus Articles', key: 'scopus_articles', width: 15 },
      { header: 'Scopus Citations', key: 'scopus_citations', width: 16 },
      { header: 'GS Articles', key: 'gs_articles', width: 14 },
      { header: 'GS Citations', key: 'gs_citations', width: 14 },
      { header: 'WOS Articles', key: 'wos_articles', width: 14 },
      { header: 'Q1', key: 'q1', width: 8 },
      { header: 'Q2', key: 'q2', width: 8 },
      { header: 'Q3', key: 'q3', width: 8 },
      { header: 'Q4', key: 'q4', width: 8 },
      { header: 'No-Q', key: 'no_q', width: 10 },
      { header: 'Canonical URL', key: 'canonical_url', width: 45 },
      { header: 'Legacy URL', key: 'legacy_url', width: 42 },
    ],
    deptSummaryRows,
    ['canonical_url', 'legacy_url']
  );

  // Sheet 7: Pagination Audit
  const auditRows = paginationAudit.map((p) => ({
    scope: p.scope || '',
    view: p.view || 'index',
    pages_scraped: p.pagesScraped ?? 0,
    total_pages: p.reportedTotalPages ?? p.effectiveTotalPages ?? '',
    total_records: p.reportedTotalRecords ?? '',
    extracted_count: p.extractedCount ?? 0,
    status: p.emptyVerified
      ? 'Empty (Verified 0)'
      : p.isComplete
        ? 'Complete'
        : 'Partial / Check Warnings',
    warnings: (p.warnings || []).join('; '),
    start_url: p.startUrl || '',
  }));
  const wsAudit = wb.addWorksheet('Pagination_Audit');
  styleWorksheet(
    wsAudit,
    [
      { header: 'Scope', key: 'scope', width: 32 },
      { header: 'View', key: 'view', width: 16 },
      { header: 'Pages Scraped', key: 'pages_scraped', width: 15 },
      { header: 'SINTA Total Pages', key: 'total_pages', width: 18 },
      { header: 'SINTA Total Records', key: 'total_records', width: 20 },
      { header: 'Extracted Records', key: 'extracted_count', width: 18 },
      { header: 'Status', key: 'status', width: 22 },
      { header: 'Warnings', key: 'warnings', width: 40 },
      { header: 'Start URL', key: 'start_url', width: 50 },
    ],
    auditRows,
    ['start_url']
  );

  await wb.xlsx.writeFile(xlsxPath);

  // 4. Export Standalone Interactive HTML Dashboard
  const htmlPath = options.htmlPath || path.join(baseDir, 'sinta_export.html');
  const htmlDashboard = generateInteractiveDashboardHtml({
    affiliation,
    affiliationDepartments,
    departmentProfiles,
    authors: uniqueAuthors,
    uniqueItems,
    contentTables,
    paginationAudit,
    generatedAt: new Date().toISOString(),
  });
  fs.writeFileSync(htmlPath, htmlDashboard, 'utf8');

  return {
    uniqueItemsCount: uniqueItems.length,
    uniqueAuthorsCount: uniqueAuthors.length,
    files: {
      xlsx: xlsxPath,
      csv: csvPath,
      html: htmlPath,
      dataDir,
    },
  };
}

module.exports = {
  deduplicateItems,
  deduplicateAuthors,
  flattenItemForExport,
  generateInteractiveDashboardHtml,
  exportAllFormats,
};
