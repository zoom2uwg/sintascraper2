# SINTA Scraper — ekstraksi halaman lengkap & pagination

Scraper untuk mengambil informasi profil Afiliasi, daftar Prodi, profil Departemen, daftar Dosen, profil Dosen, tab publikasi/riset, serta seluruh halaman pagination dari SINTA Kemdiktisaintek. Parsing halaman menggunakan Cheerio pada HTML yang diterima Puppeteer; cara ini juga menangkap elemen yang tersembunyi secara visual (misalnya tab WOS) dan data grafik ECharts.

> Gunakan dengan jeda yang wajar dan patuhi ketentuan layanan SINTA. Pagination yang dibatasi login atau gangguan jaringan akan dicatat sebagai peringatan; hasil parsial tidak ditandai sebagai lengkap.

## Instalasi

```bash
cd sinta-scraper
npm ci
cp .env.example .env
```

Isi kredensial di `.env` bila diperlukan. Jangan commit `.env`. Tanpa kredensial, scraper mencoba mode publik; sebagian konten atau pagination mungkin memerlukan login. Anda juga bisa login secara manual pada jendela browser.

## Menjalankan scraper

```bash
npm start
# Alternatif:
node scraper.js --manual-login
```

Secara default, target UWG dibaca dari `config/departments.json`, seluruh view yang diketahui dan ditemukan dinamis diproses, dan seluruh halaman pagination dicoba. Chrome/Puppeteer akan berjalan dengan tampilan browser (headful) secara default.

Pilihan CLI:

| Opsi | Fungsi |
| --- | --- |
| `--manual-login` | Buka SINTA untuk login manual sebelum scraping. |
| `--headless` | Jalankan browser tanpa jendela. |
| `--dept informatika` | Batasi ke departemen tertentu; bisa gunakan slug, kode prodi, UUID, atau bagian nama. Pisahkan beberapa target dengan koma. |
| `--view scopus,garuda` | Batasi view ke daftar eksplisit ini. Bila diberikan, discovery view tambahan dinonaktifkan. |
| `--no-discover-views` | Jangan tambahkan view yang ditemukan pada halaman. |
| `--max-pages 5` | Batas maksimum halaman per endpoint/view. Default tanpa batas; batas ini dapat menghasilkan data parsial. |
| `--save-raw` | Simpan snapshot HTML per endpoint/halaman ke `data/raw/`. |
| `--resume` | Muat hasil endpoint yang selesai dari `data/checkpoint.json`; endpoint yang sudah tercatat dilewati. Endpoint yang terputus di tengah pagination akan diulang dari halaman pertama. |
| `--skip-affiliation` | Lewati profil Afiliasi dan indeks Prodi. |
| `--skip-dept-views` | Lewati tab konten Departemen (tetap mengambil daftar dosen kecuali dilewati). |
| `--skip-authors` | Lewati daftar/profil Dosen. |
| `--out DIR` | Direktori keluaran (default `sinta-scraper/data`). |
| `--config FILE` | Gunakan berkas JSON konfigurasi departemen lain. |
| `--delay MS` | Jeda dasar antar navigasi (default 2200 ms, ditambah jitter). |

Contoh:

```bash
node scraper.js --dept informatika --max-pages 3 --save-raw
node scraper.js --skip-affiliation --skip-authors --view scopus,garuda --headless
```

Scraper mempertahankan parameter query yang sudah ada saat membangun `?page=N` (misalnya `view`, `q`, dan `sort`), mengikuti tautan pagination/Next, dan memakai guard untuk URL berulang, halaman kosong, serta konten halaman duplikat. File `data/pagination-audit.json` dan sheet `Pagination_Audit` berisi jumlah halaman/record, status kelengkapan, URL, dan peringatan. `--max-pages` adalah batas eksplisit dan harus dianggap sebagai ekstraksi parsial jika total belum tercapai.

## Ekstrak HTML tersimpan (offline)

Untuk memeriksa file groundtruth bawaan tanpa membuka browser:

```bash
npm run parse:html
```

Untuk satu file, beberapa file, atau satu direktori (direktori dipindai rekursif):

```bash
node extract-html.js "../SINTA - Science and Technology Index-AuthorResearch.html"
node extract-html.js ./data/raw --export --out ./offline-export
```

`--export` membuat JSON, XLSX, CSV UTF-8 BOM, dan dashboard HTML. Snapshot offline tunggal yang melaporkan beberapa halaman tidak bisa mengambil halaman lain dengan sendirinya; masukkan semua snapshot halaman yang tersedia. Audit akan mencatat bahwa sebuah snapshot saja belum membuktikan pagination lengkap.

## Hasil ekspor

Scraping dan ekstraksi offline menghasilkan:

- `data/affiliation.json` (afiliasi + indeks Prodi), `departments.json` (profil Prodi), dan `authors.json`;
- `data/items.json` serta `researches.json` / `services.json` untuk pemetaan Borang;
- `data/content-tables.json` dan `data/pagination-audit.json`;
- `sinta_export.xlsx` (lembar item, publikasi, riset/pengabdian, dosen, ringkasan prodi, audit pagination), `sinta_export.csv`, dan `sinta_export.html`.

Lokasi default berada di `sinta-scraper/data/` dan `sinta-scraper/`; artefak keluaran dikecualikan dari Git.

## Uji & utilitas

```bash
npm test                 # unit/integration tests tanpa akses jaringan atau browser
npm run analyze          # analisis empat HTML groundtruth di root repository
npm run export:borang-penelitian
npm run export:borang-pengabdian
npm run export:report-html
```

Tes menguji ekstraksi empat groundtruth, kecocokan riset dengan fixture, parsing URL/pagination, pagination multi-halaman dan daftar dosen, guard konten duplikat/halaman kosong/login wall, serta format hasil ekspor.

## Konfigurasi lingkungan

Lihat `.env.example` untuk kredensial, path Chrome, jeda, timeout, retry, batas halaman, dan direktori output. Konfigurasi target departemen ada di `config/departments.json`.
