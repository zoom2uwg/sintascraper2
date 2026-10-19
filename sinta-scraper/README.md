# SINTAScraper (Node.js)

**SINTAScraper** adalah sebuah *tools* otomatisasi (bot) berbasis Chrome (Puppeteer) yang dirancang untuk mengekstraksi data kinerja akademik dari portal **SINTA (Kemdikbudristek)**. Alat ini dirancang khusus untuk mengambil data departemen dan profil individu dosen (*authors*), lalu mengekspornya secara terstruktur ke dalam format **Excel (.xlsx)**, **CSV (.csv)**, dan **HTML (.html)**.

Proyek ini sepenuhnya ditulis menggunakan ekosistem **Node.js** dan tidak memerlukan Python.

---

## 1. Persyaratan Sistem

Sebelum mulai, pastikan komputer Anda telah terpasang perangkat lunak berikut:
- **Node.js** (versi 16.x atau lebih baru). [Unduh Node.js di sini](https://nodejs.org/).
- Akses internet yang stabil (sangat disarankan tidak menggunakan VPN atau server Cloud/Data Center untuk menghindari pemblokiran *Web Application Firewall* / Cloudflare SINTA).

---

## 2. Instalasi

Ikuti langkah-langkah di bawah ini untuk mengatur proyek di komputer lokal Anda:

### Langkah 1: Buat Direktori Proyek
Buka Terminal (Mac/Linux) atau Command Prompt / PowerShell (Windows), lalu buat folder baru dan masuk ke folder tersebut:
```bash
mkdir sinta-scraper
cd sinta-scraper
```

### Langkah 2: Inisialisasi Node.js
```bash
npm init -y
```

### Langkah 3: Install Dependensi (*Libraries*)
Jalankan perintah ini untuk memasang semua *package* yang dibutuhkan (Puppeteer untuk automasi browser, ExcelJS & CSV-Writer untuk *export* data):
```bash
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth dotenv exceljs csv-writer
```

---

## 3. Konfigurasi Kredensial (.env)

Sistem memerlukan kredensial login (username & password) agar dapat mengakses SINTA. Jangan pernah menaruh *password* langsung ke dalam kode.

Buat sebuah file baru bernama `.env` di dalam folder `sinta-scraper` dan isi dengan akun SINTA Anda:

```env
SINTA_USER=masukkan_email_atau_username_sinta_anda
SINTA_PASS=masukkan_password_sinta_anda
```

*(Catatan: Jika `.env` tidak diisi, bot akan otomatis mencoba menjalankan *scraping* menggunakan mode publik / Guest tanpa login).*

---

## 4. Source Code (`scraper.js`)

Buat sebuah file baru bernama `scraper.js` di folder proyek Anda dan tempel (*copy-paste*) kode di bawah ini:

```javascript
require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const ExcelJS = require('exceljs');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');

// Membaca dari .env
const { SINTA_USER, SINTA_PASS } = process.env;

// Konfigurasi Target Departemen
const DEPARTMENTS = [
    {
        name: 'Informatika',
        url: 'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/8A894EDC-B2F1-4575-95B8-91EB1E708F4F',
        authorsUrl: 'https://sinta.kemdiktisaintek.go.id/departments/authors/2058/420D8E73-68F0-4044-86CF-5138D1419B20/8A894EDC-B2F1-4575-95B8-91EB1E708F4F'
    },
    {
        name: 'Bisnis Digital',
        url: 'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/BB930200-F625-4220-BD63-94F4D1FD2E50',
        authorsUrl: 'https://sinta.kemdiktisaintek.go.id/departments/authors/2058/420D8E73-68F0-4044-86CF-5138D1419B20/BB930200-F625-4220-BD63-94F4D1FD2E50'
    },
    {
        name: 'Sistem dan Teknologi Informasi',
        url: 'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/895FD91B-B0F2-41E7-99EB-F2D3997A9B0F',
        authorsUrl: 'https://sinta.kemdiktisaintek.go.id/departments/authors/2058/420D8E73-68F0-4044-86CF-5138D1419B20/895FD91B-B0F2-41E7-99EB-F2D3997A9B0F'
    }
];

const VIEWS = ['scopus', 'garuda', 'googlescholar', 'researches', 'services', 'iprs', 'books'];
const delay = ms => new Promise(res => setTimeout(res, ms));

async function scrapeTableData(page) {
    return await page.evaluate(() => {
        const items = [];
        // Analisa DOM berdasarkan struktur asli SINTA
        document.querySelectorAll('.ar-list-item').forEach(el => {
            const titleEl = el.querySelector('.ar-title a');
            
            // Gabungkan semua metadata (Penulis, Quartile, Tahun, dll)
            const metaNodes = el.querySelectorAll('.ar-meta');
            let metaText = '';
            metaNodes.forEach(node => {
                metaText += node.innerText.replace(/\s+/g, ' ').trim() + ' | ';
            });
            
            if (titleEl && titleEl.innerText.trim() !== '') {
                items.push({
                    title: titleEl.innerText.trim(),
                    metadata: metaText !== '' ? metaText : '-',
                    link: titleEl.href ? titleEl.href : '-'
                });
            }
        });
        return items;
    });
}

async function scrapeAuthorsFromDept(page, url) {
    console.log(`Navigating to Authors list: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(3000);
    
    return await page.evaluate(() => {
        const authorLinks = [];
        document.querySelectorAll('a[href*="/authors/profile/"]').forEach(a => {
            const href = a.href;
            const name = a.innerText.trim();
            // Hindari link hashtag (#) atau blank names
            if (!href.endsWith('#') && name !== '' && !authorLinks.some(l => l.url === href)) {
                authorLinks.push({ name: name, url: href });
            }
        });
        return authorLinks;
    });
}

async function runScraper() {
    console.log("Starting SINTAScraper...");
    // headless: false (Browser tampil secara visual agar tidak diblokir Anti-Bot)
    const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    try {
        console.log("Navigating to login page...");
        await page.goto('https://sinta.kemdiktisaintek.go.id/logins', { waitUntil: 'networkidle2' });
        
        if (SINTA_USER && SINTA_PASS) {
            console.log("Filling login form...");
            await page.type('input[name="username"], input[name="email"]', SINTA_USER);
            await page.type('input[name="password"]', SINTA_PASS);
            await Promise.all([
                page.click('button[type="submit"], input[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);
            console.log("Login success.");
        } else {
            console.log("No auth in .env, continuing as Guest...");
        }
        
        let allExtractedData = [];

        // --- 1. Ekstrak dari Tiap Departemen ---
        for (const dept of DEPARTMENTS) {
            console.log(`\n=== Processing Department: ${dept.name} ===`);
            
            for (const view of VIEWS) {
                const targetUrl = `${dept.url}/?view=${view}`;
                console.log(`Scraping View: ${view} -> ${targetUrl}`);
                await page.goto(targetUrl, { waitUntil: 'networkidle2' });
                await delay(2500 + Math.random() * 2000); // Random delay (Anti-Bot)
                
                const data = await scrapeTableData(page);
                data.forEach(item => {
                    allExtractedData.push({ entityType: 'Department', entityName: dept.name, category: view, ...item });
                });
            }

            // --- 2. Dapatkan Link Author ---
            const authors = await scrapeAuthorsFromDept(page, dept.authorsUrl);
            console.log(`Found ${authors.length} authors in ${dept.name}`);

            // --- 3. Ekstrak Berdasarkan Masing-masing Author ---
            for (const author of authors) {
                console.log(`\n--- Processing Author: ${author.name} ---`);
                for (const view of VIEWS) {
                    const authorTargetUrl = `${author.url}/?view=${view}`;
                    await page.goto(authorTargetUrl, { waitUntil: 'networkidle2' });
                    await delay(2000 + Math.random() * 2000); 
                    
                    const data = await scrapeTableData(page);
                    data.forEach(item => {
                        allExtractedData.push({ entityType: 'Author', entityName: author.name, category: view, ...item });
                    });
                }
            }
        }

        console.log(`Total data terambil: ${allExtractedData.length} baris. Memulai export...`);
        
        // EXPORT CSV
        const csvWriter = createObjectCsvWriter({
            path: 'sinta_export.csv',
            header: [
                { id: 'entityType', title: 'TYPE' }, { id: 'entityName', title: 'NAME' },
                { id: 'category', title: 'CATEGORY' }, { id: 'title', title: 'TITLE' },
                { id: 'metadata', title: 'METADATA (Authors/Tahun/DLL)' }, { id: 'link', title: 'LINK' }
            ]
        });
        await csvWriter.writeRecords(allExtractedData);

        // EXPORT EXCEL
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('SINTA Data');
        sheet.columns = [
            { header: 'Type', key: 'entityType', width: 15 }, 
            { header: 'Name', key: 'entityName', width: 25 },
            { header: 'Category', key: 'category', width: 15 }, 
            { header: 'Title', key: 'title', width: 50 },
            { header: 'Metadata (Authors/Tahun/DLL)', key: 'metadata', width: 60 }, 
            { header: 'Link', key: 'link', width: 40 }
        ];
        sheet.addRows(allExtractedData);
        await workbook.xlsx.writeFile('sinta_export.xlsx');

        // EXPORT HTML
        let htmlContent = `<table border="1" style="border-collapse: collapse; font-family: Arial;">
            <tr style="background:#ddd;"><th>Type</th><th>Name</th><th>Category</th><th>Title</th><th>Metadata</th><th>Link</th></tr>` +
            allExtractedData.map(r => `<tr><td>${r.entityType}</td><td>${r.entityName}</td><td>${r.category}</td><td>${r.title}</td><td>${r.metadata}</td><td><a href="${r.link}" target="_blank">Link</a></td></tr>`).join('') +
            `</table>`;
        fs.writeFileSync('sinta_export.html', htmlContent);
        
        console.log("Selesai! File sinta_export.xlsx, .csv, dan .html berhasil dibuat.");
    } catch (err) {
        console.error("Scraping error:", err);
    } finally {
        await browser.close();
    }
}
runScraper();
```

---

## 5. Cara Menjalankan

Buka terminal di folder proyek Anda dan ketikkan perintah berikut:
```bash
node scraper.js
```

**Apa yang akan terjadi?**
1. Sebuah _browser_ Chrome akan terbuka secara otomatis.
2. Bot akan mengarahkan browser ke halaman SINTA dan melakukan *login* dengan data di `.env`.
3. Bot akan mulai mengunjungi tautan per Departemen, merubah parameter _view_ (`scopus`, `garuda`, dll).
4. Bot mengambil seluruh nama dosen (*author*) di dalam departemen tersebut, kemudian masuk ke profil setiap dosen dan mengambil data publikasi.
5. Bot melakukan jeda (*delay*) dinamis 2 hingga 4 detik antar-halaman untuk mencegah deteksi Bot.
6. Setelah semua selesai, browser akan otomatis tertutup dan Anda akan menemukan tiga (3) file baru di dalam folder Anda:
   - `sinta_export.xlsx` (File Excel siap lapor)
   - `sinta_export.csv`
   - `sinta_export.html` (Preview Tabel Data)

---

## 6. 📊 Export Laporan Profesional (NEW!)

Fitur baru untuk menghasilkan laporan penelitian dalam format **PDF** dan **HTML** dengan layout modern dan profesional.

### Fitur Laporan:
- ✨ **Layout Modern** - Desain dengan gradien warna dan card system
- 📊 **Statistik Lengkap** - Total penelitian, pendanaan, rentang tahun, peneliti
- 📁 **Terorganisir** - Pengelompokan per tahun dengan detail lengkap
- 🖨️ **Print-Ready** - Optimized untuk printing
- 📱 **Responsive** - Tampil baik di semua device

### Cara Menggunakan:

#### Generate Both PDF & HTML:
```bash
npm run export:report
# atau
node export-report.js both
```

#### Generate HTML Only:
```bash
npm run export:report-html
# atau
node export-report.js html
```

#### Generate PDF Only:
```bash
npm run export:report-pdf
# atau
node export-report.js pdf
```

### Input Data:
Laporan menggunakan data dari:
- `fixtures/sample-authors.json` - Daftar peneliti
- `fixtures/sample-researches.json` - Daftar penelitian

### Output:
File laporan disimpan di folder `output/` dengan format:
- `laporan-sinta-YYYY-MM-DDTHH-mm-ss.html`
- `laporan-sinta-YYYY-MM-DDTHH-mm-ss.pdf`

### Contoh Programmatic Usage:
```javascript
const { exportReport } = require('./export-report');

await exportReport({
    authorsFile: './data/authors.json',
    researchesFile: './data/researches.json',
    outputDir: './reports',
    format: 'both',
    metadata: {
        institution: 'Universitas Widyagama Malang'
    }
});
```

📖 **Dokumentasi lengkap:** Lihat [README-EXPORT.md](./README-EXPORT.md)

---

## 7. NPM Scripts

Berikut daftar perintah yang tersedia:

```bash
npm start                        # Jalankan scraper
npm run export:report            # Export laporan PDF & HTML
npm run export:report-html       # Export laporan HTML saja
npm run export:report-pdf        # Export laporan PDF saja
npm run export:borang-penelitian # Export borang penelitian ke Excel
npm run export:borang-pengabdian # Export borang pengabdian ke Excel
```

---
*Dikembangkan dengan teknologi Puppeteer & Node.js.*
