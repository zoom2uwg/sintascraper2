# 📊 SINTA Report Exporter

Generator laporan penelitian SINTA dengan layout profesional dalam format PDF dan HTML.

## ✨ Fitur

- ✅ **Layout Modern & Profesional** - Desain responsif dengan gradien warna dan card system
- ✅ **Format Ganda** - Export ke PDF dan HTML
- ✅ **Statistik Lengkap** - Total penelitian, pendanaan, rentang tahun, dan jumlah peneliti
- ✅ **Terorganisir Rapi** - Pengelompokan per tahun dengan card system
- ✅ **Detail Lengkap** - Informasi ketua, anggota, dana, status, dan skema penelitian
- ✅ **Print-Friendly** - Optimized untuk printing
- ✅ **Responsive** - Tampil baik di desktop dan mobile

## 🚀 Cara Penggunaan

### 1. Generate Both PDF & HTML (Default)

```bash
node export-report.js
# atau
node export-report.js both
```

### 2. Generate HTML Only

```bash
node export-report.js html
```

### 3. Generate PDF Only

```bash
node export-report.js pdf
```

### 4. Programmatic Usage

```javascript
const { exportReport } = require('./export-report');

// Basic usage
await exportReport();

// Custom options
await exportReport({
    authorsFile: './data/my-authors.json',
    researchesFile: './data/my-researches.json',
    outputDir: './exports',
    format: 'both', // 'html', 'pdf', or 'both'
    metadata: {
        institution: 'Universitas XYZ',
        department: 'Fakultas Teknik'
    }
});
```

## 📁 Input Data Format

### Authors File (JSON)
```json
[
  {
    "sinta_id": 259792,
    "nama": "Nama Peneliti",
    "nidn": "0123456789"
  }
]
```

### Researches File (JSON)
```json
[
  {
    "judul": "Judul Penelitian",
    "leader": "Nama Ketua",
    "scheme": "Skema Penelitian",
    "year": 2026,
    "fund_rp": 5000000,
    "status": "Approved",
    "source": "INTERNAL SOURCE",
    "members": [
      {
        "sinta_id": 123456,
        "nama": "Nama Anggota"
      }
    ]
  }
]
```

## 📂 Output

Reports disimpan di folder `./output/` dengan nama:
- `laporan-sinta-YYYY-MM-DDTHH-mm-ss.html`
- `laporan-sinta-YYYY-MM-DDTHH-mm-ss.pdf`

## 🎨 Fitur Desain

### Header Section
- Gradient background (Purple to Violet)
- Judul laporan yang menonjol
- Nama institusi
- Tanggal pembuatan laporan

### Statistics Cards
- Total Penelitian
- Total Pendanaan (format Rupiah)
- Rentang Tahun
- Jumlah Peneliti Unik

### Authors Section
- Card-based layout
- Initial avatar dengan warna gradient
- SINTA ID untuk setiap peneliti
- Responsive grid layout

### Research Cards
- Pengelompokan per tahun (descending)
- Badge counter jumlah penelitian per tahun
- Detail lengkap setiap penelitian:
  - Judul penelitian
  - Ketua peneliti
  - Dana penelitian (format Rupiah)
  - Status approval
  - Sumber dana
  - Skema penelitian
  - Daftar anggota tim (tags)
- Hover effects untuk interaktivitas
- Color-coded status dan scheme

### Footer
- Informasi generator
- Link ke sumber data SINTA

## 🖨️ Print Support

Laporan HTML sudah dioptimasi untuk printing:
- White background untuk menghemat tinta
- Page break optimization
- Proper spacing

## 📱 Responsive Design

- Desktop: Multi-column grid layout
- Tablet: Adaptive grid
- Mobile: Single column stack

## 🔧 Dependencies

- `puppeteer` - PDF generation
- `fs` - File system operations
- `path` - Path handling

## 💡 Tips

1. **Custom Styling**: Edit CSS di dalam `generateHTMLReport()` function
2. **PDF Options**: Modify PDF settings di `generatePDF()` function
3. **Data Validation**: Pastikan data JSON valid sebelum generate
4. **Large Dataset**: Untuk dataset besar (>100 penelitian), PDF generation mungkin memerlukan waktu

## 🐛 Troubleshooting

### Error: "Cannot find module puppeteer"
```bash
npm install puppeteer
```

### PDF tidak generate dengan benar
- Pastikan puppeteer berhasil install chromium
- Cek permission folder output

### Styling tidak muncul di PDF
- Set `printBackground: true` di options PDF (sudah default)

## 📝 License

MIT

## 👤 Author

Created with ❤️ for SINTA Research Management
