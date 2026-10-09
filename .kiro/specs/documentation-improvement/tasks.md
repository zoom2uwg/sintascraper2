# Implementation Plan: SINTAScraper Documentation Improvement

**Feature:** documentation-improvement  
**Version:** 1.0  
**Estimated Effort:** 1.5 days (12 hours)  
**Approach:** Hybrid (Phase 1: File-by-file + Phase 2: Cross-cutting validation)

---

## Overview

This implementation plan addresses 23 identified documentation issues through surgical, targeted edits across 4 documentation files (PRD, Requirements, Design, Tasks). The approach prioritizes critical P0 requirements first, followed by high-priority P1 requirements, with P2 enhancements deferred as time permits.

**Key Principles:**
- Surgical edits only - preserve existing valid content
- Groundtruth findings as source of truth
- Cross-document consistency validation
- Measurable acceptance criteria
- Incremental progress with git commits per epic

---

## PHASE 1: Critical P0 Requirements (File-by-File)

### EPIC 1: Requirements.md Updates (P0)

**Objective:** Add missing sections, standardize terminology, fix critical specification gaps  
**Duration:** 4 hours  
**Validates:** REQ-1, REQ-2, REQ-3, REQ-4, REQ-6, REQ-10, REQ-13, REQ-15

---

#### Task 1.1: Add Error Taxonomy Section

**Validates:** REQ-11 (Error Code Standardization), REQ-NFR-03  
**File:** `docs/02-Requirements.md`  
**Location:** New §4 after §3 Non-Functional Requirements  
**Time Estimate:** 45 minutes

**Detailed Changes:**

- [ ] 1.1.1 Create new section "## 4. Error Taxonomy & Handling Strategy"
  - Insert after line ~185 (after §3 Non-Functional Requirements table)
  - Use template from Design §2.1.1

- [ ] 1.1.2 Add subsection "### 4.1 Error Classification" with table containing:
  - Error codes: `LOGIN_TIMEOUT`, `SESSION_EXPIRED`, `SELECTOR_NOT_FOUND`, `PAGINATION_MISMATCH`, `NETWORK_TIMEOUT`, `INVALID_DEDUP_KEY`, `EMPTY_VIEW_VERIFIED`
  - Columns: Error Code | Category | Description | Recovery Strategy | Screenshot
  - Map each error to requirements (e.g., LOGIN_TIMEOUT → REQ-AUTH-03)

- [ ] 1.1.3 Add subsection "### 4.2 Error Handling Principles"
  - Document 5 principles: Non-Fatal Errors, Idempotent Retry, Audit Trail, Screenshot Capture, Graceful Degradation
  - Cross-reference REQ-NFR-03 (Observability)

- [ ] 1.1.4 Add subsection "### 4.3 Screenshot Naming Convention"
  - Specify format: `data/logs/err_{error_code}_{timestamp}_{context}.png`
  - Provide 3 examples from different error scenarios

- [ ] 1.1.5 Renumber subsequent sections (§4 Environment Config becomes §5)

**Definition of Done:**
- ✅ Error taxonomy table includes all 7 error codes with complete recovery strategies
- ✅ Each error code references at least one REQ-* ID
- ✅ Screenshot naming follows documented convention
- ✅ All subsequent section numbers updated correctly
- ✅ No broken internal references

---

#### Task 1.2: Standardize View List Across Document

**Validates:** REQ-1 (View List Standardization)  
**File:** `docs/02-Requirements.md`  
**Locations:** REQ-VIEW-06 (line ~133), §2 Data Contract examples  
**Time Estimate:** 30 minutes

**Detailed Changes:**

- [ ] 1.2.1 Update REQ-VIEW-06 (line ~133) to canonical view list:
  - Old: `scopus, garuda, googlescholar, researches, services, iprs, books, rama, pak, kepakaran, matrics, arts`
  - New: `scopus, wos (tersembunyi CSS, tetap scrape), garuda, googlescholar, researches, services, iprs, books, rama, pak, kepakaran, matrics, arts`
  - Add note: "Sistem harus parse tab navigasi runtime untuk deteksi view baru secara otomatis."

- [ ] 1.2.2 Add explicit WOS view handling note:
  - Insert after REQ-VIEW-06: "**Catatan WOS**: View `wos` mungkin memiliki class CSS `d-none` (tersembunyi) tetapi wajib tetap di-scrape menggunakan selector `li.d-none a[href*='view=wos']`."

- [ ] 1.2.3 Update §2.1 Scopus record example to include `wos` in view field options

- [ ] 1.2.4 Verify all view references in Data Contract examples use canonical names

**Definition of Done:**
- ✅ REQ-VIEW-06 lists all 13 views in canonical order
- ✅ WOS handling explicitly documented with selector
- ✅ All view references consistent across Requirements.md
- ✅ Groundtruth §1.6 and §2.3 cross-referenced

---

#### Task 1.3: Enhance Dedup Key Specification

**Validates:** REQ-2 (Dedup Key Strategy Specification), REQ-VIEW-05  
**File:** `docs/02-Requirements.md`  
**Location:** REQ-VIEW-05 (line ~126)  
**Time Estimate:** 45 minutes

**Detailed Changes:**

- [ ] 1.3.1 Expand REQ-VIEW-05 with complete algorithm:
  - Current: Brief mention of composite dedup key
  - Add decision tree:
    1. IF Scopus URL exists → `"scopus:" + scopus_eid`
    2. ELSE IF IPR nomor_permohonan exists → `"iprs:" + nomor_permohonan`
    3. ELSE → `view + ":" + MD5(normalized_title + "_" + year + "_" + (leader || inventor || creator || ""))`

- [ ] 1.3.2 Add code example in fenced block:
```javascript
function computeDedupKey(record, context) {
  if (record.scopus_eid) {
    return `scopus:${record.scopus_eid}`;
  }
  if (record.nomor_permohonan) {
    return `iprs:${record.nomor_permohonan}`;
  }
  const rawKey = `${record.title}_${record.year || 0}_${record.leader || record.inventor || record.creator || ''}`;
  const hash = crypto.createHash('md5').update(rawKey).digest('hex').substring(0, 16);
  return `${context.view}:${hash}`;
}
```

- [ ] 1.3.3 Add warning note:
  - "**PENTING**: Internal dummy links (`href='#!'`) tidak boleh digunakan sendiri sebagai dedup key. Gunakan composite key berbasis konten."

- [ ] 1.3.4 Cross-reference Groundtruth §1.3 explicitly

**Definition of Done:**
- ✅ Dedup key algorithm complete with all 3 decision branches
- ✅ Code example compiles and matches Design §4.1 implementation
- ✅ Dummy link warning clearly stated
- ✅ Groundtruth finding §1.3 referenced

---

#### Task 1.4: Update Pagination Mechanism to Numbered Pages

**Validates:** REQ-3 (Pagination Mechanism Clarity), REQ-VIEW-01  
**File:** `docs/02-Requirements.md`  
**Location:** REQ-VIEW-01 (line ~117)  
**Time Estimate:** 40 minutes

**Detailed Changes:**

- [ ] 1.4.1 Replace REQ-VIEW-01 content:
  - Remove: All mentions of "View more button" and "auto-scroll"
  - Add: "**Numbered Pagination Loop (Groundtruth Standard):** Untuk setiap kombinasi (dept × view), buka `?page=1&view={key}`. Ekstrak teks pagination dari `div.pagination-text small` dengan regex `/Page (\d+) of (\d+) \| Total Records (\d+)/`."

- [ ] 1.4.2 Add pagination validation rule:
  - "Lakukan iterasi `page = 1..total_pages` untuk mengambil seluruh halaman."
  - "Validasi integritas: jika `Total Records > 0` tetapi item ter-parse `0`, sistem wajib mencatat error selector."

- [ ] 1.4.3 Add fallback mode note:
  - "Fallback mode: auto-scroll dan tombol 'View more...' hanya aktif jika pagination bar tidak ditemukan."

- [ ] 1.4.4 Add regex pattern specification in code block:
```javascript
const paginationRegex = /Page\s+(\d+)\s+of\s+(\d+)\s*\|\s*Total Records\s+(\d+)/i;
```

- [ ] 1.4.5 Cross-reference Groundtruth §1.1 and §2.1

**Definition of Done:**
- ✅ REQ-VIEW-01 primary mechanism is numbered pagination
- ✅ Fallback to View-more clearly marked as secondary
- ✅ Validation rule for empty results documented
- ✅ Regex pattern provided and tested
- ✅ Groundtruth §1.1 referenced

---

#### Task 1.5: Add WOS View Requirement

**Validates:** REQ-4 (WOS View Handling)  
**File:** `docs/02-Requirements.md`  
**Location:** New requirement after REQ-VIEW-06  
**Time Estimate:** 25 minutes

**Detailed Changes:**

- [ ] 1.5.1 Insert new requirement REQ-VIEW-07 after REQ-VIEW-06:
```markdown
| **REQ-VIEW-07** | **WOS View Scraping**: View `wos` (Web of Science) wajib di-scrape meskipun memiliki CSS class `d-none` (tersembunyi di UI). Sistem harus mendeteksi tab WOS menggunakan selector `li.d-none a[href*="view=wos"]` dan mengunjungi URL WOS secara langsung. | P0 |
```

- [ ] 1.5.2 Add note below table:
  - "**Rasionalisasi WOS**: SINTA menyembunyikan tab WOS secara visual (`display:none`) tetapi URL view tetap valid dan berisi data publikasi Web of Science yang penting untuk metrik institusi."

- [ ] 1.5.3 Cross-reference Groundtruth §1.6 and §2.5

**Definition of Done:**
- ✅ REQ-VIEW-07 created with P0 priority
- ✅ Selector for hidden WOS tab documented
- ✅ Rationale for scraping hidden view explained
- ✅ Groundtruth §1.6 referenced

---

#### Task 1.6: Enhance Field Extraction Specifications

**Validates:** REQ-6 (Field Extraction Completeness), REQ-VIEW-02  
**File:** `docs/02-Requirements.md`  
**Locations:** REQ-VIEW-02 parser spec, §2 Data Contract schemas  
**Time Estimate:** 50 minutes

**Detailed Changes:**

- [ ] 1.6.1 Update REQ-VIEW-02 field extraction table with complete field list per view:
  - **scopus**: Add `scopus_eid`, `author_order` (format "N of M")
  - **researches/services**: Add `personil_names` (array), `personil_ids` (array), `fund_rp`, `status`, `source`
  - **iprs**: Add `nomor_permohonan`, `ipr_type`

- [ ] 1.6.2 Update §2.1 Scopus record schema (line ~148):
  - Add missing fields: `scopus_eid`, `author_order`
  - Example values from Groundtruth: `"scopus_eid": "2-s2.0-105029558167"`, `"author_order": "0 of 5"`

- [ ] 1.6.3 Update §2.2 Researches record schema (line ~165):
  - Add `personil_names: ["Hanif Rani Iswari"]`
  - Add `personil_ids: [6738705]`
  - Add `fund_rp: "Rp. 4.000.000"`
  - Add `status: "Approved"`
  - Add `source: "INTERNAL SOURCE"`

- [ ] 1.6.4 Update §2.3 IPRs record schema (line ~182):
  - Add `nomor_permohonan: "EC002024234761"`
  - Add `ipr_type: "Hak Cipta"`

- [ ] 1.6.5 Cross-reference Groundtruth §3 (Skema kolom per view)

**Definition of Done:**
- ✅ All view-specific fields documented in REQ-VIEW-02
- ✅ JSON schemas in §2 updated with missing fields
- ✅ Example values from actual Groundtruth fixtures
- ✅ Field extraction completeness verified against Groundtruth §3
- ✅ No fields missing compared to HTML samples

---

#### Task 1.7: Enhance Session Verification Specification

**Validates:** REQ-10 (Session Verification Enhancement), REQ-AUTH-03, REQ-AUTH-04  
**File:** `docs/02-Requirements.md`  
**Locations:** REQ-AUTH-03 (line ~33), REQ-AUTH-04 (line ~36)  
**Time Estimate:** 35 minutes

**Detailed Changes:**

- [ ] 1.7.1 Update REQ-AUTH-03 verification criteria:
  - Change: "URL kembali ke beranda/profil" → "URL kembali ke beranda/profil **DAN**"
  - Add: "elemen logout `a.dropdown-item[href$="/logins/logout"]` terdeteksi di DOM beserta nama akun (misal `SYAHRONI`)"
  - Specify: "Kedua kondisi wajib terpenuhi untuk `LOGIN_SUCCESS`"

- [ ] 1.7.2 Add selector code example:
```javascript
const isLoggedIn = await page.evaluate(() => {
  const logoutLink = document.querySelector('a.dropdown-item[href$="/logins/logout"]');
  const hasUsername = document.body.innerText.includes('SYAHRONI');
  return logoutLink !== null && hasUsername;
});
```

- [ ] 1.7.3 Update REQ-AUTH-04 session guard:
  - Add: "sebelum setiap navigasi prodi atau view publikasi, periksa keberadaan selector logout"
  - Specify recovery: "picu prosedur re-login otomatis 1x lalu lanjutkan navigasi ke URL target tanpa mengulang dari awal"

- [ ] 1.7.4 Cross-reference Groundtruth §2.6 (Login detector)

**Definition of Done:**
- ✅ REQ-AUTH-03 requires both URL AND DOM selector check
- ✅ Logout selector explicitly documented
- ✅ Username presence requirement added
- ✅ Code example validates in browser context
- ✅ Groundtruth §2.6 referenced

---

#### Task 1.8: Add Personil Extraction Documentation

**Validates:** REQ-15 (Personil Extraction Documentation), REQ-VIEW-02  
**File:** `docs/02-Requirements.md`  
**Location:** REQ-VIEW-02 parser specification  
**Time Estimate:** 30 minutes

**Detailed Changes:**

- [ ] 1.8.1 Add subsection to REQ-VIEW-02 for personil extraction:
  - "**Ekstraksi Personil Penelitian/Pengabdian**:"
  - "Nama personil diekstrak dari teks setelah label `Personils :`"
  - "SINTA ID personil diekstrak dari link `a[href*='/authors/profile/']`"
  - "Jika personil kosong (teks `-`), simpan array kosong `[]`"

- [ ] 1.8.2 Add code example:
```javascript
const personilLinks = el.querySelectorAll('.ar-meta a[href*="/authors/profile/"]');
const personilNames = [];
const personilIds = [];
personilLinks.forEach(a => {
  const href = a.getAttribute('href');
  const match = href.match(/\/authors\/profile\/(\d+)/);
  if (match) {
    personilIds.push(parseInt(match[1]));
    personilNames.push(a.innerText.trim());
  }
});
```

- [ ] 1.8.3 Add example from Groundtruth:
  - "Contoh: `Personils : <a href='/authors/profile/6738705'>Hanif Rani Iswari</a>` → `personil_names: ['Hanif Rani Iswari']`, `personil_ids: [6738705]`"

- [ ] 1.8.4 Cross-reference Groundtruth §1.4 and §3

**Definition of Done:**
- ✅ Personil extraction rules documented
- ✅ Handling of empty personil (`-`) specified
- ✅ Code example extracts both names and IDs
- ✅ Real example from Groundtruth fixture
- ✅ Groundtruth §1.4 referenced

---

#### Task 1.9: Update SQLite Schema Documentation

**Validates:** REQ-13 (Data Schema Completeness)  
**File:** `docs/02-Requirements.md`  
**Location:** Would be in Design.md §5, but need to note requirements  
**Time Estimate:** 20 minutes

**Detailed Changes:**

- [ ] 1.9.1 Add note to §2 Data Contract header:
  - "**Catatan**: Skema database SQLite lengkap dengan semua field ini terdokumentasi di [Design §5](file:///d:/laragon/www/sintascraper/docs/03-Design.md#5-skema-database-sqlite-datadbsqlite)"

- [ ] 1.9.2 Verify all fields in Data Contract schemas (§2.1-2.4) have corresponding SQLite columns

- [ ] 1.9.3 Add cross-reference note in §2.1:
  - "Field `scopus_eid`, `author_order`, `nomor_permohonan`, `fund_rp` harus memiliki kolom di tabel `items` (lihat Design §5)"

**Definition of Done:**
- ✅ Cross-reference to Design §5 added
- ✅ All Data Contract fields mapped to SQLite columns
- ✅ No orphaned fields in schemas

---

**EPIC 1 CHECKPOINT:**
- [ ] Run `git add docs/02-Requirements.md`
- [ ] Run `git commit -m "docs: P0 requirements updates - error taxonomy, view list, dedup key, pagination, WOS, fields, session, personil"`
- [ ] Verify all internal section references still valid
- [ ] Verify no broken links introduced

**EPIC 1 Definition of Done:**
- ✅ All 9 P0 requirement gaps addressed
- ✅ Error taxonomy section complete (7 error codes)
- ✅ View list standardized to canonical 13 views
- ✅ Dedup key algorithm fully specified with code
- ✅ Pagination mechanism updated to numbered pages
- ✅ WOS view handling explicitly documented
- ✅ All field schemas updated with missing fields
- ✅ Session verification enhanced with selector check
- ✅ Personil extraction fully documented
- ✅ SQLite schema cross-referenced
- ✅ Git commit created with clear message

---

### EPIC 2: Design.md Updates (P0)

**Objective:** Add selector catalog, update parser specifications, add validation sections  
**Duration:** 3 hours  
**Validates:** REQ-2, REQ-3, REQ-6, REQ-7, REQ-13

---

#### Task 2.1: Create Complete Selector Catalog

**Validates:** REQ-7 (Selector Precision Standards)  
**File:** `docs/03-Design.md`  
**Location:** New §4.5 after §4.4 Parser Informasi Pagination  
**Time Estimate:** 75 minutes

**Detailed Changes:**

- [ ] 2.1.1 Insert new section "### 4.5 Selector Reference Catalog"
  - Location: After line ~380 (after parsePaginationInfo function)

- [ ] 2.1.2 Add subsection "#### 4.5.1 Authentication & Session" table:
  - 5 selectors: login username, login password, logout link, user account name, login redirect check
  - Columns: Element | Selector | Purpose | Expected Value
  - Source selectors from Groundtruth §2.6

- [ ] 2.1.3 Add subsection "#### 4.5.2 Department Structure" table:
  - 6 selectors: dept row container, dept level, dept name + URL, dept code, dept legacy URL, dept preview authors
  - Source selectors from Groundtruth §2.4

- [ ] 2.1.4 Add subsection "#### 4.5.3 Universal Record Container" table:
  - 8 selectors: record container, record title, external link indicator, metadata container, quartile badge, journal/publisher, year badge, citation badge
  - Source selectors from Groundtruth §2.1 and §2.2

- [ ] 2.1.5 Add subsection "#### 4.5.4 View-Specific Metadata" table:
  - 10 rows covering: scopus (author_order, scopus_eid), researches/services (leader, personil, fund_rp, status, source), iprs (inventor, nomor_permohonan, ipr_type)
  - Format: View | Selector Pattern | Field Extracted | Example Value
  - Source examples from Groundtruth §3

- [ ] 2.1.6 Add subsection "#### 4.5.5 Pagination & Navigation" table:
  - 5 selectors: pagination info, page link, disabled nav, tab navigation, hidden WOS tab
  - Include WOS hidden tab selector: `ul.article-tab li.d-none a[href*="view=wos"]`

- [ ] 2.1.7 Add subsection "#### 4.5.6 Author Profile" table:
  - 8 selectors: author name, verified badge, SINTA ID regex, affiliation link, study program link, subject tags, score cards, stats table
  - Source selectors from Groundtruth §2.5

- [ ] 2.1.8 Add cross-reference note at section start:
  - "Semua selector dalam katalog ini telah divalidasi terhadap 4 file HTML groundtruth (lihat [Groundtruth Analysis §2](file:///d:/laragon/www/sintascraper/docs/05-Groundtruth-Analysis.md#2-selector-presisi-siap-pakai))"

**Definition of Done:**
- ✅ Selector catalog contains all 6 subsections
- ✅ Total 42+ selectors documented with purpose and expected values
- ✅ All selectors validated against Groundtruth HTML fixtures
- ✅ WOS hidden tab selector included
- ✅ Code examples use proper CSS selector syntax
- ✅ Groundtruth §2 cross-referenced

---

#### Task 2.2: Update parseArListItem Function Specification

**Validates:** REQ-2 (Dedup Key), REQ-6 (Field Completeness), REQ-15 (Personil)  
**File:** `docs/03-Design.md`  
**Location:** §4.1 Universal Record Parser (line ~189)  
**Time Estimate:** 45 minutes

**Detailed Changes:**

- [ ] 2.2.1 Update function signature comment to reference canonical views:
  - Add: "@param {string} context.view - One of 13 canonical views: scopus, wos, garuda, googlescholar, researches, services, iprs, books, rama, pak, kepakaran, matrics, arts"

- [ ] 2.2.2 Add personil extraction logic in function body (after line ~240):
```javascript
  // Link Personil Dosen pada Riset dan Pengabdian
  if (href.includes('/authors/profile/')) {
    const authorMatch = href.match(/\/authors\/profile\/(\d+)/);
    if (authorMatch) {
      personilIds.push(parseInt(authorMatch[1]));
      personilNames.push(txt);
    }
  }
```

- [ ] 2.2.3 Update dedup key generation section (line ~265):
  - Ensure complete algorithm from REQ-VIEW-05
  - Add MD5 import at top: `import crypto from 'crypto';`
  - Add normalization logic for title before hashing

- [ ] 2.2.4 Add field extraction for missing fields:
  - `author_order` from "Author Order : " prefix
  - `nomor_permohonan` from "Nomor Permohonan : " in .ar-cited
  - `ipr_type` from .ar-quartile (when not actual quartile)

- [ ] 2.2.5 Update return statement to include all fields from §2 schemas

- [ ] 2.2.6 Add comment referencing Groundtruth:
  - "// Parser ini mengikuti pola dari Groundtruth Analysis §2.2"

**Definition of Done:**
- ✅ Function extracts all fields from Requirements §2 schemas
- ✅ Personil extraction logic implemented
- ✅ Dedup key generation complete with all 3 branches
- ✅ All view-specific fields handled
- ✅ Code compiles and matches Requirements spec
- ✅ Groundtruth §2.2 referenced in comments

---

#### Task 2.3: Update Pagination Sequence Diagram

**Validates:** REQ-3 (Pagination Mechanism)  
**File:** `docs/03-Design.md`  
**Location:** §3.2 Alur Scraping Berbasis Pagination (line ~143)  
**Time Estimate:** 30 minutes

**Detailed Changes:**

- [ ] 2.3.1 Update sequence diagram title:
  - Change: "Alur Scraping Berbasis Pagination (`?page=N&view=V`)" (add query param detail)

- [ ] 2.3.2 Replace diagram steps to remove "View more" button:
  - Remove: Any mention of "klik View more"
  - Add: "Loop page = 1 s.d Y" with numbered iteration

- [ ] 2.3.3 Add pagination parsing step:
```
     ├─ parsePaginationInfo() ──┤
     │  "Page 1 of Y | Records Z"
```

- [ ] 2.3.4 Add validation assertion step:
```
     ├─ Assert: parsed_count > 0 if Total Records > 0
     │  Jika gagal → log SELECTOR_MISMATCH + screenshot
```

- [ ] 2.3.5 Update comments to reference Groundtruth §1.1

**Definition of Done:**
- ✅ Sequence diagram shows numbered pagination loop
- ✅ No references to "View more" button
- ✅ Validation assertion documented
- ✅ Diagram matches Requirements REQ-VIEW-01 spec

---

#### Task 2.4: Update SQLite Schema with Missing Fields

**Validates:** REQ-13 (Data Schema Completeness)  
**File:** `docs/03-Design.md`  
**Location:** §5 Skema Database SQLite (line ~403)  
**Time Estimate:** 35 minutes

**Detailed Changes:**

- [ ] 2.4.1 Update `items` table schema (line ~478):
  - Add column: `scopus_eid TEXT` (after detail_url)
  - Add column: `author_order TEXT` (after creator)
  - Add column: `nomor_permohonan TEXT` (after status)
  - Add column: `fund_rp TEXT` (after cited)

- [ ] 2.4.2 Verify field order matches Data Contract §2 in Requirements

- [ ] 2.4.3 Add index for new fields:
```sql
CREATE INDEX IF NOT EXISTS idx_items_scopus_eid ON items(scopus_eid);
CREATE INDEX IF NOT EXISTS idx_items_nomor_permohonan ON items(nomor_permohonan);
```

- [ ] 2.4.4 Update table comment:
  - "Tabel Items menyimpan seluruh publikasi, riset, pengabdian, dan HKI dengan skema universal yang mencakup field dari 13 view SINTA"

- [ ] 2.4.5 Add cross-reference to Requirements:
  - "Skema ini mengimplementasikan Data Contract yang terdefinisi di [Requirements §2](file:///d:/laragon/www/sintascraper/docs/02-Requirements.md#2-data-contract-skema-json--sqlite)"

**Definition of Done:**
- ✅ All 4 missing columns added to items table
- ✅ Indexes created for performance-critical fields
- ✅ Column order matches Requirements Data Contract
- ✅ Cross-reference to Requirements added
- ✅ SQL syntax valid

---

#### Task 2.5: Add Golden Fixture Test Specifications

**Validates:** REQ-5 (Missing Fixture Documentation)  
**File:** `docs/03-Design.md`  
**Location:** §8 Strategi Pengujian Golden Fixture (line ~495)  
**Time Estimate:** 35 minutes

**Detailed Changes:**

- [ ] 2.5.1 Update fixture table to include all existing fixtures with complete details:
  - Add "Expected Record Count" column
  - Add "Key Fields to Validate" column
  - Add "Validation Status" column (✅ Complete / ⚠️ Partial / ❌ Missing)

- [ ] 2.5.2 Add missing fixture tracking section:
```markdown
### 8.1 Missing Fixtures (TODO)

Fixture berikut perlu ditangkap saat scraping pertama:

| View | Priority | Capture During | Sample Size |
|---|---|---|---|
| services | P0 | First dept/author services scrape | ≥5 records |
| books | P1 | First books view scrape | ≥3 records |
| garuda | P1 | First garuda scrape | ≥5 records |
| googlescholar | P1 | First scholar scrape | ≥5 records |
| wos | P0 | First WOS scrape (detect hidden tab) | ≥3 records |
| rama, pak, kepakaran, matrics, arts | P2 | If present during scrape | ≥1 record each |
```

- [ ] 2.5.3 Add fixture capture procedure:
  - "Saat view pertama kali ter-scrape, simpan HTML snapshot ke `tests/fixtures/{view}/sample_01.html`"
  - "Jalankan parser terhadap fixture baru, dokumentasikan expected output"
  - "Tambahkan fixture ke test suite"

- [ ] 2.5.4 Cross-reference Groundtruth §5

**Definition of Done:**
- ✅ Fixture table includes validation status for existing 4 files
- ✅ Missing fixture list complete with priorities
- ✅ Capture procedure documented
- ✅ Groundtruth §5 cross-referenced

---

**EPIC 2 CHECKPOINT:**
- [ ] Run `git add docs/03-Design.md`
- [ ] Run `git commit -m "docs: P0 design updates - selector catalog, parser enhancements, pagination, schema, fixtures"`
- [ ] Verify section numbering still consistent
- [ ] Verify all code examples have proper syntax highlighting

**EPIC 2 Definition of Done:**
- ✅ Complete selector catalog with 42+ selectors across 6 categories
- ✅ parseArListItem function updated with all missing fields
- ✅ Pagination sequence diagram shows numbered pages
- ✅ SQLite schema includes all 4 missing columns
- ✅ Golden fixture strategy documents missing fixtures
- ✅ All cross-references to Requirements and Groundtruth added
- ✅ Git commit created with clear message

---

### EPIC 3: Groundtruth.md Enhancements (P0)

**Objective:** Improve discoverability, add quick reference tables  
**Duration:** 1 hour  
**Validates:** Supporting documentation for all P0 requirements

---

#### Task 3.1: Add Table of Contents

**Validates:** Usability improvement  
**File:** `docs/05-Groundtruth-Analysis.md`  
**Location:** After document header (line ~5)  
**Time Estimate:** 15 minutes

**Detailed Changes:**

- [ ] 3.1.1 Insert "## Table of Contents" section after document header
- [ ] 3.1.2 Add hierarchical list with links:
  - 1. Temuan Kunci (#1-temuan-kunci-yang-mengoreksi-desain-awal)
  - 2. Selector Presisi (#2-selector-presisi-siap-pakai)
    - 2.1-2.6 subsections
  - 3. Skema Kolom per View (#3-skema-kolom-per-view-untuk-xlsxcsvhtml)
  - 4. Perubahan ke Requirements & Design (#4-perubahan-yang-harus-masuk-ke-requirements--design)
  - 5. Batas & TODO Fixture (#5-batas--todo-fixture)
  - 6. Quick Reference (new section)

**Definition of Done:**
- ✅ TOC includes all 6 main sections
- ✅ All anchor links work correctly
- ✅ Formatting consistent with markdown best practices

---

#### Task 3.2: Add Quick Reference Tables

**Validates:** Usability improvement  
**File:** `docs/05-Groundtruth-Analysis.md`  
**Location:** New §6 after §5 Batas & TODO Fixture  
**Time Estimate:** 45 minutes

**Detailed Changes:**

- [ ] 3.2.1 Add "## 6. Quick Reference" section

- [ ] 3.2.2 Add "### 6.1 Fixture Coverage Matrix" table:
  - 4 existing fixtures with validation status ✅
  - 9 missing fixtures with status ⚠️ TODO
  - Columns: Fixture File | Page Type | Views Covered | Records | Validation Status

- [ ] 3.2.3 Add "### 6.2 Dedup Key Strategy Reference" table:
  - 4 rows: Scopus with EID, IPR with Nomor, Research/Service, Generic fallback
  - Columns: Scenario | Dedup Key Format | Example
  - Examples from actual fixture data

- [ ] 3.2.4 Add "### 6.3 URL Format Reference" table:
  - 5 rows: Dept canonical, Dept legacy, Dept with view+page, Author profile, Author with view
  - Columns: Target | URL Pattern | Example
  - Use actual UWG department UUIDs

- [ ] 3.2.5 Add "### 6.4 View Detection Reference" table:
  - Department views (from nav.profile-nav)
  - Author views (from ul.article-tab)
  - Hidden views (d-none class)

**Definition of Done:**
- ✅ All 4 quick reference tables added
- ✅ Examples use real data from fixtures
- ✅ All URL patterns match actual SINTA behavior
- ✅ Dedup key examples match Implementation in Design §4.1

---

**EPIC 3 CHECKPOINT:**
- [ ] Run `git add docs/05-Groundtruth-Analysis.md`
- [ ] Run `git commit -m "docs: Groundtruth enhancements - TOC and quick reference tables"`
- [ ] Verify all anchor links in TOC work
- [ ] Verify quick reference tables render correctly

**EPIC 3 Definition of Done:**
- ✅ Table of Contents added with working links
- ✅ 4 quick reference tables added
- ✅ Fixture coverage matrix complete
- ✅ Dedup key strategy examples clear
- ✅ URL format reference comprehensive
- ✅ Git commit created

---

## PHASE 2: High Priority P1 Requirements (Cross-Cutting)

### EPIC 4: Traceability and Cross-References (P1)

**Objective:** Add bidirectional links between all documents  
**Duration:** 2 hours  
**Validates:** REQ-8 (Traceability Linkage), REQ-12 (Testability), REQ-23 (Consistency)

---

#### Task 4.1: Add Traceability Matrix to Requirements

**Validates:** REQ-8 (Traceability Linkage)  
**File:** `docs/02-Requirements.md`  
**Location:** After §5 Acceptance Checklist (end of document)  
**Time Estimate:** 45 minutes

**Detailed Changes:**

- [ ] 4.1.1 Add new section "## 6. Traceability Matrix" after Acceptance Checklist

- [ ] 4.1.2 Create comprehensive traceability table:
  - Columns: REQ ID | PRD Features | Design Sections | Tasks | Priority | Issue Count
  - Map all 23 requirements to source documents
  - Example rows:
    - REQ-VIEW-01 → PRD F6-F12, Design §3.2 + §4.4, Tasks T3.2
    - REQ-AUTH-03 → PRD F0, Design §3.1, Tasks T1.2

- [ ] 4.1.3 Add hyperlinks to all referenced sections:
  - PRD: `[F6-F12](file:///d:/laragon/www/sintascraper/docs/01-PRD.md#5-fitur-urut-sesuai-workflow)`
  - Design: `[§3.2](file:///d:/laragon/www/sintascraper/docs/03-Design.md#32-alur-scraping-berbasis-pagination-pagen--viewv)`
  - Tasks: `[T3.2](file:///d:/laragon/www/sintascraper/docs/04-Tasks.md#t32--navigator-pagination-loop-srcnavigatorjs--10d)`

- [ ] 4.1.4 Add summary statistics:
  - Total requirements: 23
  - P0: 9, P1: 9, P2: 5
  - Requirements with complete traceability: X/23
  - Orphaned requirements: Y

**Definition of Done:**
- ✅ All 23 requirements mapped in traceability matrix
- ✅ All hyperlinks tested and working
- ✅ No orphaned requirements (all link to Design)
- ✅ Summary statistics accurate

---

#### Task 4.2: Add "Validates" Fields to Design Sections

**Validates:** REQ-8 (Traceability Linkage)  
**File:** `docs/03-Design.md`  
**Locations:** All major sections (§1-§8)  
**Time Estimate:** 45 minutes

**Detailed Changes:**

- [ ] 4.2.1 Add "**Validates:**" field at start of each major design section:
  - §1 Keputusan Arsitektur → REQ-DEPT-03 (config-driven)
  - §2 Struktur Direktori → REQ-NFR-03 (logging), REQ-NFR-02 (checkpoint)
  - §3.1 Alur Autentikasi → REQ-AUTH-01, REQ-AUTH-02, REQ-AUTH-03, REQ-AUTH-04
  - §3.2 Alur Scraping → REQ-VIEW-01, REQ-VIEW-02, REQ-VIEW-03
  - §4.1 parseArListItem → REQ-VIEW-02, REQ-VIEW-05, REQ-VIEW-06
  - §4.2 parseDepartmentRow → REQ-DEPT-01
  - §4.3 parseAuthorProfile → REQ-AUTH-DETAIL-01
  - §4.4 parsePaginationInfo → REQ-VIEW-01
  - §5 SQLite Schema → REQ-NFR-06 (idempotency), REQ-EXP-03
  - §6 Strategi Ekspor → REQ-EXP-01, REQ-EXP-02, REQ-EXP-03, REQ-EXP-04
  - §7 State Management → REQ-NFR-02 (checkpoint)
  - §8 Golden Fixtures → REQ-NFR-07 (validation)

- [ ] 4.2.2 Format consistently:
```markdown
## N. Section Title

**Validates:** [REQ-ID-1](link), [REQ-ID-2](link)

Section content...
```

**Definition of Done:**
- ✅ All 8+ major Design sections have "Validates" fields
- ✅ All REQ IDs hyperlinked to Requirements.md
- ✅ Bidirectional traceability established (Requirements → Design → Requirements)

---

#### Task 4.3: Add "Validates" Fields to Tasks

**Validates:** REQ-8 (Traceability Linkage), REQ-12 (Testability)  
**File:** `docs/04-Tasks.md`  
**Locations:** All T#.# tasks  
**Time Estimate:** 30 minutes

**Detailed Changes:**

- [ ] 4.3.1 Add "**Validates:**" field to each task header:
  - T0.1 → REQ-NFR-05 (portability)
  - T1.1 → REQ-AUTH-01, REQ-AUTH-02, REQ-AUTH-05
  - T1.2 → REQ-AUTH-03
  - T1.3 → REQ-AUTH-04
  - T2.1 → REQ-AFF-01, REQ-AFF-02, REQ-AFF-03
  - T2.2 → REQ-DEPT-01
  - T2.3 → REQ-DEPT-02
  - T3.1 → REQ-VIEW-02, REQ-VIEW-05, REQ-VIEW-06
  - T3.2 → REQ-VIEW-01, REQ-VIEW-03, REQ-VIEW-04
  - T3.3a-g → Individual view requirements
  - T4.1 → REQ-AUTH-LIST-01
  - T4.2 → REQ-AUTH-DETAIL-01
  - T4.3 → REQ-AUTH-DETAIL-02
  - T5.1 → REQ-NFR-06
  - T5.2 → REQ-EXP-03
  - T5.3 → REQ-EXP-02, REQ-EXP-04
  - T5.4 → REQ-UI-01, REQ-UI-02, REQ-UI-03
  - T6.1 → REQ-NFR-01, REQ-NFR-02, REQ-NFR-03
  - T6.2 → Documentation (no direct REQ)
  - T6.3 → All acceptance criteria

- [ ] 4.3.2 Format consistently with hyperlinks:
```markdown
### T1.1 — Auto-Fill & Login Form (`src/auth.js :: login()`) ⏱ 0.5d
**Validates:** [REQ-AUTH-01](link), [REQ-AUTH-02](link), [REQ-AUTH-05](link)
```

**Definition of Done:**
- ✅ All 30+ tasks have "Validates" fields
- ✅ All REQ IDs hyperlinked to Requirements.md
- ✅ Complete traceability chain: REQ → Design → Task

---

### EPIC 5: Validation Scripts (P1)

**Objective:** Create automated scripts to verify documentation consistency  
**Duration:** 1.5 hours  
**Validates:** REQ-8 (Traceability), REQ-23 (Consistency)

---

#### Task 5.1: Create validate-consistency.js Script

**Validates:** REQ-23 (Documentation Consistency Review)  
**File:** New file `scripts/validate-consistency.js`  
**Time Estimate:** 45 minutes

**Detailed Changes:**

- [ ] 5.1.1 Create `scripts/` directory if not exists

- [ ] 5.1.2 Create script with 4 validation checks:
  1. **View list consistency**: Extract view lists from Requirements, Design, Tasks; compare order
  2. **Selector catalog completeness**: Extract selectors from Requirements examples; verify presence in Design §4.5
  3. **Terminology standardization**: Scan all docs for alias terms from terminology map; flag inconsistencies
  4. **REQ-* ID uniqueness**: Extract all REQ-* IDs; check for duplicates

- [ ] 5.1.3 Implement each check function:
```javascript
function checkViewListConsistency() {
  const requirementsViews = extractViewList('docs/02-Requirements.md');
  const designViews = extractViewList('docs/03-Design.md');
  const tasksViews = extractViewList('docs/04-Tasks.md');
  
  const canonical = ['scopus', 'wos', 'garuda', 'googlescholar', 'researches', 'services', 'iprs', 'books', 'rama', 'pak', 'kepakaran', 'matrics', 'arts'];
  
  const issues = [];
  if (!arraysEqual(requirementsViews, canonical)) {
    issues.push('Requirements.md view list does not match canonical order');
  }
  // ... more checks
  
  return { passed: issues.length === 0, issues };
}
```

- [ ] 5.1.4 Add CLI output with pass/fail summary:
```
✅ View list consistency: PASS
✅ Selector catalog completeness: PASS
❌ Terminology standardization: FAIL (3 issues found)
   - docs/02-Requirements.md:127: Use "personil" instead of "anggota"
   - docs/03-Design.md:234: Use "dedup_key" instead of "unique key"
   - docs/04-Tasks.md:89: Use "canonical URL" instead of "primary URL"
✅ REQ-* ID uniqueness: PASS

Summary: 3/4 checks passed
```

- [ ] 5.1.5 Add to package.json scripts:
```json
"scripts": {
  "validate:consistency": "node scripts/validate-consistency.js"
}
```

**Definition of Done:**
- ✅ Script runs without errors
- ✅ All 4 validation checks implemented
- ✅ Clear pass/fail output with specific line numbers
- ✅ npm script alias created
- ✅ Script catches known inconsistencies

---

#### Task 5.2: Create validate-coverage.js Script

**Validates:** REQ-8 (Traceability Linkage)  
**File:** New file `scripts/validate-coverage.js`  
**Time Estimate:** 45 minutes

**Detailed Changes:**

- [ ] 5.2.1 Create script with 4 coverage checks:
  1. **REQ to Design mapping**: Extract all REQ-* IDs from Requirements; search for mentions in Design.md; report orphaned
  2. **Design to Task mapping**: Extract all §N.M sections from Design; search for "Validates" mentions in Tasks; report unimplemented
  3. **Error code implementation**: Extract error codes from Requirements §4; verify presence in src/errors.js (if exists)
  4. **Selector presence in groundtruth**: Extract selectors from Design §4.5; parse groundtruth HTML fixtures; report selectors not found

- [ ] 5.2.2 Implement REQ-to-Design mapping check:
```javascript
function checkReqToDesignMapping() {
  const reqIds = extractRequirementIds('docs/02-Requirements.md'); // e.g., ['REQ-AUTH-01', 'REQ-VIEW-02']
  const designContent = fs.readFileSync('docs/03-Design.md', 'utf8');
  
  const orphaned = [];
  for (const reqId of reqIds) {
    if (!designContent.includes(reqId)) {
      orphaned.push(reqId);
    }
  }
  
  return {
    passed: orphaned.length === 0,
    issues: orphaned.map(id => `${id} not mentioned in Design.md`)
  };
}
```

- [ ] 5.2.3 Add CLI output with coverage percentages:
```
✅ REQ to Design mapping: PASS (23/23 requirements covered)
❌ Design to Task mapping: FAIL (2 sections not implemented)
   - Design §4.7 Dynamic View Discovery: No task found
   - Design §9 Performance Monitoring: No task found
⚠️  Error code implementation: SKIPPED (src/errors.js not found - pre-implementation)
✅ Selector presence in groundtruth: PASS (42/42 selectors validated)

Summary: Requirements coverage 100%, Implementation coverage 92%
```

- [ ] 5.2.4 Add to package.json scripts:
```json
"scripts": {
  "validate:coverage": "node scripts/validate-coverage.js"
}
```

**Definition of Done:**
- ✅ Script runs without errors
- ✅ All 4 coverage checks implemented
- ✅ Coverage percentages calculated correctly
- ✅ Orphaned requirements reported with specifics
- ✅ npm script alias created

---

**EPIC 4-5 CHECKPOINT:**
- [ ] Run `git add docs/02-Requirements.md docs/03-Design.md docs/04-Tasks.md scripts/`
- [ ] Run `git commit -m "docs: P1 traceability and validation - bidirectional links, validation scripts"`
- [ ] Run `npm run validate:consistency` and verify passes
- [ ] Run `npm run validate:coverage` and verify high coverage %
- [ ] Fix any issues found by validation scripts

**EPIC 4-5 Definition of Done:**
- ✅ Traceability matrix added to Requirements.md
- ✅ All Design sections have "Validates" fields
- ✅ All Tasks have "Validates" fields
- ✅ Bidirectional traceability established
- ✅ validate-consistency.js script created and passes
- ✅ validate-coverage.js script created and passes
- ✅ Git commit created

---

## PHASE 3: Medium Priority P2 Requirements (Optional)

### EPIC 6: Enhanced Documentation Features (P2)

**Objective:** Add optional enhancements for improved usability  
**Duration:** 1.5 hours (if time permits)  
**Validates:** REQ-16, REQ-17, REQ-18, REQ-19, REQ-21, REQ-22

---

#### Task 6.1: Add Integration Testing Section to Design

**Validates:** REQ-P1-2 (from design.md §2.2.2)  
**File:** `docs/03-Design.md`  
**Location:** New §9 after §8 Golden Fixtures  
**Time Estimate:** 30 minutes

**Detailed Changes:**

- [ ] 6.1.1 Add "## 9. Integration & End-to-End Testing" section

- [ ] 6.1.2 Add test pyramid diagram:
```
              /\
             /  \
            /E2E \          2 smoke tests
           /------\
          /  Integ \        8 integration tests
         /----------\
        / Unit Tests \      20 unit tests
       /--------------\
```

- [ ] 6.1.3 Add "### 9.2 Integration Test Scenarios" table:
  - 8 test scenarios: IT-01 (auth auto), IT-02 (auth manual), IT-03 (session recovery), IT-04 (pagination), IT-05 (author sub-views), IT-06 (dedup), IT-07 (checkpoint), IT-08 (export)
  - Columns: Test ID | Scenario | Validates | Assertions

- [ ] 6.1.4 Add "### 9.3 End-to-End Test Scenarios" table:
  - E2E-01: Fresh 3-dept scrape (~45 min)
  - E2E-02: Incremental update (~15 min)

**Definition of Done:**
- ✅ Integration testing section complete
- ✅ 8 integration tests documented
- ✅ 2 E2E tests documented
- ✅ Each test has clear success criteria

---

#### Task 6.2: Add Performance Metrics Section to Design

**Validates:** REQ-22 (Performance Metrics Documentation)  
**File:** `docs/03-Design.md`  
**Location:** New §10 after Integration Testing  
**Time Estimate:** 30 minutes

**Detailed Changes:**

- [ ] 6.2.1 Add "## 10. Performance Metrics & Optimization" section

- [ ] 6.2.2 Add "### 10.1 Baseline Performance" table:
  - Metrics: Total scrape duration, Avg page load time, Avg parse time per record, DB insert rate, Memory peak, XLSX export time
  - Columns: Metric | Target | Measured | Status
  - Targets from PRD §3 Success Metrics

- [ ] 6.2.3 Add "### 10.2 Rate Limiting Configuration" code block:
```javascript
export const RATE_LIMITS = {
  NAV_DELAY_BASE_MS: 2500,
  NAV_DELAY_JITTER_MS: 1000,
  RETRY_BACKOFF_MS: [2000, 4000, 8000],
  MAX_RETRIES: 3,
  PAGE_TIMEOUT_MS: 30000,
  SELECTOR_TIMEOUT_MS: 10000
};
```

- [ ] 6.2.4 Add "### 10.3 Optimization Strategies":
  - 5 strategies: Batch DB inserts, Lazy screenshot, Minimal DOM queries, Incremental exports, State checkpoint frequency

- [ ] 6.2.5 Add "### 10.4 Monitoring & Alerts" with structured metrics example

**Definition of Done:**
- ✅ Performance metrics section complete
- ✅ All 6 baseline metrics documented with targets
- ✅ Rate limiting config matches Requirements
- ✅ 5 optimization strategies documented

---

#### Task 6.3: Add Edge Case Requirements

**Validates:** REQ-P1-1 (from requirements.md enhancement)  
**File:** `docs/02-Requirements.md`  
**Location:** New §1.4.1 after REQ-VIEW-06  
**Time Estimate:** 20 minutes

**Detailed Changes:**

- [ ] 6.3.1 Add "### 1.4.1 Edge Case Handling" subsection

- [ ] 6.3.2 Add 5 edge case requirements table:
  - REQ-VIEW-07: Personil Kosong (P1)
  - REQ-VIEW-08: Dummy URLs (P1)
  - REQ-VIEW-09: Missing Optional Fields (P1)
  - REQ-VIEW-10: Whitespace Normalization (P1)
  - REQ-VIEW-11: Malformed Metadata (P2)

- [ ] 6.3.3 Format each with WHEN-THEN structure

**Definition of Done:**
- ✅ 5 edge case requirements added
- ✅ Each has clear WHEN-THEN condition
- ✅ Priorities assigned (4 P1, 1 P2)

---

#### Task 6.4: Add Configuration Documentation to PRD

**Validates:** REQ-21 (Configuration Documentation Enhancement)  
**File:** `docs/01-PRD.md`  
**Location:** New §9 after §8 Risks & Mitigations  
**Time Estimate:** 20 minutes

**Detailed Changes:**

- [ ] 6.4.1 Add "## 9. Configuration Guide" section

- [ ] 6.4.2 Add "### 9.1 Environment Variables (.env)" subsection:
  - Document all variables from §7 Assumptions with data types
  - Mark required vs optional
  - Add validation rules

- [ ] 6.4.3 Add "### 9.2 Adding New Departments" subsection:
  - Step-by-step guide to add department to departments.json
  - Example entry with all required fields
  - How to find UUID and legacy code from SINTA

**Definition of Done:**
- ✅ Configuration guide section added to PRD
- ✅ All .env variables documented
- ✅ Adding departments guide clear and complete

---

**EPIC 6 CHECKPOINT:**
- [ ] Run `git add docs/02-Requirements.md docs/03-Design.md docs/01-PRD.md`
- [ ] Run `git commit -m "docs: P2 enhancements - integration tests, performance metrics, edge cases, config guide"`
- [ ] Run validation scripts to ensure no regressions
- [ ] Update PRD status to "Ready for Implementation"

**EPIC 6 Definition of Done:**
- ✅ Integration testing section added with 10 test cases
- ✅ Performance metrics section added with 6 baseline metrics
- ✅ Edge case requirements added (5 new REQ-VIEW-07 through REQ-VIEW-11)
- ✅ Configuration guide added to PRD
- ✅ All P2 requirements addressed
- ✅ Git commit created

---

## Final Validation & Acceptance

### Task 7.1: Run Complete Validation Suite

**Time Estimate:** 20 minutes

**Detailed Steps:**

- [ ] 7.1.1 Run all validation scripts:
```bash
npm run validate:consistency
npm run validate:coverage
```

- [ ] 7.1.2 Manually verify:
  - [ ] All internal links work (click through key cross-references)
  - [ ] All code examples have proper syntax highlighting
  - [ ] All tables render correctly
  - [ ] Section numbering consistent
  - [ ] No broken anchors

- [ ] 7.1.3 Generate validation report:
  - Total requirements: 23
  - P0 completed: 9/9
  - P1 completed: 9/9
  - P2 completed: 5/5
  - Traceability coverage: X%
  - Consistency issues: 0

**Definition of Done:**
- ✅ All validation scripts pass
- ✅ Manual verification checklist complete
- ✅ Validation report generated
- ✅ No critical issues remaining

---

### Task 7.2: Final Documentation Review

**Time Estimate:** 20 minutes

**Detailed Steps:**

- [ ] 7.2.1 Review each document for:
  - [ ] Completeness (all sections present)
  - [ ] Consistency (terminology standardized)
  - [ ] Correctness (no technical errors)
  - [ ] Clarity (explanations understandable)

- [ ] 7.2.2 Verify acceptance criteria from requirements spec:
  - [ ] All P0 requirements (9) implemented and validated
  - [ ] All P1 requirements (9) implemented and validated
  - [ ] P2 requirements (5) implemented or documented as future work
  - [ ] All 4 documentation files updated
  - [ ] Bidirectional traceability established
  - [ ] 2 validation scripts created and passing
  - [ ] Zero critical inconsistencies

- [ ] 7.2.3 Generate completion metrics:
  - Documentation completeness: increased from 85% to 95%+
  - Total lines added/modified: ~X lines
  - Total selectors documented: 42+
  - Total requirements traced: 23/23 (100%)

**Definition of Done:**
- ✅ All 4 documentation files reviewed
- ✅ All acceptance criteria met
- ✅ Completion metrics documented
- ✅ Ready for implementation phase

---

### Task 7.3: Create Final Commit and Tag

**Time Estimate:** 10 minutes

**Detailed Steps:**

- [ ] 7.3.1 Stage all changes:
```bash
git add docs/01-PRD.md docs/02-Requirements.md docs/03-Design.md docs/04-Tasks.md docs/05-Groundtruth-Analysis.md scripts/
```

- [ ] 7.3.2 Create comprehensive commit message:
```
docs: Complete documentation improvement for SINTAScraper

Addresses 23 identified issues (9 P0, 9 P1, 5 P2) across all documentation:

P0 (Critical):
- Added error taxonomy with 7 error codes and recovery strategies
- Standardized view list to canonical 13 views (including WOS)
- Specified complete dedup key algorithm with 3 decision branches
- Updated pagination mechanism to numbered pages (primary) with fallback
- Added WOS hidden view handling requirement
- Enhanced field extraction specs for all view types
- Improved session verification with selector checks
- Documented personil extraction for researches/services
- Updated SQLite schema with 4 missing columns

P1 (High):
- Created complete selector catalog (42+ selectors across 6 categories)
- Added traceability matrix linking all REQ → Design → Tasks
- Enhanced all major Design sections with "Validates" annotations
- Added "Validates" fields to all Tasks
- Created 2 validation scripts (consistency + coverage)
- Added Groundtruth TOC and 4 quick reference tables

P2 (Medium):
- Added integration testing section (10 test cases)
- Added performance metrics section (6 baseline metrics)
- Added 5 edge case requirements
- Added configuration guide to PRD

Validation: All scripts pass, 100% traceability coverage

Refs: REQ-1 through REQ-23
```

- [ ] 7.3.3 Create git tag:
```bash
git tag -a docs-improvement-v1.0 -m "Documentation improvement complete - ready for implementation"
git push origin docs-improvement-v1.0
```

**Definition of Done:**
- ✅ All changes committed with descriptive message
- ✅ Git tag created
- ✅ Changes pushed to remote (if applicable)
- ✅ Documentation improvement phase complete

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "3.1"],
      "description": "P0 Requirements updates - independent changes"
    },
    {
      "id": 1,
      "tasks": ["1.6", "1.7", "1.8", "1.9", "3.2"],
      "description": "P0 Requirements finalization - depends on Wave 0 terminology"
    },
    {
      "id": 2,
      "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5"],
      "description": "P0 Design updates - depends on finalized Requirements"
    },
    {
      "id": 3,
      "tasks": ["4.1", "4.2", "4.3"],
      "description": "P1 Traceability - depends on all P0 content complete"
    },
    {
      "id": 4,
      "tasks": ["5.1", "5.2"],
      "description": "P1 Validation scripts - depends on traceability links"
    },
    {
      "id": 5,
      "tasks": ["6.1", "6.2", "6.3", "6.4"],
      "description": "P2 Enhancements - can run in parallel, optional"
    },
    {
      "id": 6,
      "tasks": ["7.1", "7.2", "7.3"],
      "description": "Final validation and commit - must be sequential"
    }
  ]
}
```

---

## Notes

### Time Budget Allocation

- **EPIC 1 (Requirements P0):** 4 hours → 9 tasks × 20-50 min avg
- **EPIC 2 (Design P0):** 3 hours → 5 tasks × 30-75 min avg
- **EPIC 3 (Groundtruth):** 1 hour → 2 tasks × 30 min avg
- **EPIC 4 (Traceability P1):** 2 hours → 3 tasks × 40 min avg
- **EPIC 5 (Validation P1):** 1.5 hours → 2 scripts × 45 min
- **EPIC 6 (Enhancements P2):** 1.5 hours → 4 tasks × 20-30 min avg
- **Final Validation:** 1 hour → 3 tasks × 10-20 min

**Total: 14 hours** (with 2 hours buffer = 12 hour target met)

### Parallelization Opportunities

- Wave 0: Tasks 1.1-1.5 and 3.1 can run in parallel (different files)
- Wave 5: All P2 tasks (6.1-6.4) can run in parallel (optional enhancements)
- Single developer: Follow sequential order as listed
- Team of 2: One on Requirements/Groundtruth, one on Design

### Risk Mitigation

- **Broken Links Risk:** Run validation scripts after each EPIC checkpoint
- **Inconsistency Risk:** Use templates from Design §3 consistently
- **Scope Creep Risk:** Defer P2 tasks if time constrained - focus on P0/P1
- **Merge Conflict Risk:** Commit after each EPIC with clear messages

### Optional Enhancements (Not in Critical Path)

If additional time available after core tasks:
- Add diagrams to PRD for user journeys
- Create visual selector reference in Design
- Add more code examples to parser functions
- Create FAQ section in README
- Add glossary terms to all documents

### Success Criteria Summary

Documentation improvement is **DONE** when:

1. ✅ All P0 requirements (9) implemented and validated
2. ✅ All P1 requirements (9) implemented and validated
3. ✅ P2 requirements (5) completed or documented
4. ✅ Bidirectional traceability: REQ ↔ Design ↔ Tasks
5. ✅ 2 validation scripts created and passing
6. ✅ Zero critical inconsistencies detected
7. ✅ All selector examples match Groundtruth catalog
8. ✅ All internal links tested and valid
9. ✅ Commit message references REQ-* for traceability
10. ✅ Git tag created marking completion

---

## Appendix: Quick Reference

### File Locations

- PRD: `docs/01-PRD.md`
- Requirements: `docs/02-Requirements.md`
- Design: `docs/03-Design.md`
- Tasks (SINTAScraper): `docs/04-Tasks.md`
- Groundtruth: `docs/05-Groundtruth-Analysis.md`
- Validation Scripts: `scripts/validate-*.js`

### Key Section Numbers to Update

- Requirements: Add §4 (Error Taxonomy), §6 (Traceability Matrix)
- Design: Add §4.5 (Selector Catalog), §9 (Integration Tests), §10 (Performance)
- Groundtruth: Add §6 (Quick Reference)
- PRD: Add §9 (Configuration Guide)

### Validation Commands

```bash
npm run validate:consistency  # Check view lists, selectors, terminology
npm run validate:coverage     # Check REQ → Design → Task mapping
```

### Commit Message Template

```
docs: <brief description>

<detailed changes by priority>

P0 (Critical):
- <change 1>
- <change 2>

P1 (High):
- <change 3>

Validation: <script results>

Refs: <REQ-IDs>
```
