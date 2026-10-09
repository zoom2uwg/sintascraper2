# Groundtruth Analysis — HTML SINTA (hasil bedah 4 file)

Tanggal: 9 Okt 2026. File di root repo sebagai acuan beku (jangan dihapus):
- `SINTA - Science and Technology Index-DepartmentProfile.html` = Dept **Bisnis Digital** `BB930200-...` `?view=iprs` (login sebagai SYAHRONI)
- `SINTA - Science and Technology Index-Affiliation.html` = `/affiliations/departments/2058/071030?q=sistem`
- `SINTA - Science and Technology Index-AuthorResearch.html` = author `259792` `?view=researches`
- `SINTA - Science and Technology Index-AuthorsProfile.html` = author `259792` default (`?view=scopus` implisit)

> Semua halaman groundtruth dalam **keadaan sudah login** (navbar ada `SYAHRONI`, `My Profile`, `/logins/logout`). Ini state yang harus dicapai F0 sebelum scrape.

## 1. Temuan kunci (yang mengoreksi desain awal)

1. **Pagination = numbered pages, bukan tombol "View more".**
   - Pola: `nav[aria-label="pagination-sample"] ul.pagination a.page-link` + `div.pagination-text small = "Page X of Y | Total Records Z"`.
   - Contoh: `Page 1 of 1 | Total Records 1` (dept IPRS), `Total Records 9` (author researches), semua single-page di sampel.
   - URL page: `?page=1&view=iprs`, `?page=&view=iprs` untuk disabled Prev/Next (`li.page-item.disabled`).
   - Implikasi: navigator harus **loop `?page=N&view=V`** sampai `Page N of Y`, bukan klik View-more. (View-more hanya muncul untuk anonim / list artikel panjang — tetap pertahankan sebagai fallback, tapi path utama = pagination.)
   - Assert: `len(.ar-list-item) == min(pageSize, TotalRecords - offset)`. Jika `len==0` tapi Total>0 → selector rusak.
2. **Satu container universal untuk semua record: `.profile-article > .ar-list-item.mb-5`.**
   - Dept scopus/garuda/scholar/researches/services/iprs/books + author semua view memakai struktur identik: `.ar-title` + 2–3× `.ar-meta`.
   - Affiliation→departments adalah pengecualian: memakai `.row.d-item` (lihat §4).
   - Parser cukup satu fungsi `parseArListItem(el)` + branch per view berdasar prefix teks (`Creator :`, `Inventor :`, `Leader :`, `Nomor Permohonan :`, `Rp.`, `Author Order :`).
3. **Link judul ada 2 jenis — jangan jadikan dedup key tunggal `detail_url`.**
   - Eksternal (Scopus): `<div class=ar-title><a href="https://www.scopus.com/record/display.uri?eid=2-s2.0-...&origin=resultslist" target="_blank">` — URL asli, stabil, bisa jadi key.
   - Internal/dummy (IPRS, Research, dsb.): `href="<sama-seperti-halaman>?view=iprs#!"` — tidak ada halaman detail. Key harus `title+year (+nomor permohonan / leader)`.
   - Aturan dedup baru: `if scopus_url → key=(view, scopus_eid) else key=(view, normalized_title, year)`.
4. **Ko-author / personil sudah ber-link dan siap di-crawl.**
   - Research: `Personils : <a href="/authors/profile/6738705">Hanif Rani Iswari</a>;` atau teks `-` bila kosong. Author ID tinggal regex `/authors/profile/(\d+)`.
   - Dept row preview: `ul.au-list.dept-list li[data-original-title="NAMA"] > a[href="/authors/profile/6937019"]`.
   - Ini menutup loop F13→F14 tanpa halaman perantara.
5. **Dua format URL dept profile hidup berdampingan.**
   - Kanonis UUID: `/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/895FD91B-...` (dipakai tab + nav).
   - Legacy kode prodi: `/departments/profile/2058/071030/59201` (di `.tbl-content-action a` + breadcrumb author `.../2058/071030/55201`). Keduanya resolve ke prodi sama (59201 = STI, 55201 = Informatika, 61209 = Bisnis Digital dari header). Scraper harus **menyimpan keduanya** dan memakai kanonis untuk crawl.
6. **Tab navigasi adalah sumber kebenaran daftar view.**
   - Dept (`nav.profile-nav`): `Articles(default,''), researches, services, iprs, books, matrics, arts` (+hidden). Contoh Bisnis Digital aktif `IPRs`.
   - Author (`nav.profile-nav`): `Articles, researches, services, iprs, books, pak, kepakaran, matrics` (+arts comment).
   - Author article sub-tab (`ul.article-tab`): `scopus, wos(d-none tapi ada!), garuda, googlescholar, rama`. WOS disembunyikan via CSS (`d-none`) tapi link valid — tetap scrape.
   - Scraper harus parse tab ini saat runtime (jangan hardcode) agar view baru (`pak`, `kepakaran`, `rama`, `arts`, `wos`) otomatis ikut.
7. **Angka ringkasan ada 3 sumber yang bisa cross-check:** header `.pr-num`, tabel `.stat-table`, dan data echarts inline (`optionQ.data`, `optionRadar`, `research-chart-articles` / `scopus-chart-articles`). Simpan ketiganya untuk validasi (mis. Article Scopus dept=2 vs card yang ter-parse).

## 2. Selector presisi (siap pakai)

### 2.1 Record universal
```js
const itemEls = document.querySelectorAll('.profile-article .ar-list-item');
const total = parseInt(document.querySelector('.pagination-text small')?.textContent.match(/Total Records (\d+)/)?.[1] ?? '0');
const pageInfo = document.querySelector('.pagination-text small')?.textContent.match(/Page (\d+) of (\d+)/);
```

### 2.2 Field per item (urutan nekat: strip icon `<i>` dulu via innerText)
```js
function text(el){ return el ? el.innerText.replace(/\s+/g,' ').trim() : null; }
function parseItem(el){
  const titleA = el.querySelector('.ar-title a');
  const metas = [...el.querySelectorAll('.ar-meta a')].map(a=>({cls:a.className, text:text(a), href:a.getAttribute('href')}));
  return { title: text(titleA), title_href: titleA?.href ?? null, target: titleA?.target ?? null, metas };
}
// lalu branch:
// scopus: metas cari prefix 'no-Q'/'Q[1-4]' (.ar-quartile), '.ar-pub' (journal), 'Author Order :', 'Creator :', '.ar-year' (/\b(19|20)\d{2}\b/), '.ar-cited' (/(\d+)\s*cited/)
// iprs: 'Inventor :' , '.ar-pub' (nama inventor), '.ar-year', '.ar-cited' ~ 'Nomor Permohonan : (EC\d+)', '.ar-quartile' ~ 'Hak Cipta'
// researches: 'Leader :', '.ar-pub' (skema), 'Personils :' + a[href*=/authors/profile/] (atau '-' ), '.ar-year', /Rp\.\s*[\d.]+/, 'Approved'/'Submitted', 'INTERNAL SOURCE'/'EXTERNAL'
```

### 2.3 Header dept (`?view=*`)
- Nama: `.univ-name h3 a` → `Bisnis Digital`
- Afiliasi: `.meta-profile a[href*="/affiliations/profile/"]`, kode: regex `CODE PRODI\s*:\s*(\d+)` → `61209`, `CODE PT\s*:\s*(\d+)` → `071030`
- Counts: `.stat-num` + `.stat-text` → `4 Authors`
- Scores: `.pr-num` + `.pr-txt` → Overall 439 / 3Yr 218 / Productivity 88 / 3Yr Prod 44
- Side: `.stat-table` rows Article/Citation × Scopus/GScholar → `2/104`, `4/305`
- Chart cross-check: `optionQ.data` (Q1,Q2,Q3,Q4,No-Q) = `0,0,1,0,1`; radar `Conference,Articles,Others`.

### 2.4 Row afiliasi→dept (`.row.d-item`)
- Level: `.tbl-content-meta span` (`S1`)
- Nama + kanonis: `.tbl-content-name a[href*="/departments/profile/2058/"]`
- Preview authors: `ul.au-list.dept-list li[data-original-title] > a[href*="/authors/profile/"]` → id + nama
- Code prodi: `.tbl-content-meta-num` (`59201`)
- Legacy URL: `.tbl-content-action a[href*="/departments/profile/2058/071030/"]`

### 2.5 Header author (`/authors/profile/{id}`)
- Nama: `.content-box h3 a`, verified: `i.el-ok-sign`
- SINTA ID: regex `SINTA ID\s*:\s*(\d+)` → `259792`; affil id `/affiliations/profile/(\d+)` → `2058`
- Prodi: `a[href*="/departments/profile/"]` (legacy `.../2058/071030/55201`)
- Subjects: `ul.subject-list li a[href*="/subjects/detail/"]` → Artificial Intelligent, Text Mining, Decision Support System, Data Science
- Scores `.pr-num/.pr-txt`: Overall 474, 3Yr 190, Affil 474, Affil 3Yr 190
- Summary `.stat-table`: Article/Citation/Cited/H/i10/G × Scopus/GS/WOS → `1/0/0`, `0/0/0`, dst.
- Search form: `form input[name=q]` + `input[type=hidden][name=view]` (GET).

### 2.6 Login detector (untuk REQ-AUTH-03)
- Logged-in: navbar mengandung `a[href$="/logins/logout"]` + `a[href$="/profile"]` + nama user (`SYAHRONI`).
- Anonim: `a[href$="/logins"]` berteks Login. Jika setelah navigate URL mengandung `/logins` → sesi putus.

## 3. Skema kolom per view (untuk xlsx/csv/html)

Kolom umum semua view: `dept_slug, dept_name, view, page, title, title_url, sinta_source_url, scraped_at`.
- **scopus/wos/garuda/scholar/rama:** + `quartile, journal, journal_url, author_order, creator, year, cited`.
- **researches:** + `leader, scheme, personil_names(|), personil_ids(|), year, fund_rp, status, source`.
- **services:** sama seperti researches (verifikasi: struktur identik, Cy groundtruth services belum ada file — asumsikan sama, tandai perlu fixture).
- **iprs:** + `inventor, holder_pub, year, nomor_permohonan, ipr_type (Hak Cipta/Paten/...)`.
- **books:** belum ada fixture — kolom antisipasi `author, publisher, isbn, year` (tandai TODO fixture).
- **authors:** `sinta_id, name, dept_slug, profile_url, level, code_prodi`.
- **author_detail:** + `affiliation, study_program, subjects(|), scores{overall,3yr,affil,affil3yr}, summary{...}, avatar_url`.

Contoh record nyata (siap jadi test fixture):
- IPRS: `Logo Bebras-Biro UWG | Inventor: Ahmad Fairuzabadi, Fitri Marisa | 2024 | EC002024234761 | Hak Cipta | Total Records 1`
- Research: `MODEL EKSTRAKSI KUINTUPEL ... INDOBERT | Leader Syahroni Wahyu Iriananda | Personils Hanif Rani Iswari(6738705) | 2026 | Rp. 4.000.000 | Approved | INTERNAL` dan kasus kosong `Personils : -` (2022).
- Scopus author: `Advancing End-To-End ... XLSR-Wav2Vec2 | no-Q as Conference Proceedin | Proceeding 2025 ... | Author Order 0 of 5 | Creator Nugroho K.S. | 2025 | 0 cited | eid 2-s2.0-105029558167`.

## 4. Perubahan yang harus masuk ke Requirements & Design

1. `REQ-VIEW-01`: ganti "klik View more" menjadi **"loop pagination `?page=N&view=V` berdasar `Page X of Y | Total Records Z`; View-more hanya fallback anonim"**.
2. Dedup key: `(view, scopus_eid)` bila ada, else `(view, norm_title, year)` — bukan `detail_url` semata.
3. Tambah view wajib: `wos, rama, pak, kepakaran, matrics, arts` (di-parse dari tab saat runtime; WOS walau `d-none`).
4. Tambah fixture wajib: simpan 4 file groundtruth + nanti `services.html`, `books.html`, `garuda.html`, `googlescholar.html` sebagai golden test `parsers/cards.test.js`.
5. `extractCards()` di Design §4 diganti `parseArListItem()` §2.2 di atas (berbasis class `ar-*`, bukan tebak `a[href*=scopus]`).
6. Tambah `checkSession()` via selector logout (§2.6), bukan sekadar cek URL.
7. Export kolom mengikuti §3 (termasuk `nomor_permohonan`, `fund_rp`, `personil_ids`, `author_order`, `scopus_eid`).

## 5. Batas & TODO fixture

- Belum ada sampel `services`, `books`, `garuda`, `googlescholar`, `wos`, `rama`, `pak`, `kepakaran` di kedua level (dept & author) — pola diasumsikan = `.ar-list-item` (risiko rendah, tapi wajib tambah file saat scrape pertama dan jadikan fixture).
- Angka di `profile-hindex` afiliasi (`SINTA Score Overall :` kosong di HTML) memang kosong di server — parser harus toleran `null`.
- Chart `echarts` hanya cross-check, bukan sumber utama (datanya diagregat, bukan per record).
