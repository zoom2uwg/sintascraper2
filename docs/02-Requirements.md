# Requirements — SINTAScraper v1.0 (SRS)

**Versi:** 1.2 — 9 Okt 2026 (Diperbarui berdasarkan Groundtruth 4 File HTML SINTA)  
Sumber: [`docs/01-PRD.md`](file:///d:/laragon/www/sintascraper/docs/01-PRD.md) & [`docs/05-Groundtruth-Analysis.md`](file:///d:/laragon/www/sintascraper/docs/05-Groundtruth-Analysis.md)  
Semua REQ harus terpenuhi agar run dinyatakan DONE.

---

## 1. Functional Requirements

### AUTH — Login & Session Management

| ID | Requirement | Prioritas |
|---|---|---|
| **REQ-AUTH-01** | Sistem membuka `https://sinta.kemdiktisaintek.go.id/logins` di Chrome via MCP (`browser_navigate`). Browser wajib headful (`HEADLESS=false`) agar sesi dan cookie terkelola dengan aman. | P0 |
| **REQ-AUTH-02** | Jika `SINTA_USERNAME` & `SINTA_PASSWORD` ada di `.env`, sistem otomatis mengisi form login (`input[name="username"]` dan `input[name="password"]`) lalu menekan tombol submit. Jika `.env` kosong atau flag `--manual-login` aktif, tampilkan instruksi interaktif di console dan tunggu operator login mandiri. | P0 |
| **REQ-AUTH-03** | Polling setiap 2 detik (maksimal 120 detik) hingga login terverifikasi: URL kembali ke beranda/profil **DAN** elemen logout `a.dropdown-item[href$="/logins/logout"]` terdeteksi di DOM beserta nama akun (misal `SYAHRONI`). Jika tercapai → `LOGIN_SUCCESS`. Jika timeout → lempar `LOGIN_TIMEOUT` + tangkap screenshot otomatis ke `data/logs/err_login_timeout.png`. | P0 |
| **REQ-AUTH-04** | **Session Guard**: sebelum setiap navigasi prodi atau view publikasi, periksa keberadaan selector logout. Jika sesi terputus atau redirect ke `/logins`, picu prosedur re-login otomatis 1x lalu lanjutkan navigasi ke URL target tanpa mengulang dari awal. | P0 |
| **REQ-AUTH-05** | Kredensial pengguna **TIDAK PERNAH** tercetak di log output konsol maupun file JSONL (wajib di-mask dengan `***`). | P0 |
| **REQ-AUTH-06** | Opsi CLI `--manual-login` untuk melewati auto-fill dan langsung memfungsikan mode login manual di browser. | P1 |

---

### AFF — Affiliation Data

| ID | Requirement | Prioritas |
|---|---|---|
| **REQ-AFF-01** | Kunjungi profil afiliasi Universitas Widya Gama: URL langsung `https://sinta.kemdiktisaintek.go.id/affiliations/profile/2058` (atau via query `?q=widya+gama`). Validasi ID `2058` dan Kode PT `071030`. | P0 |
| **REQ-AFF-02** | Ekstrak metadata institusi secara akurat: Nama instansi, kota, skor SINTA (Overall, 3Yr), Productivity, total counts (Authors, Departments, Journals), serta tabel output riset (Scopus, GScholar, WOS, Garuda untuk Documents, Citations, dan Cited Docs). | P0 |
| **REQ-AFF-03** | Simpan metadata afiliasi ke SQLite tabel `affiliations` dan file snapshot `data/affiliation.json`. | P0 |

---

### DEPT — Department Navigation & Structure

| ID | Requirement | Prioritas |
|---|---|---|
| **REQ-DEPT-01** | Kunjungi indeks departemen `/affiliations/departments/2058/071030` → parse semua baris prodi `.row.d-item`: ekstrak jenjang (`.tbl-content-meta span`), nama prodi, URL kanonis UUID, kode prodi (`.tbl-content-meta-num`), URL legacy (`.tbl-content-action a`), dan preview daftar dosen prodi (`ul.au-list.dept-list`). Simpan pembaruan ke `config/departments.json`. | P0 |
| **REQ-DEPT-02** | Kunjungi halaman profil untuk 3 departemen target: parse header prodi (`.univ-name h3 a`), kode prodi (`61209`, `55201`, `59201`), jumlah authors (`.stat-num`), skor SINTA (`.pr-num` / `.pr-txt`), serta metrik publikasi Scopus & GScholar dari `.stat-table`. | P0 |
| **REQ-DEPT-03** | **Config-Driven Architecture**: Penambahan prodi baru hanya memerlukan penambahan konfigurasi ID di `config/departments.json` tanpa mengubah logika scraping inti. | P1 |

**Daftar Departemen Target (FT UWG):**

| Department | UUID Profile URL (Kanonis) | Legacy URL | Kode Prodi |
|---|---|---|---|
| Teknik Informatika | `/departments/profile/2058/420D8E73-.../8A894EDC-B2F1-4575-95B8-91EB1E708F4F/` | `/departments/profile/2058/071030/55201` | `55201` |
| Bisnis Digital | `/departments/profile/2058/420D8E73-.../BB930200-F625-4220-BD63-94F4D1FD2E50` | `/departments/profile/2058/071030/61209` | `61209` |
| Sistem dan Teknologi Informasi | `/departments/profile/2058/420D8E73-.../895FD91B-B0F2-41E7-99EB-F2D3997A9B0F` | `/departments/profile/2058/071030/59201` | `59201` |

---

### VIEW — Scraping per View (Level Department & Author)

Pola URL: `{dept_profile_url}/?page={N}&view={key}`

| ID | Requirement | Prioritas |
|---|---|---|
| **REQ-VIEW-01** | **Numbered Pagination Loop (Groundtruth Standard):** Untuk setiap kombinasi (dept × view), buka `?page=1&view={key}`. Ekstrak teks pagination dari `div.pagination-text small` dengan regex `/Page (\d+) of (\d+) \| Total Records (\d+)/`. Lakukan iterasi `page = 1..total_pages` untuk mengambil seluruh halaman. Validasi integritas: jika `Total Records > 0` tetapi item ter-parse `0`, sistem wajib mencatat error selector. Fallback mode: auto-scroll dan tombol "View more ..." hanya aktif jika pagination bar tidak ditemukan. | P0 |
| **REQ-VIEW-02** | **Universal Record Parser (`parseArListItem`):** Setiap record artikel/riset/HKI berada di dalam container universal `.profile-article > .ar-list-item.mb-5`. Ekstrak judul dari `.ar-title a` (beserta `href` dan atribut `target`), lalu klasifikasikan metadata dari `.ar-meta` menggunakan prefix label teks (`Leader :`, `Personils :`, `Creator :`, `Inventor :`, `Author Order :`, `Nomor Permohonan :`, `Rp.`, `.ar-quartile`, `.ar-pub`, `.ar-year`, `.ar-cited`). | P0 |
| **REQ-VIEW-03** | **Penanganan View Kosong:** Jika suatu view memiliki `Total Records 0` atau tidak memiliki elemen `.ar-list-item`, simpan array kosong `[]`, catat status `empty_verified: true`, dan jangan hentikan alur scraping. | P0 |
| **REQ-VIEW-04** | **Penyimpanan Snapshot Mentah:** Simpan salinan file HTML per halaman ke `data/raw/{dept_slug}/{view}/page_{N}.html` untuk keperluan audit dan golden fixture testing. | P0 |
| **REQ-VIEW-05** | **Composite Dedup Key:** SINTA memuat dua macam link judul: eksternal (Scopus) dan internal dummy (`#!`). Aturan dedup unik: <br>• Jika memiliki Scopus URL: `dedup_key = "scopus:" + scopus_eid`<br>• Jika internal dummy (HKI, Riset, dll): `dedup_key = view + ":" + MD5(normalized_title + "_" + year + "_" + (leader || inventor || creator || ""))`. | P0 |
| **REQ-VIEW-06** | **Dukungan View Lengkap:** Mendukung seluruh view SINTA: `scopus`, `wos` (diekstrak dari `li.d-none a[href*="view=wos"]`), `garuda`, `googlescholar`, `researches`, `services`, `iprs`, `books`, `rama`, `pak`, `kepakaran`, `matrics`, `arts`. | P0 |

**Spesifikasi Fields per View:**

| View Key | Tipe Data & Sumber Ekstraksi | Field Khusus yang Wajib Terisi |
|---|---|---|
| `scopus` | Publikasi terindeks Scopus | `scopus_eid`, `quartile` (misal `Q3 Journal`, `no-Q`), `journal` (`.ar-pub`), `journal_url`, `author_order` (misal `0 of 5`), `creator`, `year` (`.ar-year`), `cited` (`.ar-cited`) |
| `wos` | Publikasi Web of Science | `quartile`, `journal`, `creator`, `year`, `cited` |
| `garuda` | Publikasi Jurnal Nasional Garuda | `journal` (`.ar-pub`), `creator`, `year`, `cited` |
| `googlescholar` | Publikasi Google Scholar | `source` / penerbit, `creator`, `year`, `cited` |
| `researches` | Penelitian Dosen | `leader` (`Leader : ...`), `scheme` (`.ar-pub`), `personil_names` (array teks), `personil_ids` (array SINTA ID dari `a[href*="/authors/profile/"]`), `year`, `fund_rp` (misal `Rp. 4.000.000`), `status` (`Approved`), `source` (`INTERNAL SOURCE` / `EXTERNAL`) |
| `services` | Pengabdian kepada Masyarakat | Struktur identik dengan researches: `leader`, `scheme`, `personil_names`, `personil_ids`, `year`, `fund_rp`, `status`, `source` |
| `iprs` | Hak Cipta / HKI | `inventor` (`Inventor : ...`), `holder_pub` (`.ar-pub`), `year`, `nomor_permohonan` (`Nomor Permohonan : EC...`), `ipr_type` (`Hak Cipta`, `Paten`, dll dari `.ar-quartile`) |
| `books` | Publikasi Buku | `isbn`, `publisher` (`.ar-pub`), `year`, `creator` |
| `rama` / lainnya | Repositori RAMA, PAK, Kepakaran | `title`, `meta_info`, `year`, `source` |

---

### AUTHORS — Author Data Collection

| ID | Requirement | Prioritas |
|---|---|---|
| **REQ-AUTH-LIST-01** | Kunjungi `/departments/authors/2058/420D8E73-.../{deptId}` per prodi: ekstrak `sinta_id`, nama dosen, NIDN, prodi, skor SINTA, URL profil, dan avatar. | P0 |
| **REQ-AUTH-DETAIL-01** | Kunjungi halaman profil dosen `/authors/profile/{sintaId}`: parse nama (`.content-box h3 a`), status verifikasi (`i.el-ok-sign`), SINTA ID, afiliasi, prodi, daftar bidang keahlian/tags (`ul.subject-list li a`), skor SINTA (Overall, 3Yr, Affil, Affil 3Yr dari `.pr-num`), serta matriks publikasi dari `.stat-table` (Scopus, GS, WOS: Article, Citation, Cited Doc, H-index, i10, G-index). | P0 |
| **REQ-AUTH-DETAIL-02** | Scrape sub-views publikasi dosen: `/authors/profile/{sintaId}/?page=N&view={key}`. Menggunakan kembali parser universal REQ-VIEW-02 dengan tambahan relasi `author_id` dan `author_order`. | P0 |
| **REQ-AUTH-DETAIL-03** | Petakan relasi many-to-many ke SQLite tabel `author_dept(dept_id, sinta_id)` untuk mengakomodasi dosen yang mengajar lintas program studi. | P1 |

---

### UI — Tabel Interaktif Lokal

| ID | Requirement | Prioritas |
|---|---|---|
| **REQ-UI-01** | Antarmuka berbasis web lokal (HTML/JS statis di `ui/index.html`) tanpa dependensi build tools yang rumit, dapat dijalankan via local web server atau browser langsung. | P0 |
| **REQ-UI-02** | Fitur tabel interaktif: pencarian instan (instant search filter), dropdown filter (tahun, prodi, view, quartile Scopus), pengurutan multi-kolom (sorting), dan pagination responsif (25 / 50 / 100 rows). | P0 |
| **REQ-UI-03** | Seluruh tautan URL dokumen (Scopus, Garuda, Google Scholar, SINTA) harus berwujud clickable hyperlink yang terbuka di tab baru (`target="_blank"`). | P0 |
| **REQ-UI-04** | Tampilan ringkasan profil dosen yang terhubung langsung ke daftar publikasi masing-masing. | P1 |

---

### EXP — Ekspor Data Multi-Format

| ID | Requirement | Prioritas |
|---|---|---|
| **REQ-EXP-01** | Menyediakan opsi ekspor data per tabel prodi-view serta ekspor gabungan (master dataset) seluruh prodi. | P0 |
| **REQ-EXP-02** | **Ekspor HTML Standalone:** Halaman HTML mandiri dengan inline CSS modern, tabel semantik lengkap dengan tag `<caption>` yang memuat metadata sumber data, waktu crawling, dan total baris data. Bebas dari external CDN. | P0 |
| **REQ-EXP-03** | **Ekspor Excel (.xlsx):** Menggunakan `exceljs` untuk menghasilkan workbook rapi: 1 sheet per view (`Scopus`, `Researches`, `IPRs`, dll), sheet daftar `Authors`, serta sheet `META`. Baris header pertama di-freeze, fitur autofilter aktif di semua kolom, kolom tautan dikonversi menjadi formula hyperlink `=HYPERLINK(url, title)`, dan lebar kolom disesuaikan otomatis (auto-fit). | P0 |
| **REQ-EXP-04** | **Ekspor CSV:** Format teks UTF-8 dengan BOM (`\uFEFF`), delimiter titik koma (`;`) standar regional Indonesia, quote minimal yang aman dibuka di Microsoft Excel tanpa masalah teks bergeser. | P0 |
| **REQ-EXP-05** | Penamaan file deterministik: `sinta_{deptSlug}_{view}_{YYYYMMDD_HHmm}.{ext}` dan file master `sinta_rekap_all_{YYYYMMDD_HHmm}.xlsx`. | P0 |

---

## 2. Data Contract (Skema JSON & SQLite)

### 2.1 Skema Record Publikasi (Scopus / WOS / Garuda / Scholar)
```jsonc
{
  "dedup_key": "scopus:2-s2.0-105029558167",
  "dept_id": "8A894EDC-B2F1-4575-95B8-91EB1E708F4F",
  "dept_name": "Teknik Informatika",
  "view": "scopus",
  "page": 1,
  "title": "Advancing End-To-End Indonesian Speech Emotion Recognition Using XLSR-Wav2Vec2",
  "detail_url": "https://www.scopus.com/record/display.uri?eid=2-s2.0-105029558167&origin=resultslist",
  "scopus_eid": "2-s2.0-105029558167",
  "quartile": "no-Q as Conference Proceedin",
  "journal": "Proceeding 2025 International Conference on Information Technology...",
  "journal_url": "https://www.scopus.com/sourceid/21101392033",
  "creator": "Nugroho K.S.",
  "author_order": "0 of 5",
  "year": 2025,
  "cited": 0,
  "author_id": 259792,
  "sinta_source_url": "https://sinta.kemdiktisaintek.go.id/authors/profile/259792/?page=1&view=scopus",
  "scraped_at": "2026-10-09T14:30:00+07:00"
}
```

### 2.2 Skema Record Penelitian & Pengabdian (Researches / Services)
```jsonc
{
  "dedup_key": "researches:f6e9b0a1d4c2...",
  "dept_id": "8A894EDC-...",
  "dept_name": "Teknik Informatika",
  "view": "researches",
  "page": 1,
  "title": "MODEL EKSTRAKSI KUINTUPEL UNTUK ANALISIS ASPEK–KATEGORI–OPINI–SENTIMEN–EMOSI...",
  "detail_url": "https://sinta.kemdiktisaintek.go.id/authors/profile/259792/?view=researches#!",
  "leader": "Syahroni Wahyu Iriananda",
  "scheme": "PENELITIAN HIBAH INSTITUSI ( PERINTIS )",
  "personil_names": ["Hanif Rani Iswari"],
  "personil_ids": [6738705],
  "year": 2026,
  "fund_rp": "Rp. 4.000.000",
  "status": "Approved",
  "source": "INTERNAL SOURCE",
  "author_id": 259792,
  "sinta_source_url": "https://sinta.kemdiktisaintek.go.id/authors/profile/259792/?page=1&view=researches",
  "scraped_at": "2026-10-09T14:30:00+07:00"
}
```

### 2.3 Skema Record HKI / Hak Cipta (IPRs)
```jsonc
{
  "dedup_key": "iprs:EC002024234761",
  "dept_id": "BB930200-F625-4220-BD63-94F4D1FD2E50",
  "dept_name": "Bisnis Digital",
  "view": "iprs",
  "page": 1,
  "title": "Logo Bebras-Biro UWG",
  "detail_url": "https://sinta.kemdiktisaintek.go.id/departments/profile/.../?view=iprs#!",
  "inventor": "Ahmad Fairuzabadi, Fitri Marisa",
  "holder_pub": "Ahmad Fairuzabadi, Fitri Marisa",
  "year": 2024,
  "nomor_permohonan": "EC002024234761",
  "ipr_type": "Hak Cipta",
  "author_id": null,
  "sinta_source_url": "https://sinta.kemdiktisaintek.go.id/departments/profile/.../?page=1&view=iprs",
  "scraped_at": "2026-10-09T14:30:00+07:00"
}
```

### 2.4 Skema Profil Dosen (Author Profile)
```jsonc
{
  "sinta_id": 259792,
  "name": "Syahroni Wahyu Iriananda",
  "affiliation": "Universitas Widya Gama",
  "affiliation_id": 2058,
  "study_program": "Teknik Informatika",
  "nidn": null,
  "subjects": ["Artificial Intelligent", "Text Mining", "Decision Support System", "Data Science"],
  "scores": {
    "overall": 474,
    "3yr": 190,
    "affil": 474,
    "affil_3yr": 190
  },
  "summary": {
    "scopus": { "articles": 1, "citations": 0, "cited_docs": 0, "h_index": 0, "i10": 0, "g_index": 0 },
    "google_scholar": { "articles": 0, "citations": 0, "cited_docs": 0, "h_index": 0, "i10": 0, "g_index": 0 },
    "wos": { "articles": 0, "citations": 0, "cited_docs": 0, "h_index": 0, "i10": 0, "g_index": 0 }
  },
  "profile_url": "https://sinta.kemdiktisaintek.go.id/authors/profile/259792",
  "avatar_url": "https://sinta.kemdiktisaintek.go.id/public/assets/img/...",
  "dept_ids": ["8A894EDC-B2F1-4575-95B8-91EB1E708F4F"],
  "scraped_at": "2026-10-09T14:30:00+07:00"
}
```

---

## 3. Non-Functional Requirements

| ID | Area | Spesifikasi |
|---|---|---|
| **REQ-NFR-01** | Performance & Rate Limiting | Jeda antar request navigasi: 2.000–3.500 ms + jitter 500 ms. Scraping dijalankan dalam 1 tab browser aktif untuk mencegah pemblokiran IP. |
| **REQ-NFR-02** | Reliability & Checkpoint | Mekanisme retry otomatis 3x dengan exponential backoff (2s, 4s, 8s) untuk request yang mengalami kegagalan jaringan. Dukungan checkpoint via `state.json` untuk melanjutkan scraping dari titik terakhir yang sukses. |
| **REQ-NFR-03** | Observability & Audit | Seluruh operasi dicatat dalam file log JSONL (`data/logs/run_{YYYYMMDD}.jsonl`). Jika terjadi error, sistem secara otomatis menyimpan tangkapan layar (screenshot) halaman saat itu. |
| **REQ-NFR-04** | Security & Privacy | File `.env` wajib dimasukkan ke `.gitignore`. Kredensial tidak pernah dicatat ke console log. Opsi `--manual-login` disediakan bagi pengguna yang enggan menyimpan password dalam file. |
| **REQ-NFR-05** | Portability | Kompatibel penuh dengan OS Windows 10/11 (Laragon / Node.js 20+ LTS). Setup mudah tanpa dependensi sistem operasi tambahan. |
| **REQ-NFR-06** | Data Integrity & Idempotency | Seluruh penyimpanan item di SQLite menggunakan `INSERT OR REPLACE` / `UPSERT` berlandaskan indeks unik `UNIQUE(view, dedup_key)`. Menjalankan scraper berulang kali tidak akan menduplikasi baris data. |

---

## 4. Konfigurasi Lingkungan (`.env`)

```env
# Kredensial SINTA (kosongkan jika memilih login manual di browser)
SINTA_USERNAME=
SINTA_PASSWORD=

# Mode Browser (wajib false untuk proses login headful)
HEADLESS=false

# Basis URL SINTA
SINTA_BASE=https://sinta.kemdiktisaintek.go.id

# Target Afiliasi & Departemen
AFFILIATION_ID=2058
AFFILIATION_CODE=071030
DEPT_PARENT_KEY=420D8E73-68F0-4044-86CF-5138D1419B20
DEPARTMENTS=8A894EDC-B2F1-4575-95B8-91EB1E708F4F,BB930200-F625-4220-BD63-94F4D1FD2E50,895FD91B-B0F2-41E7-99EB-F2D3997A9B0F

# Views yang Di-scrape (pisahkan dengan koma)
VIEWS=scopus,wos,garuda,googlescholar,researches,services,iprs,books

# Pengaturan Kecepatan & Navigasi
NAV_DELAY_MS=2500
PAGE_TIMEOUT_MS=30000

# Direktori Penyimpanan
OUTPUT_DIR=./data
```

---

## 5. Acceptance Checklist (Definition of Done)

- [ ] Otomatisasi login dengan kredensial `.env` teruji ≥9/10 sukses.
- [ ] Mode login manual berjalan mulus dan mendeteksi login operator.
- [ ] Deteksi sesi aktif via selector `a.dropdown-item[href$="/logins/logout"]` terbukti bekerja 100%.
- [ ] Data profil 3 program studi terambil lengkap (skor SINTA, kode prodi, counts dosen).
- [ ] Seluruh view publikasi ter-scrape melalui mekanisme numbered pagination `?page=N&view={key}`.
- [ ] Total record ter-scrape cocok 100% dengan teks `Total Records Z` pada pagination.
- [ ] Seluruh link personil riset (`Personils :`) ter-resolve ke SINTA ID.
- [ ] Tautan Scopus eksternal terekstrak dengan Scopus EID yang valid.
- [ ] File HTML mentah per halaman tersimpan di `data/raw/`.
- [ ] Database SQLite `data/db.sqlite` terisi tanpa duplikasi data (`dedup_key` unik).
- [ ] Ekspor XLSX multi-sheet terbuka di Microsoft Excel / LibreOffice tanpa pesan corrupt.
- [ ] Formula hyperlink di XLSX aktif dan membuka halaman dokumen asli.
- [ ] Ekspor CSV berformat UTF-8 dengan BOM (delimiter `;`) terbuka rapi di Excel Indonesia.
- [ ] Halaman web UI `ui/index.html` dapat melakukan search, sort, filter prodi, dan filter tahun.
- [ ] Uji pemutusan sesi mendadak (simulasi redirect login) berhasil memicu re-login dan melanjutkan scraping.
