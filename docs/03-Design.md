# Design — SINTAScraper v1.0 (SDD)

**Versi:** 1.2 — 9 Okt 2026 (Diperbarui berdasarkan Groundtruth 4 File HTML SINTA)  
Sumber: [`docs/02-Requirements.md`](file:///d:/laragon/www/sintascraper/docs/02-Requirements.md) & [`docs/05-Groundtruth-Analysis.md`](file:///d:/laragon/www/sintascraper/docs/05-Groundtruth-Analysis.md)

---

## 1. Keputusan Arsitektur

### 1.1 Diagram Komponen Utama

```
┌────────────────────────────────────────────────────────┐
│                      Orchestrator                      │
│                      src/index.js                      │
└──────┬──────────────────────┬───────────────────┬──────┘
       │                      │                   │
       ▼                      ▼                   ▼
┌──────────────┐       ┌──────────────┐    ┌──────────────┐
│ MCP Adapter  │       │ Data Parsers │    │ Storage &    │
│  src/mcp.js  │       │src/parsers/* │    │   Export     │
└──────┬───────┘       └──────┬───────┘    └──────┬───────┘
       │ CDP                  │                   │
       ▼                      │                   │
┌──────────────┐              │                   ▼
│Chrome Headful│              │            ┌──────────────┐
│  (SINTA Web) │──────────────┘            │SQLite (Items,│
└──────────────┘                           │Authors, Dept)│
                                           └──────┬───────┘
                                                  ▼
                                           ┌──────────────┐
                                           │  Exporters   │
                                           │(XLSX/CSV/HTML│
                                           │ + Local UI)  │
                                           └──────────────┘
```

### 1.2 Justifikasi Pemilihan MCP Chrome DevTools & Headful Browser

1. **Autentikasi Terproteksi:** SINTA membatasi akses data publikasi lengkap di balik sesi login. Penggunaan Chrome headful via CDP (`chrome-devtools`) memungkinkan login otomatis via script sekaligus memberi keleluasaan bagi operator untuk login manual atau menyelesaikan verifikasi langsung di jendela browser.
2. **Manajemen Cookie & Sesi Transparan:** Chrome menangani session cookies dan state secara native tanpa perlu inject header HTTP manual yang rawan invalidasi.
3. **Dual Execution Mode:**
   - **Mode Utama:** Berbasis MCP Protocol (`chrome-devtools`).
   - **Mode Fallback:** Adapter Playwright Headful (`chromium.launch({ headless: false })`) jika lingkungan terminal dijalankan tanpa MCP server daemon.

---

## 2. Struktur Direktori Proyek

```
sintascraper/
├── docs/
│   ├── 01-PRD.md                     # Product Requirement Document
│   ├── 02-Requirements.md            # Software Requirements Specification
│   ├── 03-Design.md                  # Software Design Document (dokumen ini)
│   ├── 04-Tasks.md                   # WBS & Execution Plan
│   └── 05-Groundtruth-Analysis.md    # Temuan analisis 4 file HTML SINTA
├── config/
│   └── departments.json              # Registry prodi (UUID, kode prodi, slug, URL)
├── src/
│   ├── config.js                     # Validasi konfigurasi & URL builder helpers
│   ├── mcp.js                        # Abstraksi browser (navigate, evaluate, snapshot, screenshot)
│   ├── auth.js                       # Login otomatis, wait manual, dan session guard
│   ├── navigator.js                  # Pagination crawler loop (?page=N&view=V)
│   ├── parsers/
│   │   ├── affiliation.js            # Parser profil institusi (/affiliations/profile/2058)
│   │   ├── department.js             # Parser daftar prodi (.row.d-item) & profil prodi
│   │   ├── cards.js                  # Universal parser .ar-list-item (Scopus, IPR, Research, dll)
│   │   ├── author-list.js            # Parser daftar dosen prodi (/departments/authors/...)
│   │   └── author-detail.js          # Parser profil dosen (/authors/profile/{id})
│   ├── store.js                      # SQLite repository (UPSERT idempotent berdasar dedup_key)
│   ├── exporter.js                   # Generator Excel (exceljs), CSV (BOM), dan HTML standalone
│   ├── logger.js                     # Logging terstruktur JSONL + error screenshot handler
│   ├── state.js                      # Checkpoint manager (state.json) untuk fitur resume
│   └── index.js                      # Entrypoint CLI
├── ui/
│   ├── index.html                    # Dashboard interaktif lokal (DataTables / Vanilla JS)
│   └── app.js                        # Logika filter prodi, tahun, quartile, dan search box
├── tests/
│   └── fixtures/                     # Tautan ke 4 file HTML groundtruth sebagai golden unit test
├── data/                             # Direktori data (gitignored)
│   ├── raw/                          # Snapshot HTML mentah per halaman
│   ├── db.sqlite                     # Database SQLite utama
│   ├── exports/                      # Hasil ekspor XLSX, CSV, dan HTML
│   ├── logs/                         # File log JSONL & tangkapan screenshot error
│   └── state.json                    # Checkpoint recovery
├── .env.example                      # Template variabel lingkungan
├── package.json
└── README.md
```

### Konfigurasi Departemen (`config/departments.json`)
Struktur konfigurasi mencatat **kedua format URL** (kanonis UUID dan legacy kode prodi) yang ditemukan pada groundtruth:

```json
{
  "affiliationId": "2058",
  "affiliationCode": "071030",
  "parentKey": "420D8E73-68F0-4044-86CF-5138D1419B20",
  "departments": [
    {
      "slug": "informatika",
      "name": "Teknik Informatika",
      "level": "S1",
      "codeProdi": "55201",
      "id": "8A894EDC-B2F1-4575-95B8-91EB1E708F4F",
      "canonicalUrl": "https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/8A894EDC-B2F1-4575-95B8-91EB1E708F4F/",
      "legacyUrl": "https://sinta.kemdiktisaintek.go.id/departments/profile/2058/071030/55201"
    },
    {
      "slug": "bisnis-digital",
      "name": "Bisnis Digital",
      "level": "S1",
      "codeProdi": "61209",
      "id": "BB930200-F625-4220-BD63-94F4D1FD2E50",
      "canonicalUrl": "https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/BB930200-F625-4220-BD63-94F4D1FD2E50",
      "legacyUrl": "https://sinta.kemdiktisaintek.go.id/departments/profile/2058/071030/61209"
    },
    {
      "slug": "sti",
      "name": "Sistem dan Teknologi Informasi",
      "level": "S1",
      "codeProdi": "59201",
      "id": "895FD91B-B0F2-41E7-99EB-F2D3997A9B0F",
      "canonicalUrl": "https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/895FD91B-B0F2-41E7-99EB-F2D3997A9B0F",
      "legacyUrl": "https://sinta.kemdiktisaintek.go.id/departments/profile/2058/071030/59201"
    }
  ]
}
```

---

## 3. Alur Kerja & Diagram Sekuensial

### 3.1 Alur Autentikasi & Session Guard

```
Orchestrator                 MCP / Browser                   SINTA Server
     │                            │                               │
     ├────── navigate(/logins) ──►│ ────── GET /logins ──────────►│
     │                            │ ◄───── HTML Login Page ───────┤
     │                            │                               │
     ├── [Kredensial Ada di .env] │                               │
     │   fill username, password  │                               │
     │   click submit button ────►│ ────── POST /logins ─────────►│
     │                            │                               │
     ├── [Mode Login Manual] ─────┤                               │
     │   cetak prompt terminal,   │                               │
     │   operator isi form di UI  │                               │
     │                            │                               │
     ├── Loop Polling (2s s.d 120s)                               │
     │   evaluasi URL & cek:      │                               │
     │   a.dropdown-item[href$="/logins/logout"]                  │
     │                            │ ◄───── Redirection / ─────────┤
     │◄─ Login Berhasil (SYAHRONI)┤                               │
     │                            │                               │
     │=== [Session Guard di Setiap Request Data] =================│
     │   Sebelum fetch data, cek keberadaan tombol logout         │
     │   Jika redirect ke /logins:                                │
     │   Picu re-login otomatis 1x ──► Ulangi navigasi target     │
```

### 3.2 Alur Scraping Berbasis Pagination (`?page=N&view=V`)

```
Orchestrator                 Browser                          SQLite DB
     │                          │                                 │
     ├─ navigate(?page=1&view=V)┤                                 │
     │◄─ DOM Loaded ────────────┤                                 │
     │                          │                                 │
     ├─ parsePaginationInfo() ──┤                                 │
     │  "Page 1 of Y | Records Z"                                 │
     │                          │                                 │
     ├── Loop page = 1 s.d Y:   │                                 │
     │   ├─ [Jika page > 1]:    │                                 │
     │   │  navigate(?page=N...)┤                                 │
     │   │                      │                                 │
     │   ├─ extractCards() ─────┤ (ambil seluruh .ar-list-item)   │
     │   │                      │                                 │
     │   ├─ parseArListItem() ──┤ (klasifikasikan Scopus/IPR/dll) │
     │   │                      │                                 │
     │   ├─ computeDedupKey() ──┤                                 │
     │   │                      │                                 │
     │   └─ upsertItem() ───────┼────────────────────────────────►│
     │                          │                                 │
     ├─ update state.json ──────┤ (catat last_dept, last_view)    │
     └─ Jeda rate-limit (2.5s) ─┘                                 │
```

---

## 4. Strategi Parser & Selector Presisi

### 4.1 Universal Record Parser (`parseArListItem`)
Dijalankan di konteks browser (`browser_evaluate`) atau Cheerio saat memproses DOM:

```javascript
import crypto from 'crypto';

function cleanText(el) {
  if (!el) return null;
  return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
}

export function parseArListItem(el, context = {}) {
  const titleA = el.querySelector('.ar-title a');
  const title = cleanText(titleA);
  const detailUrl = titleA ? titleA.getAttribute('href') : null;
  const isExternal = titleA && titleA.getAttribute('target') === '_blank';

  // Ekstrak meta links
  const metas = Array.from(el.querySelectorAll('.ar-meta a'));
  const metaMap = {};

  let quartile = null;
  let journal = null;
  let journalUrl = null;
  let creator = null;
  let leader = null;
  let inventor = null;
  let authorOrder = null;
  let year = null;
  let cited = null;
  let fundRp = null;
  let status = null;
  let source = null;
  let nomorPermohonan = null;
  let iprType = null;
  const personilNames = [];
  const personilIds = [];

  metas.forEach(a => {
    const txt = cleanText(a);
    const href = a.getAttribute('href') || '';
    const cls = a.className || '';

    // Deteksi quartile
    if (cls.includes('ar-quartile')) {
      if (/Q[1-4]|no-Q/i.test(txt)) quartile = txt;
      else if (/Rp\./i.test(txt)) fundRp = txt;
      else if (/Approved|Submitted/i.test(txt)) status = txt;
      else if (/INTERNAL|EXTERNAL/i.test(txt)) source = txt;
      else if (/Hak Cipta|Paten/i.test(txt)) iprType = txt;
    }

    // Deteksi publikasi / penerbit / skema
    if (cls.includes('ar-pub')) {
      journal = txt;
      if (href.startsWith('http') && !href.includes('sinta')) {
        journalUrl = href;
      }
    }

    // Deteksi tahun
    if (cls.includes('ar-year')) {
      const matchYear = txt.match(/\b(19|20)\d{2}\b/);
      if (matchYear) year = parseInt(matchYear[0]);
    }

    // Deteksi sitasi atau nomor permohonan
    if (cls.includes('ar-cited')) {
      const matchCited = txt.match(/(\d+)\s*cited/i);
      if (matchCited) cited = parseInt(matchCited[1]);
      const matchPermohonan = txt.match(/Nomor Permohonan\s*:\s*(\S+)/i);
      if (matchPermohonan) nomorPermohonan = matchPermohonan[1];
    }

    // Prefix labels
    if (txt.startsWith('Leader :')) leader = txt.replace('Leader :', '').trim();
    if (txt.startsWith('Creator :')) creator = txt.replace('Creator :', '').trim();
    if (txt.startsWith('Inventor :')) inventor = txt.replace('Inventor :', '').trim();
    if (txt.startsWith('Author Order :')) authorOrder = txt.replace('Author Order :', '').trim();

    // Link Personil Dosen pada Riset
    if (href.includes('/authors/profile/')) {
      const authorMatch = href.match(/\/authors\/profile\/(\d+)/);
      if (authorMatch) {
        personilIds.push(parseInt(authorMatch[1]));
        personilNames.push(txt);
      }
    }
  });

  // Ekstrak Scopus EID bila ada
  let scopusEid = null;
  if (detailUrl && detailUrl.includes('scopus.com')) {
    const eidMatch = detailUrl.match(/eid=([a-zA-Z0-9\-\.]+)/);
    if (eidMatch) scopusEid = eidMatch[1];
  }

  // Bangun Composite Dedup Key
  let dedupKey;
  if (scopusEid) {
    dedupKey = `scopus:${scopusEid}`;
  } else if (nomorPermohonan) {
    dedupKey = `iprs:${nomorPermohonan}`;
  } else {
    const rawKey = `${title}_${year || 0}_${leader || inventor || creator || ''}`;
    const hash = crypto.createHash('md5').update(rawKey).digest('hex').substring(0, 16);
    dedupKey = `${context.view || 'item'}:${hash}`;
  }

  return {
    dedup_key: dedupKey,
    title,
    detail_url: detailUrl,
    is_external: isExternal,
    scopus_eid: scopusEid,
    quartile,
    journal,
    journal_url: journalUrl,
    creator,
    leader,
    inventor,
    author_order: authorOrder,
    year,
    cited,
    fund_rp: fundRp,
    status,
    source,
    nomor_permohonan: nomorPermohonan,
    ipr_type: iprType,
    personil_names: personilNames,
    personil_ids: personilIds,
    author_id: context.authorId || null,
    dept_id: context.deptId || null,
    dept_name: context.deptName || null,
    view: context.view || null,
    sinta_source_url: context.currentUrl || null,
    scraped_at: new Date().toISOString()
  };
}
```

### 4.2 Parser Baris Departemen (`.row.d-item`)
Digunakan untuk mengekstrak data dari `/affiliations/departments/2058/071030`:

```javascript
export function parseDepartmentRow(el) {
  const level = cleanText(el.querySelector('.tbl-content-meta span'));
  const nameA = el.querySelector('.tbl-content-name > a');
  const name = cleanText(nameA);
  const canonicalUrl = nameA ? nameA.getAttribute('href') : null;
  const codeProdi = cleanText(el.querySelector('.tbl-content-meta-num'));
  const legacyA = el.querySelector('.tbl-content-action a');
  const legacyUrl = legacyA ? legacyA.getAttribute('href') : null;

  // Preview dosen prodi
  const previewAuthors = Array.from(el.querySelectorAll('ul.au-list.dept-list li')).map(li => {
    const a = li.querySelector('a');
    const href = a ? a.getAttribute('href') : '';
    const match = href.match(/\/authors\/profile\/(\d+)/);
    return {
      sinta_id: match ? parseInt(match[1]) : null,
      name: li.getAttribute('data-original-title') || null
    };
  }).filter(item => item.sinta_id !== null);

  // Ekstrak UUID prodi dari canonical URL
  const uuidMatch = canonicalUrl ? canonicalUrl.match(/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/) : null;

  return {
    id: uuidMatch ? uuidMatch[0] : null,
    name,
    level,
    code_prodi: codeProdi,
    canonical_url: canonicalUrl,
    legacy_url: legacyUrl,
    preview_authors: previewAuthors
  };
}
```

### 4.3 Parser Header & Statistik Profil Dosen (`/authors/profile/{id}`)

```javascript
export function parseAuthorProfile(document) {
  const nameA = document.querySelector('.content-box h3 a');
  const name = cleanText(nameA);
  const isVerified = !!document.querySelector('.content-box h3 i.el-ok-sign');
  
  const textBody = document.body.innerText || '';
  const sintaIdMatch = textBody.match(/SINTA ID\s*:\s*(\d+)/i);
  const sintaId = sintaIdMatch ? parseInt(sintaIdMatch[1]) : null;

  const affilA = document.querySelector('.meta-profile a[href*="/affiliations/profile/"]');
  const affiliation = cleanText(affilA);

  const deptA = document.querySelector('.meta-profile a[href*="/departments/profile/"]');
  const studyProgram = cleanText(deptA);

  // Subject tags
  const subjects = Array.from(document.querySelectorAll('ul.subject-list li a'))
    .map(cleanText)
    .filter(Boolean);

  // Scores (.pr-num & .pr-txt)
  const scoreCards = Array.from(document.querySelectorAll('.profile-score .col, .pr-card'));
  const scores = {};
  scoreCards.forEach(c => {
    const num = cleanText(c.querySelector('.pr-num'));
    const txt = cleanText(c.querySelector('.pr-txt'));
    if (txt && num) {
      if (/Overall/i.test(txt)) scores.overall = parseFloat(num);
      if (/3Yr/i.test(txt) && !/Affil/i.test(txt)) scores.three_year = parseFloat(num);
      if (/Affil/i.test(txt) && !/3Yr/i.test(txt)) scores.affil = parseFloat(num);
      if (/Affil 3Yr/i.test(txt)) scores.affil_three_year = parseFloat(num);
    }
  });

  // Summary Table (.stat-table)
  const summary = { scopus: {}, google_scholar: {}, wos: {} };
  const statRows = Array.from(document.querySelectorAll('.stat-table tbody tr'));
  statRows.forEach(tr => {
    const cells = Array.from(tr.querySelectorAll('td, th')).map(cleanText);
    if (cells.length >= 4) {
      const metric = cells[0].toLowerCase().replace(/\s+/g, '_');
      summary.scopus[metric] = parseInt(cells[1]) || 0;
      summary.google_scholar[metric] = parseInt(cells[2]) || 0;
      summary.wos[metric] = parseInt(cells[3]) || 0;
    }
  });

  return {
    sinta_id: sintaId,
    name,
    is_verified: isVerified,
    affiliation,
    study_program: studyProgram,
    subjects,
    scores,
    summary,
    scraped_at: new Date().toISOString()
  };
}
```

### 4.4 Parser Informasi Pagination

```javascript
export function parsePaginationInfo(document) {
  const textEl = document.querySelector('.pagination-text small');
  if (!textEl) {
    return { currentPage: 1, totalPages: 1, totalRecords: 0 };
  }
  const text = textEl.textContent.trim();
  const match = text.match(/Page\s+(\d+)\s+of\s+(\d+)\s*\|\s*Total Records\s+(\d+)/i);
  if (!match) {
    return { currentPage: 1, totalPages: 1, totalRecords: 0 };
  }
  return {
    currentPage: parseInt(match[1]),
    totalPages: parseInt(match[2]),
    totalRecords: parseInt(match[3])
  };
}
```

---

## 5. Skema Database SQLite (`data/db.sqlite`)

```sql
-- Affiliations
CREATE TABLE IF NOT EXISTS affiliations (
  id TEXT PRIMARY KEY,               -- "2058"
  code TEXT,                         -- "071030"
  name TEXT NOT NULL,
  city TEXT,
  sinta_score_overall REAL,
  sinta_score_3yr REAL,
  productivity REAL,
  authors_count INTEGER,
  departments_count INTEGER,
  journals_count INTEGER,
  raw_json TEXT,
  scraped_at TEXT
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,               -- UUID misal "8A894EDC-..."
  code_prodi TEXT,                   -- "55201"
  affiliation_id TEXT,
  parent_key TEXT,
  slug TEXT,
  name TEXT NOT NULL,
  level TEXT,                        -- "S1"
  canonical_url TEXT,
  legacy_url TEXT,
  authors_count INTEGER,
  sinta_score TEXT,                  -- JSON string
  preview_authors TEXT,              -- JSON string daftar preview dosen
  raw_json TEXT,
  scraped_at TEXT,
  FOREIGN KEY (affiliation_id) REFERENCES affiliations(id)
);

-- Authors (Dosen)
CREATE TABLE IF NOT EXISTS authors (
  sinta_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  is_verified INTEGER DEFAULT 0,
  affiliation TEXT,
  study_program TEXT,
  nidn TEXT,
  subjects TEXT,                     -- JSON array ["Text Mining", "AI"]
  scores TEXT,                       -- JSON string
  summary TEXT,                      -- JSON string matrix Scopus/GS/WOS
  profile_url TEXT,
  avatar_url TEXT,
  raw_json TEXT,
  scraped_at TEXT
);

-- Many-to-Many Relasi Dosen & Prodi
CREATE TABLE IF NOT EXISTS author_dept (
  sinta_id INTEGER,
  dept_id TEXT,
  PRIMARY KEY (sinta_id, dept_id),
  FOREIGN KEY (sinta_id) REFERENCES authors(sinta_id),
  FOREIGN KEY (dept_id) REFERENCES departments(id)
);

-- Items (Tabel Utama Rekapitulasi Publikasi, HKI, Riset, & Pengabdian)
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedup_key TEXT NOT NULL,           -- "scopus:2-s2.0-..." atau "iprs:EC..." atau "researches:hash"
  view TEXT NOT NULL,                -- scopus | garuda | googlescholar | researches | services | iprs | books | wos | rama
  dept_id TEXT,
  author_id INTEGER,                -- ID dosen jika discrape via profil individual
  title TEXT NOT NULL,
  detail_url TEXT,
  scopus_eid TEXT,
  quartile TEXT,
  journal TEXT,
  journal_url TEXT,
  creator TEXT,
  leader TEXT,
  inventor TEXT,
  author_order TEXT,
  year INTEGER,
  cited INTEGER,
  fund_rp TEXT,
  status TEXT,
  source TEXT,
  nomor_permohonan TEXT,
  ipr_type TEXT,
  personil_names TEXT,               -- JSON array nama anggota
  personil_ids TEXT,                 -- JSON array SINTA ID anggota
  sinta_source_url TEXT,
  scraped_at TEXT,
  UNIQUE(view, dedup_key)            -- Mencegah duplikasi data secara konsisten
);

-- Indeks Performa Query
CREATE INDEX IF NOT EXISTS idx_items_view_year ON items(view, year);
CREATE INDEX IF NOT EXISTS idx_items_dept ON items(dept_id);
CREATE INDEX IF NOT EXISTS idx_items_author ON items(author_id);
CREATE INDEX IF NOT EXISTS idx_items_scopus_eid ON items(scopus_eid);
```

---

## 6. Strategi Ekspor Data

### 6.1 Workbook Excel (`exceljs`)
- **Struktur Sheet:**
  - `Scopus` — Publikasi Scopus lengkap dengan Kolom Quartile, Sitasi, Author Order, dan Hyperlink Dokumen Asli.
  - `Garuda` — Publikasi Jurnal Garuda.
  - `Google Scholar` — Publikasi Google Scholar.
  - `Researches` — Riset dosen, Skema, Ketua, Anggota (Personil SINTA), Pendanaan Rupiah, dan Status Approval.
  - `Community Services` — Pengabdian masyarakat.
  - `IPRs` — HKI Hak Cipta & Paten beserta Nomor Permohonan resmi.
  - `Books` — Rekapitulasi buku & ISBN.
  - `Authors` — Daftar lengkap dosen institusi beserta skor SINTA dan bidang keahlian.
  - `META` — Log ringkasan audit: Akun operator, waktu eksekusi, total baris per view, dan URL sumber.
- **Formating Rules:** Baris pertama di-freeze, autofilter aktif pada seluruh header, kolom URL diisi formula `=HYPERLINK(url, "Buka Tautan")`.

### 6.2 File CSV (Standar Excel Indonesia)
- Encoding: UTF-8 dengan BOM (`\uFEFF`).
- Delimiter: Titik koma (`;`).
- Nilai teks diapit tanda petik jika memuat delimiter `;` atau newline.

### 6.3 Halaman Web Interaktif Lokal (`ui/index.html`)
- Menggunakan CSS inline modern yang responsif tanpa CDN eksternal.
- Fitur pencarian instan klien, dropdown filter tahun dan prodi, serta sorting interaktif.

---

## 7. State Management & Pemulihan Checkpoint (`state.json`)

```json
{
  "run_id": "run_20261009_114000",
  "started_at": "2026-10-09T11:40:00+07:00",
  "login_status": "success",
  "account_name": "SYAHRONI",
  "completed_phases": ["affiliation", "departments"],
  "departments_progress": {
    "informatika": {
      "scopus": { "status": "done", "records": 42, "pages": 5 },
      "researches": { "status": "in_progress", "records": 10, "current_page": 2, "pages": 4 }
    }
  },
  "authors_progress": {
    "total": 35,
    "last_processed_sinta_id": 259792
  },
  "errors": []
}
```

Jika scraping terputus (misalnya koneksi putus atau proses di-kill), eksekusi berikutnya akan membaca `state.json` dan melanjutkan crawl dari halaman view prodi yang belum berstatus `"done"`.

---

## 8. Strategi Pengujian Golden Fixture

Pengujian unit parser dijalankan menggunakan 4 file HTML groundtruth aktual di root repository tanpa memerlukan koneksi jaringan:

| File Fixture | Target Validasi Parser | Ekspektasi Hasil Uji |
|---|---|---|
| `SINTA - Science and Technology Index-DepartmentProfile.html` | `parseArListItem()` & `parsePaginationInfo()` | 1 record IPR ("Logo Bebras-Biro UWG", EC002024234761, Hak Cipta 2024), Total Records = 1 |
| `SINTA - Science and Technology Index-Affiliation.html` | `parseDepartmentRow()` | Row prodi STI terdeteksi, Kode Prodi = 59201, Canonical UUID ter-resolve, Preview 2 dosen |
| `SINTA - Science and Technology Index-AuthorResearch.html` | `parseArListItem()` (Researches) | 9 records riset, Record 1: Leader "Syahroni Wahyu Iriananda", Personils "Hanif Rani Iswari (6738705)", Dana "Rp. 4.000.000", Status "Approved" |
| `SINTA - Science and Technology Index-AuthorsProfile.html` | `parseAuthorProfile()` & `parseArListItem()` (Scopus) | Profil SINTA ID 259792, Scopus item: EID `2-s2.0-105029558167`, Author Order `0 of 5`, Quartile `no-Q`, Tab WOS terdeteksi (`d-none`) |
