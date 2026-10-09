# Tasks — SINTAScraper v1.0 (Backlog Eksekusi & WBS)

**Versi:** 1.2 — 9 Okt 2026 (Diperbarui berdasarkan Groundtruth 4 File HTML SINTA)  
Sumber: [`docs/03-Design.md`](file:///d:/laragon/www/sintascraper/docs/03-Design.md) & [`docs/05-Groundtruth-Analysis.md`](file:///d:/laragon/www/sintascraper/docs/05-Groundtruth-Analysis.md)  
Semua tugas diurutkan berdasarkan dependensi logis. Centang `[x]` jika tugas telah selesai.

---

## Dependency Graph

```
EPIC 0 (Setup & Fixtures)
  └──► EPIC 1 (Auth & Session Guard)
         └──► EPIC 2 (Affiliation & Departments)
                └──► EPIC 3 (Views Scraping via Pagination) ◄── Paralel per view (T3.3a–h)
                │      └──► EPIC 5 (Penyimpanan, Tabel & Ekspor)
                └──► EPIC 4 (Authors Profil & Sub-Views)
                       └──► EPIC 5 (Penyimpanan, Tabel & Ekspor)
                              └──► EPIC 6 (Hardening & Release)
```

---

## EPIC 0 — Project Setup & Golden Fixtures ⏱ 2.0 hari

### T0.1 — Inisialisasi Project & Dependensi ⏱ 0.5d
- [ ] Inisialisasi `package.json` (`npm init -y`) dengan ESM module (`"type": "module"`).
- [ ] Install dependensi inti:
  - Runtime & DB: `dotenv`, `better-sqlite3`
  - Ekspor: `exceljs`, `csv-stringify`
  - HTML Parsing (opsional/offline test): `cheerio`
- [ ] Buat `.gitignore` yang memuat `.env`, `data/`, `.chrome-profile/`, `node_modules/`.
- [ ] Pastikan `.env.example` sinkron dengan konfigurasi 3 prodi FT UWG.
- [ ] Buat file `config/departments.json` yang memuat UUID kanonis dan kode prodi legacy (`55201`, `61209`, `59201`).
- [ ] Setup struktur direktori lengkap: `src/`, `src/parsers/`, `ui/`, `data/{raw,exports,logs}/`.
- **DoD:** `npm install` berhasil tanpa error, struktur folder siap.

### T0.2 — Setup Golden Fixture Test dari 4 File HTML ⏱ 0.5d
- [ ] Hubungkan 4 file HTML groundtruth aktual di root sebagai test fixtures:
  1. `SINTA - Science and Technology Index-Affiliation.html`
  2. `SINTA - Science and Technology Index-DepartmentProfile.html`
  3. `SINTA - Science and Technology Index-AuthorResearch.html`
  4. `SINTA - Science and Technology Index-AuthorsProfile.html`
- [ ] Buat runner test sederhana (`npm test` via node native test runner / `node tests/parsers.test.js`) untuk memverifikasi parser terhadap fixture offline.
- **DoD:** Test suite dapat membaca file HTML fixture dan mengeksekusi assertion awal.

### T0.3 — Abstraksi Browser & MCP Adapter (`src/mcp.js`) ⏱ 0.5d
- [ ] Implementasikan wrapper browser seragam:
  - `navigate(url)`
  - `evaluate(fn, ...args)`
  - `waitForSelector(selector, timeout)`
  - `fill(selector, text)`
  - `click(selector)`
  - `screenshot(filePath)`
  - `scrollToBottom()`
- [ ] Sediakan adapter ganda: MCP Chrome DevTools (utama) dan Playwright Chromium headful (fallback offline).
- **DoD:** Script test dapat membuka Chrome, bernavigasi ke URL, dan mengambil screenshot.

### T0.4 — Config Loader & Helper URL (`src/config.js`) ⏱ 0.5d
- [ ] Load konfigurasi dari `.env` dengan validasi nilai wajib (`SINTA_BASE`, `AFFILIATION_ID`).
- [ ] Helper pembangun URL:
  - `buildDeptProfileUrl(deptId, page, view)`
  - `buildDeptAuthorsUrl(deptId)`
  - `buildAuthorProfileUrl(sintaId, page, view)`
- **DoD:** `node src/config.js` mencetak URL kanonis yang valid untuk 3 prodi target.

---

## EPIC 1 — Autentikasi & Session Guard (F0) ⏱ 1.5 hari

### T1.1 — Auto-Fill & Login Form (`src/auth.js :: login()`) ⏱ 0.5d
- [ ] Navigasi ke `https://sinta.kemdiktisaintek.go.id/logins`.
- [ ] Jika kredensial `.env` ada: otomatis isi form username & password, lalu submit form.
- [ ] Jika kredensial kosong atau `--manual-login`: tampilkan panduan di console terminal dan tunggu operator login mandiri.
- [ ] Mask kredensial password di semua log file / console output (`***`).
- **DoD:** Form login tersubmit atau terminal siap menunggu aksi operator.

### T1.2 — Verifikasi Sukses Login (`src/auth.js :: waitForLogin()`) ⏱ 0.5d
- [ ] Polling status setiap 2 detik (timeout 120 detik).
- [ ] Indikator login sukses: URL beralih ke beranda/profil **DAN** selector `a.dropdown-item[href$="/logins/logout"]` terdeteksi di DOM beserta nama akun (misal `SYAHRONI`).
- [ ] Jika timeout tercapai: tangkap screenshot `data/logs/err_login_timeout.png` dan lempar error `LOGIN_TIMEOUT`.
- **DoD:** Login otomatis dan manual terdeteksi dengan tepat; screenshot error tercipta jika timeout.

### T1.3 — Session Guard & Auto Re-Login (`src/auth.js :: sessionGuard()`) ⏱ 0.5d
- [ ] Hook pemeriksaan sesi sebelum setiap navigasi halaman data.
- [ ] Deteksi pemutusan sesi: URL ter-redirect ke `/logins` atau selector logout hilang.
- [ ] Jika sesi terputus: lakukan auto re-login 1x dan ulangi request URL terakhir.
- **DoD:** Simulasi redirect login berhasil memicu re-login dan melanjutkan crawling.

---

## EPIC 2 — Affiliation & Indeks Departemen (F1–F5) ⏱ 2.0 hari

### T2.1 — Parser Profil Afiliasi (`src/parsers/affiliation.js`) ⏱ 0.5d
- [ ] Kunjungi `/affiliations/profile/2058`.
- [ ] Ekstrak: Nama institusi, Kota, SINTA Score Overall / 3Yr, Productivity, total counts (Authors, Departments, Journals).
- [ ] Ekstrak tabel riset: Scopus, GScholar, WOS, Garuda (Documents, Citations, Cited Docs).
- [ ] Simpan ke SQLite tabel `affiliations` dan file `data/affiliation.json`.
- **DoD:** Data profil UWG tersimpan lengkap di SQLite dan JSON.

### T2.2 — Parser Indeks Departemen (`src/parsers/department.js`) ⏱ 0.5d
- [ ] Kunjungi `/affiliations/departments/2058/071030`.
- [ ] Parse baris `.row.d-item`:
  - Jenjang (`.tbl-content-meta span`)
  - Nama & Canonical URL (`.tbl-content-name a`)
  - Kode Prodi (`.tbl-content-meta-num`)
  - Legacy URL (`.tbl-content-action a`)
  - Preview dosen (`ul.au-list.dept-list li[data-original-title] > a[href*="/authors/profile/"]`)
- [ ] Simpan/update data ke SQLite tabel `departments` dan `config/departments.json`.
- [ ] Unit test parser dengan file fixture `SINTA - Science and Technology Index-Affiliation.html`.
- **DoD:** Data 3 prodi target (Informatika, Bisnis Digital, STI) terpetakan dengan kode prodi dan URL yang tepat.

### T2.3 — Crawl Header 3 Prodi Target ⏱ 0.5d
- [ ] Kunjungi halaman profil untuk 3 departemen target:
  - Teknik Informatika (`8A894EDC-...`)
  - Bisnis Digital (`BB930200-...`)
  - Sistem dan Teknologi Informasi (`895FD91B-...`)
- [ ] Ekstrak header prodi: Kode prodi, Kode PT, jumlah dosen, skor SINTA, serta matriks perbandingan publikasi Scopus & GS dari `.stat-table`.
- [ ] Perbarui baris tabel `departments` di SQLite.
- **DoD:** Data header 3 prodi terisi lengkap.

### T2.4 — Golden Fixture Test EPIC 2 ⏱ 0.5d
- [ ] Verifikasi parser departemen terhadap fixture HTML afiliasi.
- [ ] Assertion: Prodi STI terdeteksi dengan kode prodi `59201`, jenjang `S1`, dan 2 preview dosen.
- **DoD:** Semua assertion EPIC 2 lulus pada unit test.

---

## EPIC 3 — Scraping Publikasi & Kinerja per View (F6–F12) ⏱ 5.0 hari

### T3.1 — Universal Record Parser (`src/parsers/cards.js`) ⏱ 1.0d
- [ ] Implementasikan fungsi `parseArListItem(el, context)` sesuai spesifikasi Design §4.1:
  - Seleksi `.profile-article .ar-list-item`.
  - Ekstrak judul & atribut link (`.ar-title a`, `target="_blank"`, Scopus EID).
  - Klasifikasi `.ar-meta`: `.ar-quartile`, `.ar-pub`, `.ar-year`, `.ar-cited`.
  - Parsing prefix teks: `Leader :`, `Personils :`, `Creator :`, `Inventor :`, `Author Order :`, `Nomor Permohonan :`, `Rp.`, `Approved`, `INTERNAL/EXTERNAL`.
  - Ekstrak link personil dosen (`a[href*="/authors/profile/"]`).
  - Generate `dedup_key` unik komposit (`scopus:${eid}`, `iprs:${nomorPermohonan}`, atau `${view}:${hash}`).
- [ ] Unit test dengan file fixture:
  - `SINTA - Science and Technology Index-DepartmentProfile.html` (IPR)
  - `SINTA - Science and Technology Index-AuthorResearch.html` (Riset)
  - `SINTA - Science and Technology Index-AuthorsProfile.html` (Scopus)
- **DoD:** Ketiga fixture berhasil di-parse dengan akurasi 100% pada field kunci.

### T3.2 — Navigator Pagination Loop (`src/navigator.js`) ⏱ 1.0d
- [ ] Implementasikan alur scraping berbasis pagination:
  1. Akses halaman awal `?page=1&view={key}`.
  2. Ekstrak informasi halaman via `parsePaginationInfo()` (`Page X of Y | Total Records Z`).
  3. Validasi assertion: jika `Total Records > 0`, maka jumlah item ter-parse wajib `> 0`.
  4. Lakukan loop request `page = 1..totalPages` untuk mengambil seluruh halaman.
  5. Fallback: klik "View more ..." hanya jika pagination bar tidak ditemukan.
- [ ] Simpan snapshot HTML mentah per halaman ke `data/raw/{dept_slug}/{view}/page_{N}.html`.
- [ ] Upsert record ter-parse ke SQLite melalui `src/store.js`.
- [ ] Perbarui checkpoint di `state.json`.
- **DoD:** Navigator mampu meng-crawl seluruh halaman sebuah view hingga selesai.

### T3.3 — Implementasi Spesifik per View ⏱ 2.0d

#### T3.3a — Scopus (`?view=scopus`)
- [ ] Ambil: Title, detail URL Scopus, Scopus EID, Quartile, Journal, Author Order, Creator, Year, Cited count.
- [ ] Simpan ke DB dengan `dedup_key = "scopus:" + eid`.

#### T3.3b — Researches (`?view=researches`)
- [ ] Ambil: Title, Leader, Skema, Personil names & SINTA IDs, Year, Dana (Rp), Status approval, Sumber dana.
- [ ] Simpan ke DB dengan relasi personil.

#### T3.3c — IPRs / Hak Cipta (`?view=iprs`)
- [ ] Ambil: Title, Inventor, Pemegang hak cipta, Year, Nomor Permohonan (`EC...`), Jenis HKI (`Hak Cipta`/`Paten`).
- [ ] Simpan ke DB dengan `dedup_key = "iprs:" + nomorPermohonan`.

#### T3.3d — Community Services (`?view=services`)
- [ ] Ambil data pengabdian masyarakat (struktur identik dengan Researches).

#### T3.3e — Books (`?view=books`)
- [ ] Ambil: Title, Penulis, Penerbit, ISBN, Year.

#### T3.3f — Garuda & Google Scholar (`?view=garuda`, `?view=googlescholar`)
- [ ] Ambil artikel jurnal nasional dan publikasi Scholar beserta sitasinya.

#### T3.3g — WOS & View Tambahan (`?view=wos`, `?view=rama`, dll)
- [ ] Ekstrak publikasi Web of Science (tetap di-scrape meski tab ber-class `d-none`).

### T3.4 — Verifikasi & QA Views ⏱ 1.0d
- [ ] Crawl seluruh view untuk 3 prodi target.
- [ ] Verifikasi jumlah baris di database sama persis dengan `Total Records` di portal SINTA.
- [ ] Pastikan tidak ada record terduplikasi di SQLite.
- **DoD:** 3 prodi × seluruh view ter-scrape 100% tervalidasi.

---

## EPIC 4 — Authors (Profil Dosen & Sub-Views) (F13–F15) ⏱ 3.0 hari

### T4.1 — Parser Daftar Dosen Prodi (`src/parsers/author-list.js`) ⏱ 0.5d
- [ ] Akses `/departments/authors/2058/420D8E73-.../{deptId}` untuk 3 prodi target.
- [ ] Ekstrak daftar dosen: `sinta_id`, nama dosen, NIDN, prodi, skor SINTA, URL profil.
- [ ] Simpan data dosen ke SQLite `authors` dan petakan relasi ke `author_dept`.
- **DoD:** Seluruh dosen dari 3 prodi terdaftar di database.

### T4.2 — Parser Detail Profil Dosen (`src/parsers/author-detail.js`) ⏱ 1.0d
- [ ] Implementasikan `parseAuthorProfile()` sesuai Design §4.3:
  - Header dosen, status verifikasi (`i.el-ok-sign`), SINTA ID.
  - Bidang keahlian dari `ul.subject-list li a`.
  - Skor SINTA (Overall, 3Yr, Affil, Affil 3Yr).
  - Matriks ringkasan publikasi dari `.stat-table` (Scopus, Google Scholar, WOS).
- [ ] Uji unit test dengan fixture `SINTA - Science and Technology Index-AuthorsProfile.html`.
- **DoD:** Profil dosen 259792 ter-parse akurat 100% pada unit test.

### T4.3 — Crawl Sub-Views Publikasi Dosen ⏱ 1.0d
- [ ] Loop setiap dosen terdaftar: crawl sub-views (`scopus`, `researches`, `iprs`, dll).
- [ ] Gunakan kembali `parseArListItem()` dengan mengaitkan `author_id` dan `author_order`.
- [ ] Simpan item publikasi ke SQLite `items`.
- **DoD:** Publikasi individual dosen terhubung dengan profil dosen di database.

### T4.4 — QA Authors Flow ⏱ 0.5d
- [ ] Validasi konsistensi relasi `author_dept` dan data publikasi dosen.
- [ ] Pastikan tidak terjadi redudansi penyimpanan dosen yang mengajar di banyak prodi.
- **DoD:** Seluruh data dosen dan publikasinya terverifikasi valid.

---

## EPIC 5 — Penyimpanan SQLite, Tabel Interaktif & Ekspor (F16) ⏱ 3.0 hari

### T5.1 — SQLite Store & Repository (`src/store.js`) ⏱ 0.5d
- [ ] Inisialisasi skema database sesuai Design §5 (`affiliations`, `departments`, `authors`, `author_dept`, `items`).
- [ ] Implementasikan operasi idempotent `upsertItem()` menggunakan constraint `ON CONFLICT(view, dedup_key) DO UPDATE`.
- [ ] Siapkan helper kueri untuk filtering berdasarkan tahun, prodi, view, dan quartile.
- **DoD:** Operasi insert/update SQLite berjalan cepat dan bebas duplikasi.

### T5.2 — Generator Ekspor Excel (`src/exporter.js :: exportXlsx()`) ⏱ 1.0d
- [ ] Implementasikan pembuatan workbook Excel menggunakan `exceljs`:
  - Sheet terpisah per view (`Scopus`, `Researches`, `IPRs`, `Authors`, dll).
  - Sheet `META` berisi ringkasan proses audit (akun, waktu, sumber data).
  - Freeze baris header pertama dan aktifkan autofilter di semua kolom.
  - Ubah kolom link URL menjadi formula hyperlink aktif `=HYPERLINK(url, "Buka Tautan")`.
  - Auto-fit lebar kolom secara proporsional.
- [ ] Sediakan opsi ekspor per prodi dan file master gabungan (`sinta_rekap_all_{timestamp}.xlsx`).
- **DoD:** File XLSX dapat dibuka tanpa error di Excel dan seluruh tautan berfungsi.

### T5.3 — Generator Ekspor CSV & HTML Standalone ⏱ 0.5d
- [ ] Ekspor CSV: Encoding UTF-8 dengan BOM (`\uFEFF`), delimiter titik koma (`;`).
- [ ] Ekspor HTML: Halaman tabel mandiri dengan inline CSS, semantik `<table>` + `<caption>` metadata, siap dibuka tanpa koneksi internet/CDN.
- **DoD:** File CSV rapi saat dibuka di Excel regional Indonesia; HTML render sempurna offline.

### T5.4 — Dashboard Tabel Interaktif Lokal (`ui/index.html`) ⏱ 1.0d
- [ ] Bangun antarmuka web lokal responsif di `ui/index.html` dan `ui/app.js`.
- [ ] Fitur pencarian instan (instant full-text search).
- [ ] Dropdown filter: Program Studi, Tahun, View, dan Quartile Scopus.
- [ ] Pengurutan tabel interaktif (click header to sort) dan pagination responsif.
- [ ] Tombol download instan (XLSX, CSV, HTML) langsung dari antarmuka.
- **DoD:** Antarmuka web lokal berjalan lancar dan interaktif.

---

## EPIC 6 — Hardening, Dokumentasi & Rilis ⏱ 1.5 hari

### T6.1 — Mekanisme Ketahanan & Rate Limiting ⏱ 0.5d
- [ ] Jeda navigasi dinamis 2.000–3.500 ms + random jitter 500 ms antar request.
- [ ] Mekanisme retry otomatis 3x dengan exponential backoff saat gangguan jaringan.
- [ ] Logging terstruktur JSONL di `data/logs/` dan otomatisasi screenshot saat terjadi error.
- **DoD:** Scraper tahan gangguan jaringan sementara dan mencatat log audit lengkap.

### T6.2 — Runbook & Panduan Penggunaan (`README.md`) ⏱ 0.5d
- [ ] Tuliskan petunjuk instalasi lengkap dan cara pengoperasian:
  - Setup `.env` (kredensial SINTA atau flag `--manual-login`).
  - Cara menjalankan scraping penuh: `npm run scrape`.
  - Cara scraping parsial (per prodi / per view): `npm run scrape:dept -- --dept=informatika --view=scopus`.
  - Cara mengekspor data: `npm run export`.
  - Cara membuka dashboard lokal: `npm run ui`.
- **DoD:** Panduan `README.md` jelas dan mudah dipahami operator.

### T6.3 — Final Verification & Tagging Release ⏱ 0.5d
- [ ] Jalankan pengujian end-to-end menyeluruh pada 3 prodi target.
- [ ] Verifikasi kelengkapan seluruh artefak hasil scraping (DB, XLSX, CSV, HTML, UI).
- [ ] Git commit dan penandaan tag rilis `v1.0-uwg-3dept`.
- **DoD:** Seluruh kriteria penerimaan (Acceptance Checklist) terpenuhi.
