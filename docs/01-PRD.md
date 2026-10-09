# PRD — SINTAScraper v1.0

**Versi:** 1.2 — 9 Okt 2026 (Diperbarui berdasarkan Groundtruth 4 File HTML SINTA)  
**Status:** Approved / Siap Implementasi  
**Pemilik:** LPPM / Operator Data Universitas Widya Gama  
**Repo:** `sintascraper`

---

## 1. Ringkasan Eksekutif

SINTAScraper adalah tool scraping semi-otomatis berbasis **MCP Chrome DevTools** (dengan fallback Playwright) untuk mengambil seluruh data publikasi, riset, pengabdian, HKI, dan profil dosen dari portal [SINTA Kemdiktisaintek](https://sinta.kemdiktisaintek.go.id) secara lengkap, terstruktur, dan dapat diekspor ke HTML/Excel/CSV.

Tool ini menggunakan **Chrome headful** yang dikendalikan via MCP `chrome-devtools` protocol, sehingga user dapat memonitor proses scraping secara real-time dan melakukan login manual jika diperlukan.

**Target awal:** Affiliation **Universitas Widya Gama (ID `2058`, CODE `071030`)** dan 3 department prioritas di bawah Fakultas Teknik (parent key `420D8E73-68F0-4044-86CF-5138D1419B20`):

| # | Department | ID (UUID) | Kode Prodi | URL Profil Kanonis | URL Profil Legacy |
|---|---|---|---|---|---|
| 1 | Teknik Informatika | `8A894EDC-B2F1-4575-95B8-91EB1E708F4F` | `55201` | [Kanonis](https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/8A894EDC-B2F1-4575-95B8-91EB1E708F4F/) | [Legacy](https://sinta.kemdiktisaintek.go.id/departments/profile/2058/071030/55201) |
| 2 | Bisnis Digital | `BB930200-F625-4220-BD63-94F4D1FD2E50` | `61209` | [Kanonis](https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/BB930200-F625-4220-BD63-94F4D1FD2E50) | [Legacy](https://sinta.kemdiktisaintek.go.id/departments/profile/2058/071030/61209) |
| 3 | Sistem dan Teknologi Informasi | `895FD91B-B0F2-41E7-99EB-F2D3997A9B0F` | `59201` | [Kanonis](https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/895FD91B-B0F2-41E7-99EB-F2D3997A9B0F) | [Legacy](https://sinta.kemdiktisaintek.go.id/departments/profile/2058/071030/59201) |

> **Catatan Groundtruth URL:** Kedua format URL hidup berdampingan di SINTA. Format kanonis UUID digunakan pada navigasi tab dan menu prodi, sedangkan format legacy kode prodi ditemukan pada aksi tabel indeks afiliasi (`.tbl-content-action a`) dan breadcrumb profil dosen. Scraper mengindeks kedua ID ini dan memprioritaskan URL kanonis saat crawling.

**Output akhir:** Tabel interaktif di UI lokal + ekspor **HTML / Excel (.xlsx) / CSV**.

---

## 2. Masalah yang Diselesaikan

| # | Masalah di Lapangan | Dampak | Temuan Groundtruth & Solusi SINTAScraper |
|---|---|---|---|
| 1 | Data SINTA tersebar per view (scopus, garuda, googlescholar, researches, services, iprs, books, wos, rama, matrics) dan per department/author | Sulit rekap lintas view untuk laporan akreditasi & audit BKD | Universal parser untuk container record `.profile-article > .ar-list-item.mb-5`, mendeteksi tab dinamis saat runtime |
| 2 | List artikel lengkap terkunci di balik login | User anonim hanya melihat sebagian data atau diarahkan ke `/logins` | Sesi terautentikasi (F0) membuka akses penuh ke numbered pagination (`?page=N&view=V`) dengan total records akurat |
| 3 | Link judul memiliki 2 perilaku berbeda: eksternal vs dummy link | Penggunaan `detail_url` sebagai unique key menyebabkan collision data dummy (misal IPR & Riset berisi link `.../?view=X#!`) | Dedup key komposit: `(view, scopus_eid)` bila ada URL Scopus, atau `(view, norm_title, year)` untuk data internal |
| 4 | Ko-author dan personil penelitian tidak terpetakan otomatis | Penilaian kolaborasi dosen sulit diukur | Parser mengekstrak ID personil dari `a[href*="/authors/profile/"]` di dalam baris `Personils :` dan preview author prodi |
| 5 | Rekap manual tidak konsisten dan lambat | Rawan human error, tidak ada snapshot historis | Pipeline otomatis: ekstraksi terstruktur ke SQLite + ekspor xlsx/csv/html instan |

---

## 3. Tujuan & Success Metrics

| Tujuan | Metric | Target |
|---|---|---|
| Login andal | Success rate login 10x berurutan via browser Chrome | ≥ 90% |
| Deteksi Sesi | Verifikasi status login aktif melalui elemen logout di navbar | 100% akurat |
| Cakupan prodi | 3 dept × semua active view + author profiles | 100% URL ter-crawl |
| Kelengkapan record | Validasi record count terhadap `Total Records Z` di pagination | Selisih 0 record |
| Kelengkapan field | % record dengan title + creator/leader/inventor + year + meta spesifik | ≥ 98% |
| Ekspor valid | 1 klik → html standalone + xlsx multi-sheet + csv UTF-8 BOM | 100% sukses |
| Kecepatan | 1 dept full (semua view & author) | < 15 menit |
| Idempotensi | Rerun dengan parameter sama tidak menduplikasi data | 0 duplikat |

---

## 4. Persona

| Persona | Deskripsi | Kebutuhan Utama |
|---|---|---|
| **Operator LPPM** (primary) | Login akun SINTA institusi, menjalankan sinkronisasi data prodi, mengekspor laporan | CLI sekali jalan, export Excel rapi dengan sheet META & hyperlink |
| **Kaprodi / Asesor** (secondary) | Menganalisis produktivitas prodi, sitasi, quartile Scopus, dan HKI dosen | Tabel interaktif lokal dengan search, filter tahun/quartile, sort |
| **Developer / Maintainer** | Menjaga kompatibilitas selector dan menambahkan prodi baru | Selector terisolasi di parser terpadu, config prodi via JSON |

---

## 5. Fitur (Urut Sesuai Workflow)

### F0 — Login & Autentikasi
- Buka `https://sinta.kemdiktisaintek.go.id/logins` via MCP Chrome DevTools headful.
- Jika `.env` berisi `SINTA_USERNAME` dan `SINTA_PASSWORD`: auto-fill input form + submit.
- Jika `.env` kosong atau flag `--manual-login`: tampilkan panduan di terminal, tunggu user login mandiri.
- Polling URL & DOM setiap 2 detik (maks 120 detik) hingga mencapai URL beranda / profil dengan indikator login aktif:
  - Selector: `a.dropdown-item[href$="/logins/logout"]` dan nama akun (misal `SYAHRONI`).
- Timeout → error `LOGIN_TIMEOUT` + screenshot otomatis ke `data/logs/`.
- Session check aktif sebelum setiap navigasi; re-login otomatis 1x jika dialihkan ke `/logins`.

### F1 — Affiliation Universitas Widya Gama
- URL Target: `https://sinta.kemdiktisaintek.go.id/affiliations/profile/2058` (fallback pencarian: `?q=widya+gama`).
- Ambil metadata institusi:
  - Nama: Universitas Widya Gama Malang, Kota, SINTA Score Overall / 3Yr, Productivity.
  - Statistik counts: Authors, Departments, Journals.
  - Tabel output riset: Scopus, GScholar, WOS, Garuda (Documents, Citations, Cited Docs).

### F2 — Indeks Department Afiliasi
- URL: `https://sinta.kemdiktisaintek.go.id/affiliations/departments/2058/071030`
- Parse baris prodi `.row.d-item`:
  - Jenjang: `.tbl-content-meta span` (misal `S1`).
  - Nama & URL Kanonis UUID: `.tbl-content-name a[href*="/departments/profile/2058/"]`.
  - Preview Dosen: `ul.au-list.dept-list li[data-original-title] > a[href*="/authors/profile/"]` (SINTA ID & Nama).
  - Kode Prodi: `.tbl-content-meta-num` (misal `59201`, `55201`, `61209`).
  - URL Legacy: `.tbl-content-action a[href*="/departments/profile/2058/071030/"]`.

### F3–F5 — Profil 3 Department Prioritas (FT UWG)
1. **Teknik Informatika (F3):** Kanonis `.../8A894EDC-B2F1-4575-95B8-91EB1E708F4F/` / Legacy `.../55201`
2. **Bisnis Digital (F4):** Kanonis `.../BB930200-F625-4220-BD63-94F4D1FD2E50` / Legacy `.../61209`
3. **Sistem dan Teknologi Informasi (F5):** Kanonis `.../895FD91B-B0F2-41E7-99EB-F2D3997A9B0F` / Legacy `.../59201`
- Parse header prodi:
  - Nama prodi (`.univ-name h3 a`), kode prodi (`CODE PRODI : \d+`), kode PT (`CODE PT : \d+`).
  - Stat counts (`.stat-num` + `.stat-text`): jumlah dosen/authors.
  - Skor SINTA (`.pr-num` / `.pr-txt`): Overall, 3Yr, Productivity, 3Yr Prod.
  - Tabel perbandingan publikasi/sitasi: Scopus & Google Scholar (`.stat-table`).
  - Cross-check data chart ECharts inline: `optionQ.data` (Q1..Q4, no-Q) dan radar chart.

### F6–F12 — Scraping per View (Level Department)
Setiap view diakses melalui `{dept_profile_url}/?view={key}`:
- **Mekanisme Pagination (Groundtruth §1.1):**
  - Baca metadata pagination: `div.pagination-text small` → regex `/Page (\d+) of (\d+) \| Total Records (\d+)/`.
  - Loop query string `?page=N&view={key}` dari `N = 1` sampai `Total Pages`.
  - Validasi assert: `jumlah record ter-parse > 0` jika `Total Records > 0`.
  - Fallback: Auto-scroll dan klik tombol "View more ..." hanya jika pagination bar tidak ditemukan (mode kompatibilitas anonim).
- **Universal Item Container:** `.profile-article > .ar-list-item.mb-5`
  - **F6 — Scopus (`?view=scopus`):** Title (`.ar-title a`), Target URL Scopus (`target="_blank"`), Scopus EID (`eid=2-s2.0-...`), Quartile (`.ar-quartile`), Jurnal (`.ar-pub`), Author Order (`Author Order : X of Y`), Creator (`Creator : ...`), Tahun (`.ar-year`), Sitasi (`.ar-cited`).
  - **F7 — Garuda (`?view=garuda`):** Title, URL Garuda, Nama Jurnal (`.ar-pub`), Creator, Tahun, Sitasi.
  - **F8 — Google Scholar (`?view=googlescholar`):** Title, URL Scholar, Publisher/Jurnal, Creator, Tahun, Sitasi.
  - **F9 — Researches (`?view=researches`):** Title, Dummy Link (`#!`), Ketua (`Leader : ...`), Skema (`.ar-pub`), Personil / Anggota (`Personils :` beserta list link `<a href="/authors/profile/{id}">`), Tahun, Dana (`Rp. ...`), Status (`Approved` / `Submitted`), Sumber Dana (`INTERNAL SOURCE` / `EXTERNAL`).
  - **F10 — Community Services (`?view=services`):** Struktur identik dengan Researches (Ketua, Personil, Skema, Dana, Status, Sumber).
  - **F11 — Hak Cipta / IPRs (`?view=iprs`):** Title, Dummy Link (`#!`), Inventor (`Inventor : ...`), Pemegang Hak (`.ar-pub`), Tahun, Nomor Permohonan (`Nomor Permohonan : EC...`), Jenis HKI (`Hak Cipta`, `Paten`, dll dari `.ar-quartile`).
  - **F12 — Buku (`?view=books`):** Title, Penulis, Penerbit (`.ar-pub`), ISBN, Tahun.

### F13 — Authors per Department
- URL: `https://sinta.kemdiktisaintek.go.id/departments/authors/2058/420D8E73-68F0-4044-86CF-5138D1419B20/{deptId}`
- Parse daftar dosen prodi:
  - `sinta_id` (dari href `/authors/profile/(\d+)`), Nama, NIDN, Program Studi, SINTA Score, URL Profil, Avatar URL.
  - Dukungan cross-check dari `ul.au-list.dept-list` di F2.

### F14 — Author Detail (Individual Profile)
- URL: `https://sinta.kemdiktisaintek.go.id/authors/profile/{sintaId}` (Contoh: `259792` - Syahroni Wahyu Iriananda)
- Parse header profil dosen:
  - Nama dosen (`.content-box h3 a`), status verifikasi (`i.el-ok-sign`).
  - SINTA ID (`SINTA ID : (\d+)`), Afiliasi ID (`/affiliations/profile/2058`), Prodi (`a[href*="/departments/profile/"]`).
  - Bidang Keahlian / Subjects: `ul.subject-list li a[href*="/subjects/detail/"]`.
  - Skor SINTA (`.pr-num` / `.pr-txt`): SINTA Score Overall, 3Yr, Affil, Affil 3Yr.
  - Ringkasan Metrik Publikasi (`.stat-table`): Matriks Article, Citation, Cited Doc, H-index, i10-index, G-index per sumber (Scopus, Google Scholar, Web of Science).

### F15 — Author Sub-Views (Publikasi & Kinerja Dosen)
- URL: `https://sinta.kemdiktisaintek.go.id/authors/profile/{sintaId}/?view={key}`
- Sub-views yang didukung secara dinamis dari `nav.profile-nav` dan `ul.article-tab`:
  - `scopus`, `wos` (diekstrak meski ber-class `d-none`), `garuda`, `googlescholar`, `rama`, `researches`, `services`, `iprs`, `books`, `pak`, `kepakaran`, `matrics`, `arts`.
- Menggunakan kembali parser universal F6–F12 dengan menyertakan `author_id` dan `author_order`.

### F16 — Tabel Interaktif & Ekspor
- **UI Lokal Interaktif (HTML/JS Vanilla):**
  - Menampilkan tabel per (prodi × view) dan ringkasan dosen.
  - Fitur lengkap: Search box instan, filter tahun, filter quartile Scopus, multi-sort kolom, pagination (25/50/100).
  - Tautan aktif (clickable hyperlinks) untuk URL Scopus, Garuda, Scholar, dan profil author.
- **Ekspor Mandiri:**
  - **HTML:** Standalone tanpa external CDN, styling modern disematkan inline, semantik `<table>` + `<caption>` metadata.
  - **Excel (.xlsx):** Format workbook lengkap: 1 sheet per view, sheet daftar `Authors`, sheet `META` (log waktu, akun, URL sumber), freeze baris header pertama, autofilter aktif pada semua kolom, URL diubah menjadi formula `=HYPERLINK()`, auto-fit lebar kolom.
  - **CSV:** Format UTF-8 dengan BOM (`\uFEFF`), delimiter titik koma (`;`) standar Excel Indonesia, quote minimal aman.
- **Pola Penamaan File Deterministik:**
  - Per view: `sinta_{deptSlug}_{view}_{YYYYMMDD_HHmm}.{ext}`
  - Rekap gabungan: `sinta_rekap_all_{YYYYMMDD_HHmm}.xlsx`

---

## 6. User Journey Terpadu

```
1. Operator mengisi .env (SINTA_USERNAME, SINTA_PASSWORD) atau memilih flag --manual-login.
2. Operator menjalankan `npm run scrape` di terminal.
3. Sistem menginisialisasi Chrome via MCP / CDP → membuka halaman /logins.
   a. Jika kredensial tersedia: isi otomatis username & password → submit form.
   b. Jika manual: instruksikan operator login di jendela Chrome yang terbuka.
4. Sistem memverifikasi login berhasil: URL kembali ke beranda & selector `a[href$="/logins/logout"]` terdeteksi.
5. Kunjungi F1 (Profil UWG) & F2 (Daftar Departemen) → simpan metadata institusi & prodi.
6. Untuk setiap Department (Informatika, Bisnis Digital, STI):
   a. Crawl profil department → ambil skor & ringkasan publikasi.
   b. Loop setiap view terdaftar [scopus, wos, garuda, googlescholar, researches, services, iprs, books]:
      - Navigate ke `?page=1&view={key}`.
      - Baca `div.pagination-text` untuk mengetahui total halaman.
      - Loop `page = 1..total`: ambil seluruh `.profile-article .ar-list-item`.
      - Ekstrak field spesifik via parseArListItem().
      - Dedup berbasis (view, scopus_eid) atau (view, norm_title, year) → simpan ke SQLite & snapshot JSON.
   c. Kunjungi daftar dosen prodi (`/departments/authors/...`) → catat daftar SINTA ID.
7. Untuk setiap Dosen / Author terdaftar:
   a. Crawl `/authors/profile/{sintaId}` → ekstrak header, subjects, skor, dan stat-table.
   b. Crawl sub-views publikasi dosen → simpan item dengan relasi `author_id`.
8. Sinkronisasi data ke SQLite selesai → trigger engine ekspor:
   - Generate file XLSX multi-sheet (Scopus, Researches, IPRs, Authors, META).
   - Generate file CSV per view dengan UTF-8 BOM.
   - Generate HTML standalone interaktif.
9. Tampilkan ringkasan eksekusi di terminal (durasi, jumlah record per view, 0 error).
```

---

## 7. Asumsi & Ketergantungan

| Kebutuhan | Spesifikasi |
|---|---|
| Kredensial Pengguna | Disediakan via file `.env` lokal (tidak di-commit ke Git). Template disediakan di `.env.example`. |
| Browser Engine | Chrome headful dikendalikan via MCP Chrome DevTools atau Playwright adapter. |
| Stabilitas DOM SINTA | Berbasis container `.ar-list-item` dan prefix label teks (`Leader :`, `Inventor :`, `Creator :`, dll). |
| Mekanisme Rate Limiting | Jeda dinamis 2.000–3.500 ms + random jitter 500 ms antar navigasi halaman. |
| Pagination SINTA | Standar portal adalah numbered pagination query parameter `?page=N&view=V`. |
| Lingkungan Kerja | Windows 10/11 (Laragon / Node.js 20+ LTS). |

---

## 8. Risiko & Mitigasi

| Risiko | Dampak | Strategi Mitigasi Teruji |
|---|---|---|
| Sesi login terputus (session timeout) di tengah scraping panjang | Gagal crawling halaman berikutnya / dialihkan ke `/logins` | Session Guard: Cek selector logout sebelum crawl; otomatis eksekusi re-login 1x dan ulangi halaman terakhir tanpa restart proses. |
| URL artikel internal berupa dummy hash `#!` | Data saling menimpa jika diduplikasi hanya berdasarkan `detail_url` | Skema unique key komposit: Gunakan `scopus_eid` untuk Scopus, dan `MD5(normalized_title + year + leader/inventor)` untuk data dummy. |
| Tombol WOS tidak tampil di antarmuka | Kehilangan data publikasi Web of Science | Selector parser tetap mengekstrak elemen `li.d-none a[href*="view=wos"]` dan merayapinya via URL langsung. |
| Format angka & mata uang di laporan beragam (`Rp. 4.000.000`, `0 cited`) | Parsing tipe data tidak seragam | Sanitasi regex otomatis: parsing integer murni untuk sitasi/tahun dan simpan nominal rupiah terformat rapi. |
| Perubahan minor pada layout tabel SINTA | Hasil parsing kosong | Assertion guard: Jika `Total Records > 0` namun item ter-parse `0`, sistem segera mencatat log error, menyimpan snapshot HTML, dan menandai `needs_selector_fix`. |

---

## Lampiran: Daftar URL Acuan Resmi

| Target | URL SINTA |
|---|---|
| Portal Login | `https://sinta.kemdiktisaintek.go.id/logins` |
| Beranda Terautentikasi | `https://sinta.kemdiktisaintek.go.id/` |
| Afiliasi UWG (Pencarian) | `https://sinta.kemdiktisaintek.go.id/affiliations?q=widya+gama` |
| Afiliasi UWG (Profil Langsung) | `https://sinta.kemdiktisaintek.go.id/affiliations/profile/2058` |
| Indeks Departemen UWG | `https://sinta.kemdiktisaintek.go.id/affiliations/departments/2058/071030` |
| Dept Informatika (Kanonis) | `https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/8A894EDC-B2F1-4575-95B8-91EB1E708F4F/` |
| Dept Bisnis Digital (Kanonis) | `https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/BB930200-F625-4220-BD63-94F4D1FD2E50` |
| Dept STI (Kanonis) | `https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/895FD91B-B0F2-41E7-99EB-F2D3997A9B0F` |
| Dosen Informatika | `https://sinta.kemdiktisaintek.go.id/departments/authors/2058/420D8E73-68F0-4044-86CF-5138D1419B20/8A894EDC-B2F1-4575-95B8-91EB1E708F4F` |
| Contoh Profil Dosen (Syahroni W.I.) | `https://sinta.kemdiktisaintek.go.id/authors/profile/259792` |
