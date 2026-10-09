/**
 * export-borang.js — Isi template Borang SINTA 2026 (Penelitian / Pengabdian)
 * dari JSON hasil scrape, sesuai 38 kolom template.
 *
 * Template (jangan diubah): ../Borang SINTA Penelitian - 2026.xlsx
 *                           ../Borang SINTA Pengabdian - 2026.xlsx
 * Kolom persis urutan template — lihat docs/06-Borang-Export.md
 *
 * Pakai:
 *   node export-borang.js --jenis penelitian --input fixtures/sample-researches.json --authors fixtures/sample-authors.json
 *   node export-borang.js --jenis pengabdian --input fixtures/sample-services.json [--authors ...] [--out exports/borang] [--all]
 *
 * Format item input (JSON array):
 *   { judul, leader, scheme, year, fund_rp, status, source,
 *     members: [{sinta_id, nama}], sinta_id_ketua?, nidn_ketua? }
 * Format authors (opsional, untuk resolusi ID/NIDN by nama):
 *   [{sinta_id, nama, nidn}]
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// ---- Konstanta afiliasi (default UWG; override via .env) ----
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const CFG = {
  afiliasiNama: process.env.AFFILIASI_NAMA || 'Universitas Widya Gama',
  kdPt: process.env.AFFILIATION_CODE || '071030',
  afiliasiId: parseInt(process.env.AFFILIATION_ID || '2058', 10),
  lamaKegiatan: 1,
  negara: 'ID',
};

const JENIS = {
  penelitian: { template: '../Borang SINTA Penelitian - 2026.xlsx', programPrefix: 'Penelitian', outName: 'Borang SINTA Penelitian - 2026 - hasil.xlsx' },
  pengabdian: { template: '../Borang SINTA Pengabdian - 2026.xlsx', programPrefix: 'Pengabdian', outName: 'Borang SINTA Pengabdian - 2026 - hasil.xlsx' },
};

const normName = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const titleCase = (s) => s.toLowerCase().replace(/(^|\s|-)(\S)/g, (m, p, c) => p + c.toUpperCase());

function parseStatus(s) {
  if (/approved/i.test(s || '')) return 'didanai';
  if (/didanai/i.test(s || '')) return 'didanai';
  return (s || '').trim().toLowerCase() || null;
}

// "PENELITIAN HIBAH INSTITUSI ( PERINTIS )" -> { singkat: "Perintis", nama: <raw> }
// "Mandiri" -> { singkat: "Mandiri", nama: "Mandiri" }
function parseScheme(raw) {
  const t = (raw || '').replace(/\s+/g, ' ').trim();
  if (!t) return { singkat: null, nama: null };
  if (/mandiri/i.test(t)) return { singkat: 'Mandiri', nama: 'Mandiri' };
  const par = t.match(/\(([^)]+)\)/);
  if (par) return { singkat: titleCase(par[1].trim()), nama: t };
  return { singkat: titleCase(t), nama: t };
}

function parseSource(raw, schemeRaw) {
  if (/mandiri/i.test(schemeRaw || '')) return { kategori: 'Mandiri', sumber: 'Mandiri' };
  if (/internal/i.test(raw || '')) return { kategori: 'Internal', sumber: 'Internal' };
  if (/eksternal|external/i.test(raw || '')) return { kategori: 'Eksternal', sumber: 'Eksternal' };
  return { kategori: null, sumber: null };
}

function buildLookup(authors) {
  const byName = new Map();
  for (const a of authors || []) {
    if (a.nama) byName.set(normName(a.nama), a);
  }
  return byName;
}

// Satu item -> array 38 kolom sesuai urutan template.
// Tipe dijaga: angka = Number, teks ID (nidn/kd_pt/member) = String, kosong = null.
function mapToRow(item, jenis, byName, no) {
  const prog = JENIS[jenis].programPrefix;
  const scheme = parseScheme(item.scheme);
  const src = parseSource(item.source, item.scheme);

  let ketuaId = item.sinta_id_ketua ?? null;
  let ketuaNidn = item.nidn_ketua ?? null;
  if ((ketuaId == null || ketuaNidn == null) && item.leader) {
    const hit = byName.get(normName(item.leader));
    if (hit) {
      if (ketuaId == null && hit.sinta_id != null) ketuaId = Number(hit.sinta_id);
      if (ketuaNidn == null && hit.nidn != null) ketuaNidn = String(hit.nidn);
    }
  }

  const row = [
    no,                                            // 1  No (n)
    ketuaId != null ? Number(ketuaId) : null,      // 2  sinta_id_ketua (n)
    item.leader || null,                           // 3  nama_ketua (s)
    ketuaNidn != null ? String(ketuaNidn) : null,  // 4  nidn_ketua (s, text: awet nol depan)
    CFG.afiliasiNama,                              // 5  afiliasi_ketua
    String(CFG.kdPt),                              // 6  kd_pt_ketua (s, text)
    item.judul || null,                            // 7  judul
    scheme.singkat,                                // 8  nama_singkat_skema
    item.year != null ? Number(item.year) : null,  // 9  thn_pertama_usulan (n)
    item.year != null ? Number(item.year) : null,  // 10 thn_usulan_kegiatan (n)
    item.year != null ? Number(item.year) : null,  // 11 thn_pelaksanaan_kegiatan (n)
    CFG.lamaKegiatan,                              // 12 lama_kegiatan(tahun) (n)
    null,                                          // 13 bidang_fokus (tidak ada di SINTA)
    scheme.nama,                                   // 14 nama_skema
    parseStatus(item.status),                      // 15 status_usulan
    item.fund_rp != null ? Number(item.fund_rp) : null, // 16 dana_disetujui (n)
    CFG.afiliasiId,                                // 17 afiliasi_sinta_id (n)
    CFG.afiliasiNama,                              // 18 nama_institusi_penerima_dana
    null,                                          // 19 target_tkt (tidak ada di SINTA)
    scheme.singkat ? `${prog} ${scheme.singkat}` : null, // 20 nama_program_hibah
    src.kategori,                                  // 21 kategori_sumber_dana
    CFG.negara,                                    // 22 negara_sumber_dana
    src.sumber,                                    // 23 sumber_dana
  ];

  // 24-38: 5 slot member × (sinta_id TEXT, nidn text, nama text)
  const members = (item.members || []).slice(0, 5);
  const dropped = (item.members || []).length - members.length;
  for (const m of members) {
    let mid = m.sinta_id ?? null;
    let mnidn = m.nidn ?? null;
    if ((mid == null || mnidn == null) && m.nama) {
      const hit = byName.get(normName(m.nama));
      if (hit) {
        if (mid == null && hit.sinta_id != null) mid = hit.sinta_id;
        if (mnidn == null && hit.nidn != null) mnidn = hit.nidn;
      }
    }
    row.push(mid != null ? String(mid) : null, mnidn != null ? String(mnidn) : null, m.nama || null);
  }
  while (row.length < 38) row.push(null, null, null);
  return { row: row.slice(0, 38), dropped };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      out[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jenis = (args.jenis || '').toLowerCase();
  if (!JENIS[jenis]) {
    console.error('Wajib: --jenis penelitian|pengabdian');
    process.exit(1);
  }
  if (!args.input) {
    console.error('Wajib: --input <file.json>');
    process.exit(1);
  }
  const items = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const authors = args.authors ? JSON.parse(fs.readFileSync(args.authors, 'utf8')) : [];
  const byName = buildLookup(authors);
  const onlyFunded = args.all !== true && args.all !== 'true';

  const templatePath = path.resolve(__dirname, args.template || JENIS[jenis].template);
  if (!fs.existsSync(templatePath)) {
    console.error('Template tidak ditemukan: ' + templatePath);
    process.exit(1);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('Sheet1') || wb.worksheets[0];

  // Salin style baris-contoh (row 2) per kolom agar baris data tampil identik.
  const styleByCol = {};
  ws.getRow(2).eachCell({ includeEmpty: true }, (cell, n) => {
    styleByCol[n] = JSON.parse(JSON.stringify(cell.style));
  });
  // Buang isi baris-contoh (row >= 2), tulis ulang dari row 2.
  // Catatan: ws.spliceRows() no-op untuk sheet hasil load (quirk exceljs),
  // jadi nilai sel dikosongkan manual; style dipertahankan.
  const lastRow = ws.rowCount;
  for (let n = 2; n <= lastRow; n++) {
    ws.getRow(n).eachCell({ includeEmpty: true }, (cell) => { cell.value = null; });
  }
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]; // kunci header (A2)

  let no = 0;
  let skipped = 0;
  let droppedMembers = 0;
  for (const item of items) {
    const st = parseStatus(item.status);
    if (onlyFunded && st !== 'didanai') { skipped++; continue; }
    no++;
    const { row, dropped } = mapToRow(item, jenis, byName, no);
    droppedMembers += dropped;
    const r = ws.getRow(no + 1);
    row.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v;
      if (styleByCol[i + 1]) cell.style = JSON.parse(JSON.stringify(styleByCol[i + 1]));
    });
    r.commit();
  }

  const outDir = path.resolve(__dirname, args.out || path.join('exports', 'borang'));
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, JENIS[jenis].outName);
  await wb.xlsx.writeFile(outPath);
  console.log(JSON.stringify({ jenis, template: path.basename(templatePath), rows: no, skippedNonFunded: skipped, droppedMembers, out: outPath }));
}

main().catch((e) => { console.error('EXPORT_FAIL: ' + (e && e.message)); process.exit(1); });
