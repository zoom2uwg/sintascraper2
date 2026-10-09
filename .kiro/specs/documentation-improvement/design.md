# Design — SINTAScraper Documentation Improvement

**Feature:** documentation-improvement  
**Version:** 1.0  
**Date:** 2024  
**Status:** Draft

## Executive Summary

This design document specifies the implementation approach for improving the SINTAScraper documentation from 85% to 95% completeness. The effort addresses 23 prioritized requirements (9 P0, 9 P1, 5 P2) through surgical, targeted edits that preserve existing valid content while standardizing patterns, adding missing sections, and improving cross-references.

**Key Objectives:**
- Standardize terminology, view lists, and selector patterns across all documents
- Add missing reference sections (selector catalog, error taxonomy, performance metrics)
- Improve cross-document traceability and internal linking
- Create content templates for consistency
- Validate completeness and correctness

**Estimated Effort:** 1.5 days  
**Approach:** File-by-file refactoring with cross-cutting consistency validation

---

## 1. Architecture & Design Decisions

### 1.1 Refactoring Strategy

**Decision: Hybrid Approach (File-by-File + Cross-Cutting Validation)**

We will use a two-phase approach:

**Phase 1: File-by-File Enhancements**
- Process each document independently for P0 requirements
- Add missing sections within each document
- Update terminology and patterns in isolation
- Preserve git history with targeted commits

**Phase 2: Cross-Cutting Integration**
- Validate consistency across all documents
- Link cross-references and update section numbers
- Verify terminology standardization
- Run validation scripts

**Rationale:**
- Minimizes risk of breaking existing valid content
- Allows incremental progress with testable milestones
- Maintains git history for easy rollback
- Enables parallel work on independent documents

### 1.2 Content Preservation Policy

**Principle: Surgical Edits Only**

All changes must:
1. **Preserve** existing valid content (do not rewrite working sections)
2. **Extend** with new required sections (additive changes)
3. **Refine** for consistency (targeted terminology fixes)
4. **Reference** groundtruth findings as source of truth

**Anti-Patterns to Avoid:**
- ❌ Complete rewrites of working sections
- ❌ Changing document structure without necessity
- ❌ Removing content that's accurate but incomplete
- ❌ Adding speculative content not validated by groundtruth

**Approved Patterns:**
- ✅ Adding new sections to existing documents
- ✅ Updating specific selector examples with groundtruth data
- ✅ Inserting cross-reference links
- ✅ Standardizing terminology consistently
- ✅ Expanding abbreviated explanations

### 1.3 Dependency Map

```
Requirements.md (REQ-*)
    ↓ validates ↓
Design.md (§ sections, selector specs)
    ↓ implements ↓
Tasks.md (T#.# work items)
    ↓ references ↓
Groundtruth-Analysis.md (HTML findings)
    ↓ supports all ↓
```

**Critical Dependencies:**
1. **Groundtruth → Requirements**: All selectors must come from validated HTML
2. **Requirements → Design**: Every REQ-* must have design coverage
3. **Design → Tasks**: Every design decision must have implementation task
4. **Cross-Document**: Terminology changes propagate to all documents

---

## 2. File Modification Plan

### 2.1 Requirements.md (02-Requirements.md)

**Priority:** P0 (Foundation)  
**Current State:** 85% complete, missing error taxonomy and edge case handling  
**Target State:** Comprehensive SRS with complete error catalog and validation rules

#### Sections to Add

**2.1.1 Error Taxonomy Section** (REQ-P0-1)

Location: After §3 Non-Functional Requirements, before §4 Environment Config

```markdown
## 4. Error Taxonomy & Handling Strategy

### 4.1 Error Classification

| Error Code | Category | Description | Recovery Strategy | Screenshot |
|---|---|---|---|---|
| `LOGIN_TIMEOUT` | Authentication | Login polling exceeds 120s timeout | Manual retry with --manual-login | Yes |
| `SESSION_EXPIRED` | Authentication | Session lost during scraping | Auto re-login once, then continue | Yes |
| `SELECTOR_NOT_FOUND` | Parsing | Required DOM element missing | Log warning, skip item, continue | Yes |
| `PAGINATION_MISMATCH` | Data Integrity | Parsed items ≠ Total Records | Log error, validate dedup_key | Yes |
| `NETWORK_TIMEOUT` | Network | Request exceeds PAGE_TIMEOUT_MS | Retry 3x with backoff (2s/4s/8s) | Optional |
| `INVALID_DEDUP_KEY` | Data Integrity | Duplicate or malformed key | Log error, skip item | No |
| `EMPTY_VIEW_VERIFIED` | Data State | Total Records = 0 for view | Log info, mark empty_verified:true | No |

### 4.2 Error Handling Principles

1. **Non-Fatal Errors**: Parser failures on individual items must not stop scraping
2. **Idempotent Retry**: All retries must be safe to repeat without side effects
3. **Audit Trail**: Every error logged to JSONL with context (URL, selector, timestamp)
4. **Screenshot Capture**: Automatic for timeout and selector errors
5. **Graceful Degradation**: Missing optional fields → null, not error

### 4.3 Screenshot Naming Convention

`data/logs/err_{error_code}_{timestamp}_{context}.png`

Examples:
- `err_login_timeout_20261009_143022.png`
- `err_selector_not_found_20261009_143530_dept_informatika_scopus.png`
- `err_pagination_mismatch_20261009_144012_author_259792.png`
```

**2.1.2 View List Standardization** (REQ-P0-2)

Action: Update §1.4 REQ-VIEW-06 to use canonical ordering and include WOS

Current:
```markdown
**REQ-VIEW-06** | Dukungan View Lengkap | Mendukung seluruh view SINTA: `scopus`, `garuda`, `googlescholar`, `researches`, `services`, `iprs`, `books`, `rama`, `pak`, `kepakaran`, `matrics`, `arts`. |
```

Updated:
```markdown
**REQ-VIEW-06** | Dukungan View Lengkap | Mendukung seluruh view SINTA dalam urutan kanonis: `scopus`, `wos` (tersembunyi CSS, tetap scrape), `garuda`, `googlescholar`, `researches`, `services`, `iprs`, `books`, `rama`, `pak`, `kepakaran`, `matrics`, `arts`. Sistem harus parse tab navigasi runtime untuk deteksi view baru secara otomatis. |
```

**2.1.3 Edge Case Requirements** (REQ-P1-1)

Location: New subsection §1.4.1 after REQ-VIEW-06

```markdown
### 1.4.1 Edge Case Handling

| ID | Requirement | Prioritas |
|---|---|---|
| **REQ-VIEW-07** | **Personil Kosong**: WHEN research/services record has `Personils : -` THEN system SHALL store empty arrays `[]` for personil_names and personil_ids without error. | P1 |
| **REQ-VIEW-08** | **Dummy URLs**: WHEN title link is internal dummy (`href="#!"`) THEN system SHALL use composite dedup_key (view:MD5(title+year+leader)) instead of URL-based key. | P1 |
| **REQ-VIEW-09** | **Missing Optional Fields**: WHEN optional fields (NIDN, avatar_url, journal_url) are absent THEN system SHALL store `null` without breaking record insert. | P1 |
| **REQ-VIEW-10** | **Whitespace Normalization**: WHEN extracting text from DOM THEN system SHALL normalize all whitespace (tabs, newlines, multiple spaces) to single space. | P1 |
| **REQ-VIEW-11** | **Malformed Metadata**: WHEN metadata format is unexpected (e.g., "Author Order : N/A" instead of "N of M") THEN system SHALL store raw string and log warning. | P2 |
```

#### Selectors to Update

**2.1.4 Selector Precision Updates** (REQ-P0-3)

Replace selector examples throughout with groundtruth-validated selectors:

| Section | Current Selector | Validated Selector | Source |
|---|---|---|---|
| REQ-AUTH-03 | `a.dropdown-item[href$="/logins/logout"]` | ✓ Correct (from Groundtruth §2.6) | Keep |
| REQ-DEPT-01 | `.row.d-item` | ✓ Correct (from Groundtruth §2.4) | Keep |
| REQ-VIEW-02 | Generic "record container" | `.profile-article > .ar-list-item.mb-5` | Update |
| REQ-VIEW-01 | "pagination bar" | `div.pagination-text small` regex `/Page (\d+) of (\d+) \| Total Records (\d+)/` | Update |
| REQ-AUTH-DETAIL-01 | `.content-box h3 a` | ✓ Correct (from Groundtruth §2.5) | Keep |

Action: Insert explicit selector code blocks in requirements where referenced.

### 2.2 Design.md (03-Design.md)

**Priority:** P0 (Core Implementation Spec)  
**Current State:** Good foundation, missing selector catalog and integration patterns  
**Target State:** Complete technical specification with reference tables and validation rules

#### Sections to Add

**2.2.1 Complete Selector Catalog** (REQ-P0-4)

Location: New §4.5 after §4.4 Parser Informasi Pagination

```markdown
### 4.5 Selector Reference Catalog

#### 4.5.1 Authentication & Session

| Element | Selector | Purpose | Expected Value |
|---|---|---|---|
| Login form username | `input[name="username"]` | Auto-fill credential | Text input |
| Login form password | `input[name="password"]` | Auto-fill credential | Text input |
| Logout link | `a.dropdown-item[href$="/logins/logout"]` | Session validation | Visible when logged in |
| User account name | Navbar text node | Session confirmation | e.g., "SYAHRONI" |
| Login redirect check | `window.location.href` | Session loss detection | Contains `/logins` → expired |

#### 4.5.2 Department Structure

| Element | Selector | Purpose | Expected Value |
|---|---|---|---|
| Dept row container | `.row.d-item` | Iterate all departments | Multiple per page |
| Dept level | `.tbl-content-meta span` | Education level | "S1", "S2", "S3" |
| Dept name + canonical URL | `.tbl-content-name > a` | Navigate to dept profile | href = UUID URL |
| Dept code | `.tbl-content-meta-num` | Prodi identifier | "55201", "61209", "59201" |
| Dept legacy URL | `.tbl-content-action a` | Alternate URL format | href = kode-based URL |
| Dept preview authors | `ul.au-list.dept-list li > a` | Preview member list | href = author profile |

#### 4.5.3 Universal Record Container

| Element | Selector | Purpose | Expected Value |
|---|---|---|---|
| Record container | `.profile-article .ar-list-item` | Iterate all records | Multiple per page |
| Record title | `.ar-title a` | Extract title + link | Text + href |
| External link indicator | `.ar-title a[target="_blank"]` | Detect Scopus/external | Boolean attribute |
| Metadata container | `.ar-meta` | Contains all metadata | Multiple children |
| Quartile badge | `.ar-meta a.ar-quartile` | Journal quality | "Q1", "Q2", "Q3", "Q4", "no-Q" |
| Journal/Publisher | `.ar-meta a.ar-pub` | Publication venue | Text + optional href |
| Year badge | `.ar-meta a.ar-year` | Publication year | Regex `/\b(19|20)\d{2}\b/` |
| Citation badge | `.ar-meta a.ar-cited` | Citation count | Regex `/(\d+)\s*cited/i` |

#### 4.5.4 View-Specific Metadata

| View | Selector Pattern | Field Extracted | Example Value |
|---|---|---|---|
| scopus/wos/garuda | `a.ar-meta:contains("Author Order :")` | author_order | "0 of 5" (first of 5 authors) |
| scopus | `href` contains `scopus.com/record` | scopus_eid | "2-s2.0-105029558167" |
| researches/services | `a.ar-meta:contains("Leader :")` | leader | "Syahroni Wahyu Iriananda" |
| researches/services | `a[href*="/authors/profile/"]` | personil_ids | Array of SINTA IDs |
| researches/services | `a.ar-meta:contains("Rp.")` | fund_rp | "Rp. 4.000.000" |
| researches/services | Text contains "Approved" or "Submitted" | status | "Approved" |
| researches/services | Text contains "INTERNAL" or "EXTERNAL" | source | "INTERNAL SOURCE" |
| iprs | `a.ar-meta:contains("Inventor :")` | inventor | "Ahmad Fairuzabadi, Fitri Marisa" |
| iprs | `a.ar-cited:contains("Nomor Permohonan :")` | nomor_permohonan | "EC002024234761" |
| iprs | `a.ar-quartile` text (if not quartile) | ipr_type | "Hak Cipta", "Paten" |

#### 4.5.5 Pagination & Navigation

| Element | Selector | Purpose | Expected Value |
|---|---|---|---|
| Pagination info | `div.pagination-text small` | Parse page state | "Page 1 of 5 \| Total Records 42" |
| Page link | `nav[aria-label="pagination-sample"] a.page-link` | Click to navigate | href = `?page=N&view=V` |
| Disabled nav | `nav li.page-item.disabled` | Detect boundaries | Prev on page 1, Next on last page |
| Tab navigation | `nav.profile-nav a` | Discover available views | href contains `?view=KEY` |
| Hidden WOS tab | `ul.article-tab li.d-none a[href*="view=wos"]` | Detect hidden views | Still scrape despite CSS hide |

#### 4.5.6 Author Profile

| Element | Selector | Purpose | Expected Value |
|---|---|---|---|
| Author name | `.content-box h3 a` | Extract name | Text content |
| Verified badge | `.content-box h3 i.el-ok-sign` | Verification status | Boolean (present/absent) |
| SINTA ID | Body text regex | Extract ID | `/SINTA ID\s*:\s*(\d+)/` → "259792" |
| Affiliation link | `.meta-profile a[href*="/affiliations/profile/"]` | Extract affiliation | Text + href |
| Study program link | `.meta-profile a[href*="/departments/profile/"]` | Extract department | Text + href |
| Subject tags | `ul.subject-list li a` | Extract expertise | Array of text |
| Score cards | `.pr-num` + `.pr-txt` | Extract SINTA scores | Overall, 3Yr, Affil, Affil 3Yr |
| Stats table | `.stat-table tbody tr td` | Extract metrics | Article/Citation/H-index by source |
```

**2.2.2 Integration Testing Strategy** (REQ-P1-2)

Location: New §9 after §8 Strategi Pengujian Golden Fixture

```markdown
## 9. Integration & End-to-End Testing

### 9.1 Test Pyramid

```
              /\
             /  \
            /E2E \          2 smoke tests (full 3-dept run)
           /------\
          /  Integ \        8 integration tests (auth, nav, store)
         /----------\
        / Unit Tests \      20 unit tests (parsers, dedup, format)
       /--------------\
```

### 9.2 Integration Test Scenarios

| Test ID | Scenario | Validates | Assertions |
|---|---|---|---|
| IT-01 | Full auth flow (auto) | Login with .env credentials | Logout selector present, session valid |
| IT-02 | Full auth flow (manual) | Login with --manual-login flag | Wait for user, detect completion |
| IT-03 | Session guard recovery | Simulate session expiration mid-scrape | Auto re-login triggers, scraping resumes |
| IT-04 | Dept pagination loop | Scrape dept with multi-page view | Total parsed = Total Records |
| IT-05 | Author sub-view crawl | Scrape author with multiple views | All views present in DB |
| IT-06 | Dedup enforcement | Run scraper twice on same dept | No duplicate rows, UPSERT works |
| IT-07 | Checkpoint recovery | Kill process mid-scrape, restart | Resume from state.json checkpoint |
| IT-08 | Export pipeline | Generate XLSX/CSV/HTML from DB | Files created, hyperlinks valid |

### 9.3 End-to-End Test Scenarios

| Test ID | Scenario | Duration | Success Criteria |
|---|---|---|---|
| E2E-01 | Fresh 3-dept scrape | ~45 min | All views scraped, exports generated, UI loads |
| E2E-02 | Incremental update | ~15 min | New data added, existing data preserved |

### 9.4 Validation Scripts

#### validate-consistency.js
```javascript
// Cross-document consistency checks
- All REQ-* IDs in Requirements.md referenced in Design.md
- All §N.M section references valid across docs
- All selector examples match groundtruth catalog
- All view lists use canonical order
- All terminology standardized (e.g., "dosen" vs "author")
```

#### validate-coverage.js
```javascript
// Requirements coverage validation
- Each REQ-* has ≥1 Design section mapping
- Each Design section has ≥1 Task mapping
- Each error code has handler implementation
- All views in REQ-VIEW-06 appear in parser code
```

#### validate-selectors.js
```javascript
// Selector syntax validation
- All selectors parse as valid CSS
- No deprecated jQuery-style selectors
- All regex patterns compile
- Groundtruth HTML fixtures contain all referenced selectors
```
```

**2.2.3 Performance Metrics Baseline** (REQ-P1-3)

Location: New §10 after Integration Testing

```markdown
## 10. Performance Metrics & Optimization

### 10.1 Baseline Performance (3-Dept Target)

| Metric | Target | Measured | Status |
|---|---|---|---|
| Total scrape duration | ≤60 min | TBD | Pending first run |
| Avg page load time | ≤5s | TBD | Measure with MCP |
| Avg parse time per record | ≤50ms | TBD | Measure with timestamps |
| DB insert rate | ≥200 records/sec | TBD | SQLite batch insert |
| Memory peak | ≤512MB | TBD | Monitor Node process |
| XLSX export time (5000 rows) | ≤30s | TBD | exceljs benchmark |

### 10.2 Rate Limiting Configuration

```javascript
// src/config.js
export const RATE_LIMITS = {
  NAV_DELAY_BASE_MS: 2500,      // Base delay between navigations
  NAV_DELAY_JITTER_MS: 1000,    // Random jitter ±500ms
  RETRY_BACKOFF_MS: [2000, 4000, 8000], // Exponential backoff
  MAX_RETRIES: 3,
  PAGE_TIMEOUT_MS: 30000,
  SELECTOR_TIMEOUT_MS: 10000
};
```

### 10.3 Optimization Strategies

1. **Batch DB Inserts**: Buffer 100 records before UPSERT transaction
2. **Lazy Screenshot**: Only capture on error, not every page
3. **Minimal DOM Queries**: Extract all fields in single evaluate() call
4. **Incremental Exports**: Generate XLSX sheet-by-sheet, not all-in-memory
5. **State Checkpoint**: Write state.json every 10 pages, not every page

### 10.4 Monitoring & Alerts

```javascript
// Log structured metrics every 5 minutes
{
  "event": "progress_report",
  "timestamp": "2026-10-09T14:35:00Z",
  "pages_scraped": 127,
  "records_inserted": 2453,
  "avg_page_time_ms": 4200,
  "errors_count": 3,
  "current_dept": "informatika",
  "current_view": "researches"
}
```
```

### 2.3 Tasks.md (04-Tasks.md)

**Priority:** P1 (Implementation Guide)  
**Current State:** Well-structured WBS, needs traceability links  
**Target State:** Complete work breakdown with REQ mapping and detailed DoD

#### Updates Needed

**2.3.1 Add REQ Traceability** (REQ-P1-4)

Action: Add "**Validates:**" line to each task showing which requirements it implements

Example transformation:

Before:
```markdown
### T1.1 — Auto-Fill & Login Form (`src/auth.js :: login()`) ⏱ 0.5d
- [ ] Navigasi ke `https://sinta.kemdiktisaintek.go.id/logins`.
- [ ] Jika kredensial `.env` ada: otomatis isi form username & password, lalu submit form.
```

After:
```markdown
### T1.1 — Auto-Fill & Login Form (`src/auth.js :: login()`) ⏱ 0.5d
**Validates:** REQ-AUTH-01, REQ-AUTH-02, REQ-AUTH-05

- [ ] Navigasi ke `https://sinta.kemdiktisaintek.go.id/logins`.
- [ ] Jika kredensial `.env` ada: otomatis isi form username & password, lalu submit form.
```

Apply to all T#.# tasks systematically.

**2.3.2 Expand Definition of Done** (REQ-P1-5)

Action: Make DoD more specific with measurable criteria

Example transformation:

Before:
```markdown
- **DoD:** Form login tersubmit atau terminal siap menunggu aksi operator.
```

After:
```markdown
- **DoD:** 
  - ✅ Auto-fill fills username and password fields correctly
  - ✅ Credentials masked in console output (*** shown)
  - ✅ --manual-login flag disables auto-fill
  - ✅ Terminal displays clear instructions in manual mode
  - ✅ Unit test verifies selector presence in fixture HTML
```

**2.3.3 Add Error Handling Tasks** (REQ-P0-5)

Location: New subsection in EPIC 6

```markdown
### T6.4 — Error Taxonomy Implementation ⏱ 0.5d
**Validates:** REQ-NFR-03, Error Taxonomy §4

- [ ] Define error code enum in `src/errors.js`
- [ ] Implement screenshot capture on LOGIN_TIMEOUT, SELECTOR_NOT_FOUND, PAGINATION_MISMATCH
- [ ] Add structured error logging to JSONL with error_code field
- [ ] Create retry wrapper with exponential backoff for NETWORK_TIMEOUT
- [ ] Implement graceful degradation for SELECTOR_NOT_FOUND (log + skip item)
- **DoD:**
  - ✅ All error codes from taxonomy table implemented
  - ✅ Screenshot naming follows `err_{code}_{timestamp}_{context}.png` convention
  - ✅ Retry logic tested with network failure simulation
  - ✅ Non-fatal errors don't stop scraping
  - ✅ Error logs parseable by monitoring scripts
```

### 2.4 Groundtruth-Analysis.md (05-Groundtruth-Analysis.md)

**Priority:** P2 (Reference Documentation)  
**Current State:** Excellent findings, could improve discoverability  
**Target State:** Add table of contents and quick reference tables

#### Enhancements

**2.4.1 Add Table of Contents** (REQ-P2-1)

Location: After document header, before §1

```markdown
## Table of Contents

1. [Temuan Kunci](#1-temuan-kunci-yang-mengoreksi-desain-awal)
2. [Selector Presisi](#2-selector-presisi-siap-pakai)
   - 2.1 [Record Universal](#21-record-universal)
   - 2.2 [Field per Item](#22-field-per-item-urutan-nekat-strip-icon-i-dulu-via-innertext)
   - 2.3 [Header Dept](#23-header-dept-viewreq)
   - 2.4 [Row Afiliasi→Dept](#24-row-afiliasiept-rowd-item)
   - 2.5 [Header Author](#25-header-author-authorsprofileid)
   - 2.6 [Login Detector](#26-login-detector-untuk-req-auth-03)
3. [Skema Kolom per View](#3-skema-kolom-per-view-untuk-xlsxcsvhtml)
4. [Perubahan ke Requirements & Design](#4-perubahan-yang-harus-masuk-ke-requirements--design)
5. [Batas & TODO Fixture](#5-batas--todo-fixture)
```

**2.4.2 Add Quick Reference Tables** (REQ-P2-2)

Location: New §6 after §5 Batas & TODO

```markdown
## 6. Quick Reference

### 6.1 Fixture Coverage Matrix

| Fixture File | Page Type | Views Covered | Records | Validation Status |
|---|---|---|---|---|
| `SINTA - ...-Affiliation.html` | Dept index | N/A | 3 dept rows | ✅ Complete |
| `SINTA - ...-DepartmentProfile.html` | Dept profile | iprs | 1 IPR record | ✅ Complete |
| `SINTA - ...-AuthorResearch.html` | Author profile | researches | 9 research records | ✅ Complete |
| `SINTA - ...-AuthorsProfile.html` | Author profile | scopus | 1 scopus record | ✅ Complete |
| `services.html` | Dept/Author | services | TBD | ⚠️ TODO |
| `books.html` | Dept/Author | books | TBD | ⚠️ TODO |
| `garuda.html` | Dept/Author | garuda | TBD | ⚠️ TODO |
| `googlescholar.html` | Dept/Author | googlescholar | TBD | ⚠️ TODO |
| `wos.html` | Dept/Author | wos | TBD | ⚠️ TODO |

### 6.2 Dedup Key Strategy Reference

| Scenario | Dedup Key Format | Example |
|---|---|---|
| Scopus with EID | `scopus:{eid}` | `scopus:2-s2.0-105029558167` |
| IPR with Nomor Permohonan | `iprs:{nomor}` | `iprs:EC002024234761` |
| Research/Service | `{view}:MD5(title+year+leader)` | `researches:f6e9b0a1d4c2ab3e` |
| Generic (fallback) | `{view}:MD5(title+year)` | `books:8a3c7f9e2b1d0456` |

### 6.3 URL Format Reference

| Target | URL Pattern | Example |
|---|---|---|---|
| Dept profile (canonical) | `/departments/profile/{affil}/{parent}/{dept_uuid}` | `.../2058/420D8E73.../8A894EDC...` |
| Dept profile (legacy) | `/departments/profile/{affil}/{code}/{prodi_code}` | `.../2058/071030/55201` |
| Dept with view & page | `{dept_url}/?page={N}&view={key}` | `.../8A894EDC.../?page=2&view=scopus` |
| Author profile | `/authors/profile/{sinta_id}` | `/authors/profile/259792` |
| Author with view | `/authors/profile/{sinta_id}/?page={N}&view={key}` | `.../259792/?page=1&view=researches` |
```

---

## 3. Content Templates for Consistency

### 3.1 Requirement Entry Template

Use this format for all new requirements:

```markdown
| ID | Requirement | Prioritas |
|---|---|---|
| **REQ-{CATEGORY}-{NN}** | {WHEN condition} THEN system SHALL {behavior}. {Additional constraints or acceptance criteria.} | P{0|1|2} |
```

**Example:**
```markdown
| **REQ-VIEW-12** | WHEN parsing pagination info THEN system SHALL extract current page, total pages, and total records using regex `/Page (\d+) of (\d+) \| Total Records (\d+)/`. If regex fails, system SHALL default to single-page assumption (page=1, total=1, records=0). | P0 |
```

### 3.2 Selector Documentation Template

Use this format in Design.md selector catalog:

```markdown
| Element | Selector | Purpose | Expected Value |
|---|---|---|---|
| {Element name} | `{CSS selector}` | {Brief purpose} | {Expected content or attribute} |
```

**Example:**
```markdown
| Personil link | `a[href*="/authors/profile/"]` within `.ar-meta` | Extract co-author SINTA IDs | href = `/authors/profile/6738705` |
```

### 3.3 Code Example Template

Use this format for all code examples in Design.md:

```javascript
/**
 * {Brief description of what this code does}
 * 
 * @param {Type} paramName - {Parameter description}
 * @returns {Type} {Return value description}
 * 
 * @example
 * {Example usage}
 */
export function functionName(params) {
  // Implementation with inline comments
  const result = processData(params);
  
  // Handle edge cases
  if (!result) {
    return null; // Graceful degradation
  }
  
  return result;
}
```

### 3.4 Task Definition Template

Use this format for all tasks in Tasks.md:

```markdown
### T{EPIC}.{NUM} — {Task Name} ({File Path if applicable}) ⏱ {duration}
**Validates:** {REQ-ID-1}, {REQ-ID-2}

- [ ] {Subtask 1 with concrete action verb}
- [ ] {Subtask 2}
- **DoD:**
  - ✅ {Specific measurable criterion 1}
  - ✅ {Specific measurable criterion 2}
  - ✅ {Test validation criterion}
```

### 3.5 Error Documentation Template

Use this format in error taxonomy:

```markdown
| Error Code | Category | Description | Recovery Strategy | Screenshot |
|---|---|---|---|---|
| `{ERROR_CODE}` | {Category} | {Clear description of when this occurs} | {Automated recovery steps} | Yes/No |
```

### 3.6 Test Case Template

Use this format for integration tests in Design.md:

```markdown
| Test ID | Scenario | Validates | Assertions |
|---|---|---|---|
| {IT-NN} | {Brief scenario description} | {REQ-ID or Design section} | {Key assertions to check} |
```

---

## 4. Cross-Reference Linking Strategy

### 4.1 Internal Anchor Format

**Standard anchor format:** `#{section-title-kebab-case}`

**Section numbering:**
- Requirements.md: Keep existing §1-5 numbering
- Design.md: Keep existing §1-8 numbering, add §9-10
- Tasks.md: Keep existing EPIC 0-6 structure
- Groundtruth: Keep existing §1-6 numbering

**Link format:**
```markdown
[Link text](file:///absolute/path#anchor)
```

**Example:**
```markdown
See [Selector Catalog §4.5](file:///d:/laragon/www/sintascraper/docs/03-Design.md#45-selector-reference-catalog) for complete list.
```

### 4.2 Cross-Document Reference Map

Create bidirectional links:

| From Document | To Document | Link Type | Example |
|---|---|---|---|
| Requirements → Design | REQ-* to § implementation | Validates relationship | REQ-VIEW-02 → Design §4.1 |
| Design → Requirements | § back to REQ-* | Implements relationship | Design §4.1 → REQ-VIEW-02 |
| Design → Tasks | § to T#.# | Work items | Design §4.5 → T3.1 |
| Tasks → Requirements | T#.# to REQ-* | Validates field | T3.1 validates REQ-VIEW-02 |
| All → Groundtruth | Cite finding source | Reference | "from Groundtruth §2.2" |

### 4.3 Link Insertion Rules

1. **Requirements.md**: Add Design references in new "Implementation" column
2. **Design.md**: Add "Validates" note at start of each section
3. **Tasks.md**: Add "Validates" field to each task header
4. **Avoid circular depth**: Max 1 level of indirection (REQ → Design → Task, not REQ → Design → Task → another Design)

### 4.4 Terminology Cross-Reference

Create terminology consistency map:

| Preferred Term | Aliases to Standardize | Where to Update |
|---|---|---|
| `dedup_key` | deduplication key, unique key | All documents |
| `personil` (ID context) | anggota, co-author | Code comments, variables |
| `dosen` (Indonesian context) | author (except in code) | Indonesian sections |
| `author` (code context) | dosen (except in docs) | Code, DB schema |
| `view` | tab, section type | All documents |
| `pagination numbered` | pagination loop | Requirements, Design |
| `canonical URL` | UUID URL, primary URL | All references to dept URLs |
| `legacy URL` | kode-based URL, alternate URL | All references to dept URLs |
| `Scopus EID` | Scopus ID, EID | All technical docs |

---

## 5. Validation Approach

### 5.1 Automated Validation Scripts

Create three validation scripts in `scripts/` directory:

#### 5.1.1 validate-consistency.js

```javascript
/**
 * Cross-document consistency validation
 * Run: node scripts/validate-consistency.js
 */

const checks = [
  {
    name: 'View list consistency',
    validate: () => {
      // Extract view lists from Requirements, Design, Tasks
      // Compare: all use same canonical order
      // Report differences
    }
  },
  {
    name: 'Selector catalog completeness',
    validate: () => {
      // Extract selectors from Requirements examples
      // Check all exist in Design §4.5 catalog
      // Report missing entries
    }
  },
  {
    name: 'Terminology standardization',
    validate: () => {
      // Scan all docs for alias terms
      // Flag inconsistencies with preferred terms
      // Generate replacement suggestions
    }
  },
  {
    name: 'REQ-* ID uniqueness',
    validate: () => {
      // Extract all REQ-* IDs from Requirements
      // Check for duplicates
      // Verify sequential numbering within categories
    }
  }
];
```

#### 5.1.2 validate-coverage.js

```javascript
/**
 * Requirements coverage validation
 * Run: node scripts/validate-coverage.js
 */

const checks = [
  {
    name: 'REQ to Design mapping',
    validate: () => {
      // For each REQ-* in Requirements.md
      // Find mentions in Design.md
      // Report orphaned requirements
    }
  },
  {
    name: 'Design to Task mapping',
    validate: () => {
      // For each §N.M in Design.md
      // Find "Validates:" mentions in Tasks.md
      // Report unimplemented design sections
    }
  },
  {
    name: 'Error code implementation',
    validate: () => {
      // Extract error codes from Requirements §4.1
      // Search for handling in src/errors.js
      // Report missing handlers
    }
  },
  {
    name: 'Selector presence in groundtruth',
    validate: () => {
      // Extract selectors from Design §4.5
      // Parse groundtruth HTML fixtures
      // Report selectors not found in any fixture
    }
  }
];
```

#### 5.1.3 validate-links.js

```javascript
/**
 * Internal link validation
 * Run: node scripts/validate-links.js
 */

const checks = [
  {
    name: 'File links reachable',
    validate: () => {
      // Extract all [text](file://...) links
      // Check file paths exist
      // Report broken file links
    }
  },
  {
    name: 'Anchor links valid',
    validate: () => {
      // Extract links with #anchor
      // Parse target files for matching headers
      // Report broken anchor links
    }
  },
  {
    name: 'Cross-reference reciprocity',
    validate: () => {
      // Find REQ → Design links
      // Check Design has back-reference to REQ
      // Report one-way links
    }
  }
];
```

### 5.2 Manual Review Checklist

Before marking documentation complete, verify:

#### 5.2.1 Requirements.md

- [ ] All P0 requirements have concrete acceptance criteria
- [ ] Error taxonomy table complete (7+ error codes)
- [ ] All selectors use backtick code format
- [ ] View list in REQ-VIEW-06 matches canonical order
- [ ] Edge case requirements (REQ-VIEW-07 through -11) present
- [ ] All REQ-* IDs unique and sequential

#### 5.2.2 Design.md

- [ ] Selector catalog §4.5 has all groundtruth selectors
- [ ] Integration testing §9 has ≥8 test scenarios
- [ ] Performance metrics §10 has baseline targets
- [ ] All code examples follow template format
- [ ] Every parser function has corresponding fixture test reference
- [ ] Dedup key logic matches Requirements §2.5

#### 5.2.3 Tasks.md

- [ ] All tasks have "Validates:" field with REQ-* IDs
- [ ] All DoD sections have ≥3 specific criteria
- [ ] Error handling task (T6.4) present and detailed
- [ ] Time estimates sum to ~10 days total
- [ ] Dependencies in EPIC 0 → 6 order maintained

#### 5.2.4 Groundtruth-Analysis.md

- [ ] Table of contents present
- [ ] Quick reference §6 with 3 tables added
- [ ] Fixture coverage matrix shows all 9 files
- [ ] Dedup key strategy table present

#### 5.2.5 Cross-Document

- [ ] Terminology consistent (dedup_key, personil, canonical URL)
- [ ] View lists identical across all documents
- [ ] Selector examples match catalog
- [ ] All internal links tested and valid
- [ ] Commit message references REQ-* for traceability

### 5.3 Acceptance Criteria

Documentation improvement is **DONE** when:

1. ✅ All P0 requirements (9) implemented and validated
2. ✅ All P1 requirements (9) implemented and validated
3. ✅ Automated validation scripts pass 100%
4. ✅ Manual review checklist 100% complete
5. ✅ Peer review confirms consistency and completeness
6. ✅ Git history shows atomic commits per requirement
7. ✅ Estimated 1.5 days within ±20% variance

---

## 6. Migration Plan & Staging

### 6.1 Phased Implementation

**Phase 1: P0 Requirements (Day 1 Morning)**
- Hours 1-2: Add error taxonomy to Requirements.md (REQ-P0-1)
- Hours 3-4: Add selector catalog to Design.md (REQ-P0-4)
- Hours 5-6: Add error handling task to Tasks.md (REQ-P0-5)
- Hours 7-8: Update view lists and selectors (REQ-P0-2, REQ-P0-3)

**Phase 2: P1 Requirements (Day 1 Afternoon)**
- Hours 1-2: Add integration testing section to Design.md (REQ-P1-2)
- Hours 3-4: Add performance metrics to Design.md (REQ-P1-3)
- Hours 5-6: Add traceability links to Tasks.md (REQ-P1-4, REQ-P1-5)
- Hours 7-8: Add edge case requirements to Requirements.md (REQ-P1-1)

**Phase 3: P2 Requirements & Validation (Day 2)**
- Hours 1-2: Add TOC and quick reference to Groundtruth.md (REQ-P2-1, REQ-P2-2)
- Hours 3-4: Run automated validation scripts, fix issues
- Hours 5-6: Manual review checklist, peer review
- Hours 7-8: Final validation, commit messages, tagging

### 6.2 Commit Strategy

Each commit should be atomic and reference requirements:

**Commit message format:**
```
[{Priority}] {REQ-ID}: {Brief description}

{Detailed changes}

Validates: {REQ-ID}
Files modified: {list}
```

**Example:**
```
[P0] REQ-P0-1: Add error taxonomy to Requirements.md

- Added §4 Error Taxonomy & Handling Strategy
- Documented 7 error codes with recovery strategies
- Specified screenshot naming convention
- Added error handling principles

Validates: REQ-P0-1
Files modified: docs/02-Requirements.md
```

**Commit order (preserves git history):**
1. Phase 1 P0 requirements (4 commits, one per file major change)
2. Phase 2 P1 requirements (4 commits, one per file major change)
3. Phase 3 P2 requirements (2 commits)
4. Validation fixes (1-3 commits as needed)
5. Final polish commit

### 6.3 Rollback Strategy

If validation fails or introduces regressions:

1. **Identify breaking commit:** Use `git log` and validation script output
2. **Create fix branch:** `git checkout -b hotfix/doc-validation`
3. **Selective revert:** `git revert {commit-sha}` for specific bad commit
4. **Re-apply correctly:** Make corrected changes, rerun validation
5. **Merge back:** Fast-forward merge once validation passes

**Never rebase** after pushing to shared branches—use revert and fix commits.

### 6.4 Backup & Safety

Before starting:
```bash
# Create backup branch
git checkout -b backup/pre-doc-improvement
git push origin backup/pre-doc-improvement

# Work on feature branch
git checkout -b feature/documentation-improvement
```

After completion:
```bash
# Merge to main after validation
git checkout main
git merge --no-ff feature/documentation-improvement
git tag -a v1.1-docs-complete -m "Documentation improved to 95%"
git push origin main --tags
```

---

## 7. Risk Mitigation

### 7.1 Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Terminology inconsistency introduced | Medium | High | Run validate-consistency.js after each change |
| Broken internal links | Medium | Medium | Run validate-links.js before commit |
| Requirements orphaned (no Design coverage) | Low | High | Run validate-coverage.js daily |
| Selector examples don't match groundtruth | Medium | High | Cross-reference with §2 of Groundtruth.md manually |
| Overwrote working content | Low | Critical | Git backup branch + atomic commits |
| Time overrun (>1.5 days) | Medium | Medium | Focus on P0 first, defer P2 if needed |
| Validation scripts false positives | Medium | Low | Manual review for each flagged issue |

### 7.2 Breaking Change Detection

Monitor for these signals:

1. **Validation script failures:** Any check goes from pass to fail
2. **External dependency:** New npm packages required (should be zero)
3. **File renames:** Would break external links
4. **Schema changes:** Altering data contract without migration plan
5. **Selector changes:** Updated selectors not validated against HTML

**Response:** Immediately revert last commit, investigate, fix in isolation, re-validate.

### 7.3 Quality Gates

Must pass before proceeding to next phase:

**Gate 1 (After Phase 1):**
- [ ] validate-consistency.js passes
- [ ] All P0 requirements documented
- [ ] No broken file links

**Gate 2 (After Phase 2):**
- [ ] validate-coverage.js passes
- [ ] All P1 requirements documented
- [ ] Cross-references bidirectional

**Gate 3 (Before Completion):**
- [ ] validate-links.js passes
- [ ] Manual review checklist 100%
- [ ] Peer review approved
- [ ] Git history clean and atomic

---

## 8. Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Note:** This feature is a documentation improvement task, not a software system with executable behavior. Traditional property-based testing (generating random inputs to verify universal properties) is not applicable here. Instead, we define **validation properties** that documentation artifacts must satisfy.

### Property 1: Terminology Consistency

*For any* pair of documents (Requirements, Design, Tasks, Groundtruth), the usage of standard terms (dedup_key, personil, canonical URL, view, author, dosen) shall be consistent according to the terminology map in §4.4.

**Validates: Requirements §4.2, Design §4.5, Cross-cutting consistency**

**Validation Method:** Automated script `validate-consistency.js` scans all documents, flags alias usage, reports inconsistencies.

### Property 2: Selector Catalog Completeness

*For any* CSS selector mentioned in Requirements.md examples or Design.md parser specifications, that selector shall appear in the Design.md §4.5 Selector Reference Catalog with complete documentation (purpose, expected value).

**Validates: Requirements §1.4 REQ-VIEW-*, Design §4.5**

**Validation Method:** Script extracts all backtick-wrapped selectors, cross-references with §4.5 table, reports missing entries.

### Property 3: Requirements Coverage

*For any* requirement ID (REQ-*) in Requirements.md, there shall exist at least one Design section (§N.M) that explicitly mentions implementing or validating that requirement.

**Validates: Requirements-to-Design traceability**

**Validation Method:** Script `validate-coverage.js` parses REQ-* IDs, searches Design.md for mentions, reports orphaned requirements.

### Property 4: Task Traceability

*For any* Design section (§N.M) specifying implementation details, there shall exist at least one Task (T#.#) with a "Validates:" field referencing related REQ-* IDs.

**Validates: Design-to-Tasks traceability**

**Validation Method:** Script extracts §N.M sections with implementation details, searches Tasks.md for "Validates:" mentions, reports gaps.

### Property 5: Link Validity

*For any* internal markdown link `[text](file://path#anchor)` in any documentation file, the target file shall exist and contain a header matching the anchor.

**Validates: Cross-document navigation**

**Validation Method:** Script `validate-links.js` resolves file paths, parses target headers, reports broken links.

### Property 6: View List Canonicality

*For any* mention of the complete view list (in Requirements REQ-VIEW-06, Design parser code, Tasks EPIC 3), the views shall appear in canonical order: scopus, wos, garuda, googlescholar, researches, services, iprs, books, rama, pak, kepakaran, matrics, arts.

**Validates: Requirements §1.4 REQ-VIEW-06, Design §4.1, consistency**

**Validation Method:** Script extracts view lists using regex, compares order, reports deviations.

### Property 7: Error Code Coverage

*For any* error code documented in Requirements §4.1 Error Taxonomy table, there shall exist handling logic in src/errors.js and a corresponding screenshot filename pattern.

**Validates: Requirements §4 Error Taxonomy, Design §9 Integration Testing**

**Validation Method:** Script parses error taxonomy table, searches codebase for error code constants and handlers, reports missing implementations.

### Property 8: Fixture Selector Presence

*For any* selector in Design §4.5 Selector Reference Catalog, that selector shall successfully match at least one element in at least one groundtruth HTML fixture file.

**Validates: Design §4.5 Selector Catalog, Groundtruth §2**

**Validation Method:** Script parses HTML fixtures with Cheerio, tests each selector, reports selectors that match zero elements.

---

## 9. Implementation Notes

### 9.1 File Encoding

All documentation files use:
- **Encoding:** UTF-8 without BOM (markdown standard)
- **Line endings:** LF (Unix-style, enforced by .gitattributes)
- **Trailing newline:** Required (POSIX standard)

### 9.2 Markdown Style Guide

Consistency rules:
- **Headers:** ATX-style (`#`, `##`, etc.) not Setext
- **Lists:** Use `-` for unordered, `1.` for ordered
- **Code blocks:** Always specify language (```javascript, not ```)
- **Tables:** Use standard markdown, align headers with `|---|`
- **Links:** Prefer reference-style for repeated URLs
- **Emphasis:** Use `**bold**` for terms, `*italic*` for emphasis, `code` for technical

### 9.3 Section Numbering

Maintain existing numbering:
- **Do not renumber** existing sections to avoid breaking external links
- **Add new sections** at end of sequence (§9, §10, etc.)
- **Use subsections** (§4.1.1) for detailed breakdowns within existing sections

### 9.4 Groundtruth Precedence

When conflicts arise:
1. **Groundtruth HTML findings** are source of truth for selectors
2. **Requirements** are source of truth for business rules
3. **Design** must reconcile both; note discrepancies explicitly
4. **Tasks** implement Design, not override it

If groundtruth contradicts Requirements, document in design and propose Requirements update.

---

## 10. Success Metrics

### 10.1 Quantitative Metrics

| Metric | Baseline (85%) | Target (95%) | Measurement Method |
|---|---|---|---|
| Requirements coverage | ~48/57 REQ-* have Design mapping | 54/57 (95%) | validate-coverage.js |
| Selector catalog completeness | ~25 selectors documented | 45 selectors (all from groundtruth) | Manual count in §4.5 |
| Cross-reference density | ~12 internal links | 40+ bidirectional links | validate-links.js count |
| Error documentation | 3 error codes | 7+ error codes | Count in §4.1 table |
| Test scenario coverage | 4 fixture tests | 20 unit + 8 integration tests | Count in §8, §9 |

### 10.2 Qualitative Metrics

- [ ] New developer can understand selector strategy from catalog alone
- [ ] All error codes have clear recovery procedures
- [ ] Cross-references make navigation intuitive
- [ ] Terminology consistent enough for search-and-replace safety
- [ ] Commit history tells clear story of incremental improvement

### 10.3 Validation Output

After implementation, `npm run validate` should output:

```
✅ validate-consistency.js
  - Terminology: 0 inconsistencies found
  - View lists: All match canonical order
  - Selector format: All use backtick code style

✅ validate-coverage.js
  - Requirements coverage: 54/57 (95%)
  - Design sections: 100% have task mappings
  - Error codes: 7/7 implemented

✅ validate-links.js
  - Internal file links: 47/47 valid
  - Anchor links: 38/38 valid
  - Broken links: 0

✅ validate-selectors.js
  - Selectors syntax: 45/45 valid CSS
  - Fixture presence: 43/45 found in groundtruth
  - Missing from fixtures: 2 (wos, rama - pending TODO)

Documentation completeness: 95% ✅ TARGET MET
```

---

## Appendices

### A. Glossary of Terms

| Term | Definition | Context |
|---|---|---|
| Canonical URL | UUID-based department profile URL format | Design, preferred for scraping |
| Dedup key | Composite unique identifier for database records | Prevents duplicate inserts |
| Groundtruth | Validated findings from actual HTML analysis | Source of truth for selectors |
| Legacy URL | Code-based department profile URL format | Design, alternate format |
| Personil | Research team members with SINTA IDs | Indonesian term, code uses this |
| Property | Universal correctness statement about system | Testing strategy |
| REQ-* | Requirement identifier | Requirements.md |
| Selector | CSS selector for DOM element | Web scraping |
| View | Content category in SINTA (scopus, researches, etc.) | System terminology |

### B. Document Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2024 | Kiro | Initial design for documentation improvement |

### C. References

- [Requirements Specification](file:///d:/laragon/www/sintascraper/docs/02-Requirements.md)
- [Groundtruth Analysis](file:///d:/laragon/www/sintascraper/docs/05-Groundtruth-Analysis.md)
- [Existing Design Document](file:///d:/laragon/www/sintascraper/docs/03-Design.md)
- [Task Breakdown](file:///d:/laragon/www/sintascraper/docs/04-Tasks.md)
- [Markdown Style Guide](https://www.markdownguide.org/basic-syntax/)
- [Semantic Versioning](https://semver.org/)

---

**END OF DESIGN DOCUMENT**
