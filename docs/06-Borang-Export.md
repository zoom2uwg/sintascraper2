# Borang Export — Mapping SINTA → Template Excel 2026

Implementasi: `sinta-scraper/export-borang.js` (Node + exceljs).
Template (sumber tunggal, jangan diubah): `Borang SINTA Penelitian - 2026.xlsx`, `Borang SINTA Pengabdian - 2026.xlsx` di root repo.
Kedua template **identik struktur**: 1 sheet `Sheet1`, 38 kolom A–AL, header row 1 (format Text `@`), freeze `A2`, contoh isi row 2.

## Cara pakai

```
node export-borang.js --jenis penelitian --input <data.json> [--authors <authors.json>] [--out exports/borang] [--all] [--template <path>]
npm run export:borang-penelitian
npm run export:borang-pengabdian
```

- `--input`: JSON array item `{judul, leader, scheme, year, fund_rp, status, source, members:[{sinta_id,nama}], sinta_id_ketua?, nidn_ketua?}` (lihat `fixtures/sample-*.json`).
- `--authors`: JSON `[{sinta_id, nama, nidn}]` untuk resolusi ID/NIDN ketua & anggota by nama.
- Default **hanya baris berstatus didanai/Approved** (sesuai header kolom 15 "hanya didanai"); `--all` untuk semua.
- Output menimpa template ke `exports/borang/Borang SINTA {Penelitian|Pengabdian} - 2026 - hasil.xlsx` (di-ignore git).

## Tabel mapping (38 kolom, urut template)

| # | Kolom | Sumber SINTA / aturan | Tipe |
|---|---|---|---|
| 1 | No | nomor urut 1..n | angka |
| 2 | sinta_id_ketua | `item.sinta_id_ketua` → lookup nama ketua → `authors` | angka |
| 3 | nama_ketua | `Leader : X` pada card | teks |
| 4 | nidn_ketua | `item.nidn_ketua` → lookup; kosong bila tak ada | teks |
| 5 | afiliasi_ketua | konstanta (`AFFILIASI_NAMA`, default Universitas Widya Gama) | teks |
| 6 | kd_pt_ketua | konstanta (`AFFILIATION_CODE`, default 071030) | teks |
| 7 | judul | `.ar-title` | teks |
| 8 | nama_singkat_skema | skema: `MANDIRI`→Mandiri; isi kurung→Title Case (`( PERINTIS )`→Perintis) | teks |
| 9–11 | thn_pertama/usulan/pelaksanaan | `year` (ketiganya = tahun card) | angka |
| 12 | lama_kegiatan | konstanta 1 | angka |
| 13 | bidang_fokus | **dikosongkan** (tidak ada di SINTA) | – |
| 14 | nama_skema | teks skema mentah (`.ar-pub`) | teks |
| 15 | status_usulan | Approved→`didanai` | teks |
| 16 | dana_disetujui | `Rp. 4.000.000`→`4000000` | angka |
| 17 | afiliasi_sinta_id | konstanta (`AFFILIATION_ID`, default 2058) | angka |
| 18 | nama_institusi_penerima_dana | = afiliasi_ketua | teks |
| 19 | target_tkt | **dikosongkan** (tidak ada di SINTA) | – |
| 20 | nama_program_hibah | `{Penelitian\|Pengabdian} {singkat}` (cth. Penelitian Perintis) | teks |
| 21 | kategori_sumber_dana | MANDIRI→Mandiri; INTERNAL→Internal; else kosong | teks |
| 22 | negara_sumber_dana | konstanta `ID` | teks |
| 23 | sumber_dana | = kategori (aturan sama) | teks |
| 24–38 | member1..5 × sinta_id/nidn/nama | link `/authors/profile/{id}` di `Personils :` (+lookup NIDN); maks 5, sisanya dihitung `droppedMembers`; `Personils : -`→kosong | teks |

## Jaminan format (terverifikasi otomatis)

- Angka murni (`No`, ID ketua, tahun, dana, afiliasi, TKT) ditulis sebagai **Number**; NIDN/kode PT/ID anggota ditulis **Text** (nol depan awet: `0012046801`, `071030`).
- Style baris-contoh template disalin per kolom (judul & dana font Poppins 11, lainnya Arial 10/11); header, lebar kolom, dan freeze `A2` dipertahankan.
- Contoh template (baris Mohammad Sui) **dibuang** dan diganti data; bukan di-append.

## Yang perlu dilengkapi user

1. **NIDN** tidak tampil di card SINTA — isi via `--authors` (gabung dari halaman authors/dept atau PD-DIKTI) atau kolom tetap kosong.
2. `bidang_fokus` & `target_tkt` tidak ada di SINTA — isi manual pasca-export bila wajib borang.
3. Kosakata `kategori/sumber_dana` (`Internal`, `Mandiri`) mengikuti pola contoh template; cek silang dengan codebook borang sebelum upload.
