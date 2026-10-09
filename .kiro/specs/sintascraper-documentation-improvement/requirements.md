# Requirements Document — SINTAScraper Documentation Improvement

## Introduction

This requirements document specifies the improvements needed for the SINTAScraper documentation to address 23 identified issues (9 critical, 9 high, 5 medium priority) discovered during the clarification phase. The goal is to increase documentation completeness from 85% to 95% by standardizing terminology, resolving inconsistencies, adding missing specifications, and ensuring full traceability between PRD, Requirements, Design, and Tasks documents.

The improvements focus on operationalizing findings from the Groundtruth Analysis document and ensuring all acceptance criteria are testable and measurable. The estimated effort is 1.5 days: 1 day for pre-implementation documentation updates and 0.5 day for validation during implementation.

## Glossary

- **Documentation_System**: The complete set of documentation files including PRD (01-PRD.md), Requirements (02-Requirements.md), Design (03-Design.md), Tasks (04-Tasks.md), and Groundtruth Analysis (05-Groundtruth-Analysis.md)
- **View_List**: The enumeration of SINTA data categories including scopus, wos, garuda, googlescholar, researches, services, iprs, books, rama, pak, kepakaran, matrics, and arts
- **Dedup_Key**: The composite unique identifier strategy using either scopus_eid or hash of (title + year + leader/inventor)
- **Acceptance_Criteria**: Testable conditions in the Requirements document that define completion
- **Traceability**: The bidirectional linkage between requirements, design decisions, and implementation tasks
- **Fixture**: HTML sample files used as golden test data for parser validation
- **Groundtruth_Finding**: Empirical evidence from analyzing actual SINTA HTML files

## Requirements

### Requirement 1: View List Standardization

**User Story:** As a developer implementing the scraper, I want a single authoritative list of SINTA views across all documentation, so that I know exactly which views to implement without ambiguity.

#### Acceptance Criteria

1. THE Documentation_System SHALL maintain exactly one canonical view list containing: scopus, wos, garuda, googlescholar, researches, services, iprs, books, rama, pak, kepakaran, matrics, arts
2. WHEN a view is referenced in any document, THE Documentation_System SHALL use the canonical name from the view list
3. THE PRD (Section 5) SHALL replace the incomplete view enumeration with the complete canonical view list
4. THE Requirements (REQ-VIEW-06) SHALL update the view list to match the canonical view list
5. THE Design (Section 4.1) SHALL reference the canonical view list in the parseArListItem function specification
6. THE Tasks (T3.3) SHALL enumerate all 13 views with explicit subtasks for each view
7. WHERE the WOS view is mentioned, THE Documentation_System SHALL explicitly note that it may have CSS class "d-none" but must still be scraped

**Priority:** P0 (Critical)  
**Affected Documents:** PRD §5, Requirements REQ-VIEW-06, Design §4.1, Tasks T3.3  
**Groundtruth Reference:** §1.6, §2.3, §3

---

### Requirement 2: Dedup Key Strategy Specification

**User Story:** As a developer implementing data storage, I want clear and complete rules for generating unique dedup keys for all record types, so that I can prevent data collisions and duplicates.

#### Acceptance Criteria

1. THE Requirements (REQ-VIEW-05) SHALL specify the dedup key generation algorithm for all view types
2. WHEN a record has a Scopus URL, THE System SHALL use "scopus:" + scopus_eid as the dedup key
3. WHEN a record has an IPR application number, THE System SHALL use "iprs:" + nomor_permohonan as the dedup key
4. WHEN a record has neither Scopus URL nor IPR number, THE System SHALL use view_name + ":" + MD5(normalized_title + "_" + year + "_" + (leader OR inventor OR creator OR "")) as the dedup key
5. THE Design (Section 4.1 parseArListItem) SHALL implement the complete dedup key algorithm with code examples
6. THE Requirements SHALL document that internal dummy links (href ending with "#!") must never be used alone as dedup keys
7. THE Design SHALL include unit test assertions verifying dedup key uniqueness for fixture samples

**Priority:** P0 (Critical)  
**Affected Documents:** Requirements REQ-VIEW-05, Design §4.1, Groundtruth §1.3  
**Groundtruth Reference:** §1.3, §3

---

### Requirement 3: Pagination Mechanism Clarity

**User Story:** As a developer implementing navigation, I want explicit specifications for pagination that match actual SINTA behavior, so that I implement the correct numbered pagination approach instead of incorrect assumptions.

#### Acceptance Criteria

1. THE Requirements (REQ-VIEW-01) SHALL replace all references to "View more button" with "numbered pagination via ?page=N&view=V"
2. THE Requirements SHALL specify that pagination info is extracted from "div.pagination-text small" containing "Page X of Y | Total Records Z"
3. THE Requirements SHALL specify the fallback behavior: auto-scroll and "View more" button only when pagination bar is not detected
4. THE Design (Section 3.2) SHALL update the pagination sequence diagram to show numbered page loops instead of View-more clicks
5. THE Design (Section 4.4 parsePaginationInfo) SHALL include regex pattern: `/Page\s+(\d+)\s+of\s+(\d+)\s*\|\s*Total Records\s+(\d+)/i`
6. THE Tasks (T3.2) SHALL explicitly document the numbered pagination loop as the primary mechanism
7. THE Requirements SHALL specify that if Total Records > 0 but parsed items == 0, the system must log a selector error and save HTML snapshot

**Priority:** P0 (Critical)  
**Affected Documents:** Requirements REQ-VIEW-01, Design §3.2, §4.4, Tasks T3.2  
**Groundtruth Reference:** §1.1, §2.1

---

### Requirement 4: WOS View Handling

**User Story:** As a developer implementing view scraping, I want explicit instructions for handling the WOS view which may be hidden with CSS, so that I don't accidentally skip this data source.

#### Acceptance Criteria

1. THE Requirements SHALL add a new requirement REQ-VIEW-WOS specifying that WOS view must be scraped even if CSS class "d-none" is present
2. THE Requirements (REQ-VIEW-WOS) SHALL specify the selector: `li.d-none a[href*="view=wos"]` for detecting hidden WOS tab
3. THE Design (Section 2.2) SHALL document that tab parsing must include hidden elements with "d-none" class
4. THE Tasks SHALL add T3.3g-WOS subtask with explicit acceptance criteria for WOS view scraping
5. THE PRD (Section 5, F6-F12) SHALL note that WOS is extracted even when hidden in the UI
6. THE Groundtruth Analysis SHALL be cross-referenced in all WOS-related requirements

**Priority:** P0 (Critical)  
**Affected Documents:** Requirements (new REQ-VIEW-WOS), PRD §5, Design §2.2, Tasks T3.3g  
**Groundtruth Reference:** §1.6, §2.5

---

### Requirement 5: Missing Fixture Documentation

**User Story:** As a QA engineer, I want complete fixture documentation for all views, so that I can validate parsers against known-good data.

#### Acceptance Criteria

1. THE Design (Section 8 Golden Fixture Testing) SHALL document all four existing fixture files with expected parse results
2. THE Tasks SHALL add T0.2.1 for documenting which views are covered by existing fixtures: iprs (DepartmentProfile.html), researches (AuthorResearch.html), scopus (AuthorsProfile.html)
3. THE Tasks SHALL add T0.2.2 for identifying missing fixture views: services, books, garuda, googlescholar, wos, rama, pak, kepakaran, matrics, arts
4. THE Tasks SHALL add T3.4.1 requiring capture of HTML samples during first successful scrape of each missing view
5. THE Design SHALL specify the fixture directory structure: `tests/fixtures/{view_name}/sample_{dept|author}_{N}.html`
6. THE Requirements SHALL add REQ-NFR-07 specifying that parsers must be validated against at least one fixture per view before production use
7. THE Groundtruth Analysis SHALL cross-reference which views lack fixtures

**Priority:** P1 (High)  
**Affected Documents:** Design §8, Tasks T0.2, Requirements (new REQ-NFR-07), Groundtruth §5  
**Groundtruth Reference:** §5

---

### Requirement 6: Field Extraction Completeness

**User Story:** As a data analyst, I want all available fields documented and extracted, so that no valuable data is lost during scraping.

#### Acceptance Criteria

1. THE Requirements SHALL add explicit field lists for each view type matching Groundtruth Analysis §3
2. WHEN documenting the scopus view, THE Requirements SHALL include fields: scopus_eid, quartile, journal, journal_url, author_order, creator, year, cited
3. WHEN documenting the researches view, THE Requirements SHALL include fields: leader, scheme, personil_names, personil_ids, year, fund_rp, status, source
4. WHEN documenting the iprs view, THE Requirements SHALL include fields: inventor, holder_pub, year, nomor_permohonan, ipr_type
5. THE Design (Section 2 Data Contract) SHALL update JSON schemas to include all fields from Groundtruth §3
6. THE Design (Section 4.1 parseArListItem) SHALL implement extraction logic for all documented fields
7. THE Design (Section 5 SQLite Schema) SHALL include columns for all documented fields

**Priority:** P0 (Critical)  
**Affected Documents:** Requirements REQ-VIEW-02, Design §2, §4.1, §5  
**Groundtruth Reference:** §3

---

### Requirement 7: Selector Precision Standards

**User Story:** As a developer maintaining the scraper, I want all CSS selectors documented with their purpose and expected results, so that I can troubleshoot selector failures quickly.

#### Acceptance Criteria

1. THE Design SHALL create a new Section 4.6 "Selector Reference Table" documenting all CSS selectors
2. WHEN documenting each selector, THE Design SHALL specify: selector string, target element, expected cardinality, fallback behavior
3. THE Design (Section 4.6) SHALL document universal record selector: `.profile-article > .ar-list-item.mb-5`
4. THE Design (Section 4.6) SHALL document pagination selector: `div.pagination-text small`
5. THE Design (Section 4.6) SHALL document login verification selector: `a.dropdown-item[href$="/logins/logout"]`
6. THE Design (Section 4.6) SHALL document all metadata selectors: `.ar-title a`, `.ar-quartile`, `.ar-pub`, `.ar-year`, `.ar-cited`, `.ar-meta`
7. THE Design SHALL cross-reference Groundtruth Analysis §2 for each documented selector

**Priority:** P1 (High)  
**Affected Documents:** Design (new §4.6)  
**Groundtruth Reference:** §2.1, §2.2, §2.3, §2.6

---

### Requirement 8: Traceability Linkage

**User Story:** As a project manager, I want explicit traceability from PRD features through requirements to design and tasks, so that I can verify completeness and impact of changes.

#### Acceptance Criteria

1. THE Requirements SHALL add a "Traceability Matrix" section mapping each requirement to PRD sections and Design sections
2. WHEN a PRD feature is referenced, THE Requirements SHALL use consistent feature IDs (F0-F16)
3. THE Design SHALL add "Implements" annotations referencing specific REQ-IDs from Requirements
4. THE Tasks SHALL add "Satisfies" annotations referencing specific REQ-IDs and Design sections
5. THE Requirements SHALL use hyperlinks to reference PRD, Design, and Groundtruth sections
6. THE Design SHALL use hyperlinks to reference Requirements and Tasks sections
7. WHERE a Groundtruth finding changes a requirement, THE Requirements SHALL explicitly note the Groundtruth section number

**Priority:** P1 (High)  
**Affected Documents:** All documentation files  
**Groundtruth Reference:** N/A (process requirement)

---

### Requirement 9: URL Format Dual-Mode Documentation

**User Story:** As a developer implementing navigation, I want clear documentation of both canonical UUID and legacy code-based URL formats, so that I handle both formats correctly.

#### Acceptance Criteria

1. THE Requirements (REQ-DEPT-01) SHALL document both canonical UUID URL format and legacy code URL format
2. THE Requirements SHALL specify that canonical UUID URLs are used for navigation
3. THE Requirements SHALL specify that legacy code URLs are stored for reference and debugging
4. THE Design (Section 1.2 departments.json) SHALL include both canonicalUrl and legacyUrl fields
5. THE PRD (Section 1 and Appendix) SHALL add a note explaining the dual URL format
6. THE Groundtruth Analysis finding §1.5 SHALL be explicitly referenced in all dual-URL documentation
7. THE Tasks SHALL add validation step T2.2.1 verifying both URL formats are captured

**Priority:** P1 (High)  
**Affected Documents:** PRD §1, Requirements REQ-DEPT-01, Design §1.2, Tasks T2.2  
**Groundtruth Reference:** §1.5

---

### Requirement 10: Session Verification Enhancement

**User Story:** As a developer implementing authentication, I want detailed session verification logic, so that I can detect and recover from session loss reliably.

#### Acceptance Criteria

1. THE Requirements (REQ-AUTH-03) SHALL replace "URL check" with "URL AND DOM selector check"
2. THE Requirements (REQ-AUTH-03) SHALL specify logout selector: `a.dropdown-item[href$="/logins/logout"]`
3. THE Requirements (REQ-AUTH-03) SHALL specify that username text (e.g., "SYAHRONI") must be present in navbar
4. THE Requirements (REQ-AUTH-04) SHALL specify that session guard checks the selector before every data navigation
5. THE Design (Section 3.1 Auth Flow) SHALL update the sequence diagram to show DOM selector verification
6. THE Design (Section 2.6 of Groundtruth) SHALL be cross-referenced for login detection logic
7. THE Tasks (T1.2) SHALL add explicit test cases for session verification

**Priority:** P0 (Critical)  
**Affected Documents:** Requirements REQ-AUTH-03, REQ-AUTH-04, Design §3.1, Tasks T1.2  
**Groundtruth Reference:** §2.6

---

### Requirement 11: Error Code Standardization

**User Story:** As a DevOps engineer monitoring the scraper, I want standardized error codes and logging, so that I can quickly diagnose failures.

#### Acceptance Criteria

1. THE Requirements SHALL add a new section "Error Codes and Handling"
2. THE Requirements SHALL define error code: LOGIN_TIMEOUT when login polling exceeds 120 seconds
3. THE Requirements SHALL define error code: SESSION_LOST when session verification fails
4. THE Requirements SHALL define error code: SELECTOR_MISMATCH when Total Records > 0 but parsed items == 0
5. THE Requirements SHALL define error code: PAGINATION_PARSE_ERROR when pagination info cannot be extracted
6. THE Requirements SHALL specify that all error codes trigger automatic screenshot capture
7. THE Design (Section 6 Logger) SHALL implement all documented error codes with structured logging

**Priority:** P1 (High)  
**Affected Documents:** Requirements (new section), Design §6  
**Groundtruth Reference:** N/A (implementation quality requirement)

---

### Requirement 12: Acceptance Criteria Testability

**User Story:** As a QA engineer, I want all acceptance criteria to be measurable and testable, so that I can objectively verify completion.

#### Acceptance Criteria

1. THE Requirements SHALL review all acceptance criteria in the checklist (Section 5) for measurability
2. WHEN an acceptance criterion uses vague terms ("lengthy", "complete", "correct"), THE Requirements SHALL replace with quantifiable metrics
3. THE Requirements SHALL replace "Seluruh link personil riset ter-resolve" with "100% of personil links match regex /authors/profile/(\\d+) and resolve to valid SINTA IDs"
4. THE Requirements SHALL replace "Data profil 3 program studi terambil lengkap" with "All fields in Table 2.4 (Author Profile Schema) are non-null for all 3 departments"
5. THE Requirements SHALL add pass/fail criteria with specific thresholds for each checklist item
6. THE Tasks SHALL cross-reference each acceptance criterion with specific test case IDs
7. WHERE an acceptance criterion cannot be automated, THE Requirements SHALL mark it as "Manual Test Required" with test procedure

**Priority:** P1 (High)  
**Affected Documents:** Requirements §5 (Acceptance Checklist)  
**Groundtruth Reference:** N/A (quality requirement)

---

### Requirement 13: Data Schema Completeness

**User Story:** As a database administrator, I want complete SQLite schema documentation with all constraints and indexes, so that I can optimize storage and queries.

#### Acceptance Criteria

1. THE Design (Section 5 SQLite Schema) SHALL add missing fields discovered in Groundtruth §3
2. THE Design SHALL add field: scopus_eid TEXT to items table
3. THE Design SHALL add field: author_order TEXT to items table
4. THE Design SHALL add field: nomor_permohonan TEXT to items table
5. THE Design SHALL add field: fund_rp TEXT to items table
6. THE Design SHALL document all UNIQUE constraints with rationale
7. THE Design SHALL document all foreign key relationships with cascade behavior

**Priority:** P0 (Critical)  
**Affected Documents:** Design §5  
**Groundtruth Reference:** §3

---

### Requirement 14: Export Format Specifications

**User Story:** As a data consumer, I want complete specifications for all export formats, so that I know exactly what structure and encoding to expect.

#### Acceptance Criteria

1. THE Requirements (REQ-EXP-03) SHALL specify Excel workbook structure: sheet order, header formatting, frozen panes, autofilter
2. THE Requirements (REQ-EXP-03) SHALL specify that URL columns use formula: =HYPERLINK(url, "Buka Tautan")
3. THE Requirements (REQ-EXP-04) SHALL specify CSV encoding: UTF-8 with BOM (\uFEFF)
4. THE Requirements (REQ-EXP-04) SHALL specify CSV delimiter: semicolon (;) for Indonesian locale
5. THE Requirements (REQ-EXP-04) SHALL specify CSV quoting rules: minimal quoting, escape double-quotes with double-double-quotes
6. THE Design (Section 6.1 Excel Exporter) SHALL provide code examples for exceljs workbook creation
7. THE Design (Section 6.2 CSV Exporter) SHALL provide code examples for csv-stringify configuration

**Priority:** P1 (High)  
**Affected Documents:** Requirements REQ-EXP-03, REQ-EXP-04, Design §6.1, §6.2  
**Groundtruth Reference:** N/A (output format requirement)

---

### Requirement 15: Personil Extraction Documentation

**User Story:** As a developer implementing research data parsing, I want clear documentation of personil/co-author extraction, so that I capture all collaboration relationships.

#### Acceptance Criteria

1. THE Requirements (REQ-VIEW-02) SHALL document personil extraction for researches and services views
2. THE Requirements SHALL specify that personil names are extracted from text following "Personils :" label
3. THE Requirements SHALL specify that personil SINTA IDs are extracted from links matching `a[href*="/authors/profile/"]`
4. THE Requirements SHALL specify handling of empty personil: text contains "-" results in empty arrays
5. THE Design (Section 4.1 parseArListItem) SHALL implement personil extraction logic
6. THE Design (Section 2.2 Research Record Schema) SHALL include personil_names (array) and personil_ids (array) fields
7. THE Groundtruth finding §1.4 SHALL be explicitly referenced

**Priority:** P0 (Critical)  
**Affected Documents:** Requirements REQ-VIEW-02, Design §4.1, §2.2  
**Groundtruth Reference:** §1.4, §3

---

### Requirement 16: Dynamic View Detection

**User Story:** As a maintainer, I want the scraper to automatically detect available views from the DOM, so that new views added by SINTA are automatically scraped without code changes.

#### Acceptance Criteria

1. THE Requirements SHALL add REQ-VIEW-07 specifying dynamic view detection from navigation tabs
2. THE Requirements (REQ-VIEW-07) SHALL specify that department views are parsed from `nav.profile-nav` links
3. THE Requirements (REQ-VIEW-07) SHALL specify that author article sub-tabs are parsed from `ul.article-tab` links
4. THE Requirements (REQ-VIEW-07) SHALL specify that hidden views (class "d-none") are included in the view list
5. THE Design SHALL add Section 4.7 "Dynamic View Discovery" with implementation logic
6. THE Tasks SHALL add T3.0 prerequisite task for implementing dynamic view detection
7. THE Groundtruth finding §1.6 SHALL be explicitly referenced

**Priority:** P2 (Medium)  
**Affected Documents:** Requirements (new REQ-VIEW-07), Design (new §4.7), Tasks (new T3.0)  
**Groundtruth Reference:** §1.6, §2.3

---

### Requirement 17: Rate Limiting Documentation

**User Story:** As an operations engineer, I want detailed rate limiting and retry specifications, so that I can configure the scraper for reliable operation without overloading SINTA servers.

#### Acceptance Criteria

1. THE Requirements (REQ-NFR-01) SHALL specify base delay range: 2000-3500 milliseconds
2. THE Requirements (REQ-NFR-01) SHALL specify random jitter: +0-500 milliseconds
3. THE Requirements (REQ-NFR-02) SHALL specify retry strategy: 3 attempts with exponential backoff (2s, 4s, 8s)
4. THE Requirements (REQ-NFR-02) SHALL specify which HTTP status codes trigger retry: 429, 500, 502, 503, 504
5. THE Requirements (REQ-NFR-02) SHALL specify which errors do not trigger retry: 401, 403, 404
6. THE Design SHALL add Section 7.1 "Rate Limiting Implementation" with algorithm details
7. THE Tasks (T6.1) SHALL include rate limiting verification tests

**Priority:** P2 (Medium)  
**Affected Documents:** Requirements REQ-NFR-01, REQ-NFR-02, Design (new §7.1), Tasks T6.1  
**Groundtruth Reference:** N/A (infrastructure requirement)

---

### Requirement 18: Checkpoint/Resume Documentation

**User Story:** As an operator, I want clear documentation of checkpoint/resume functionality, so that I can recover from interruptions without losing progress.

#### Acceptance Criteria

1. THE Requirements (REQ-NFR-02) SHALL document state.json structure for checkpoint recovery
2. THE Requirements SHALL specify that checkpoint is saved after each successfully scraped page
3. THE Requirements SHALL specify that resume starts from last incomplete (dept, view, page) tuple
4. THE Design (Section 7 State Management) SHALL include complete state.json schema
5. THE Design SHALL specify the resume algorithm: read state.json, filter completed items, continue from last incomplete
6. THE Tasks SHALL add T3.2.1 for checkpoint save implementation and T3.2.2 for resume logic
7. THE Design Section 7 SHALL include code examples for checkpoint save and restore

**Priority:** P2 (Medium)  
**Affected Documents:** Requirements REQ-NFR-02, Design §7, Tasks T3.2  
**Groundtruth Reference:** N/A (reliability requirement)

---

### Requirement 19: Cross-Check Validation Documentation

**User Story:** As a quality assurance engineer, I want documentation of validation checks that cross-reference multiple data sources, so that I can verify data accuracy.

#### Acceptance Criteria

1. THE Requirements SHALL add REQ-NFR-08 for cross-validation between scraped records and pagination totals
2. THE Requirements (REQ-NFR-08) SHALL specify that count of parsed items must equal "Total Records" from pagination
3. THE Requirements SHALL add REQ-NFR-09 for cross-validation between department summary tables and scraped publication counts
4. THE Design SHALL add Section 8.2 "Data Validation Checks" documenting all cross-validation logic
5. THE Design (Section 8.2) SHALL reference Groundtruth §1.7 for sources: header .pr-num, .stat-table, echarts data
6. THE Tasks SHALL add T5.1.1 for implementing validation queries
7. THE Requirements SHALL specify tolerance for validation mismatches: exact match required for pagination, ±5% acceptable for summary statistics

**Priority:** P2 (Medium)  
**Affected Documents:** Requirements (new REQ-NFR-08, REQ-NFR-09), Design (new §8.2), Tasks T5.1  
**Groundtruth Reference:** §1.1, §1.7

---

### Requirement 20: Parser Robustness Standards

**User Story:** As a maintainer, I want documentation of error handling and fallback behavior for all parsers, so that minor DOM changes don't crash the scraper.

#### Acceptance Criteria

1. THE Design (Section 4 parsers) SHALL document null-safety for all selector operations
2. THE Design SHALL specify that missing optional fields return null instead of throwing exceptions
3. THE Design SHALL specify that missing required fields (title, year) log warnings and skip the record
4. THE Design SHALL specify that regex parse failures return null with logged warning
5. THE Design SHALL add Section 4.8 "Parser Error Handling" with try-catch patterns
6. THE Requirements SHALL add REQ-NFR-10 specifying parser resilience: continue operation despite individual item parse failures
7. THE Tasks (T3.1) SHALL add error handling test cases for parseArListItem

**Priority:** P1 (High)  
**Affected Documents:** Design §4, Requirements (new REQ-NFR-10), Tasks T3.1  
**Groundtruth Reference:** §5 (tolerance requirement)

---

### Requirement 21: Configuration Documentation Enhancement

**User Story:** As a system administrator, I want complete documentation of all configuration options in .env and departments.json, so that I can customize the scraper for different institutions.

#### Acceptance Criteria

1. THE Requirements (Section 4 Configuration) SHALL document all environment variables with data types and constraints
2. THE Requirements SHALL add documentation for departments.json structure with field descriptions
3. THE Requirements SHALL specify which .env variables are required vs optional
4. THE Requirements SHALL specify validation rules for each configuration value
5. THE Design (Section 1.2) SHALL add examples for adding new departments to departments.json
6. THE Tasks (T0.1) SHALL add configuration validation test
7. THE PRD SHALL add Section 9 "Configuration Guide" with step-by-step customization instructions

**Priority:** P2 (Medium)  
**Affected Documents:** PRD (new §9), Requirements §4, Design §1.2, Tasks T0.1  
**Groundtruth Reference:** N/A (usability requirement)

---

### Requirement 22: Performance Metrics Documentation

**User Story:** As a performance analyst, I want documented performance expectations and measurement criteria, so that I can verify the scraper meets efficiency targets.

#### Acceptance Criteria

1. THE Requirements SHALL add REQ-NFR-11 specifying performance targets: 1 department full scrape < 15 minutes
2. THE Requirements (REQ-NFR-11) SHALL specify throughput target: minimum 20 records per minute
3. THE Requirements SHALL specify memory usage target: maximum 500MB resident memory
4. THE Requirements SHALL specify that performance metrics are logged to JSONL
5. THE Design SHALL add Section 9 "Performance Monitoring" with instrumentation points
6. THE Tasks (T6.3) SHALL add performance benchmark test as acceptance gate
7. THE PRD (Section 3 Success Metrics) SHALL update speed metric to match REQ-NFR-11

**Priority:** P2 (Medium)  
**Affected Documents:** PRD §3, Requirements (new REQ-NFR-11), Design (new §9), Tasks T6.3  
**Groundtruth Reference:** N/A (performance requirement)

---

### Requirement 23: Documentation Consistency Review

**User Story:** As a technical writer, I want all documentation to use consistent terminology, formatting, and structure, so that readers can navigate between documents seamlessly.

#### Acceptance Criteria

1. THE Documentation_System SHALL use consistent heading structure: ## for major sections, ### for subsections
2. THE Documentation_System SHALL use consistent terminology from the Glossary in all documents
3. THE Documentation_System SHALL use consistent code block formatting: language-tagged markdown code blocks
4. THE Documentation_System SHALL use consistent reference format: [document §section] for internal cross-references
5. THE Documentation_System SHALL use consistent table formatting: markdown tables with header separators
6. THE Documentation_System SHALL use consistent list formatting: numbered for sequences, bullets for sets
7. WHERE technical terms are first introduced, THE Documentation_System SHALL define them in context and add to Glossary

**Priority:** P1 (High)  
**Affected Documents:** All documentation files  
**Groundtruth Reference:** N/A (quality requirement)

---

## Traceability Matrix

| Requirement | PRD Sections | Design Sections | Tasks | Priority | Issue Count |
|-------------|--------------|-----------------|-------|----------|-------------|
| REQ-1 View List | §5 (F6-F12) | §4.1 | T3.3 | P0 | Critical #1, #8 |
| REQ-2 Dedup Key | §2 (Problem 3) | §4.1 | T3.1 | P0 | Critical #3, #11 |
| REQ-3 Pagination | §5 (F6-F12) | §3.2, §4.4 | T3.2 | P0 | Critical #2, #9 |
| REQ-4 WOS View | §5 (F6-F12) | §2.2 | T3.3g | P0 | Critical #4 |
| REQ-5 Fixtures | §8 Golden Fixtures | §8 | T0.2, T3.4 | P1 | High #1, #2 |
| REQ-6 Fields | §5, §6 | §2, §4.1, §5 | T3.1, T3.3 | P0 | Critical #5, #6 |
| REQ-7 Selectors | - | new §4.6 | T3.1 | P1 | High #3 |
| REQ-8 Traceability | All | All | All | P1 | High #4 |
| REQ-9 Dual URL | §1, Appendix | §1.2 | T2.2 | P1 | High #5 |
| REQ-10 Session | §5 (F0) | §3.1 | T1.2 | P0 | Critical #7 |
| REQ-11 Error Codes | §8 Risks | new §6 | T6.1 | P1 | High #6 |
| REQ-12 Testability | §3 Metrics | §5 Acceptance | All | P1 | High #7 |
| REQ-13 Schema | §6 Data Contract | §5 | T5.1 | P0 | Critical #12 |
| REQ-14 Export | §5 (F16) | §6.1, §6.2 | T5.2, T5.3 | P1 | High #8 |
| REQ-15 Personil | §5 (F9-F10) | §4.1, §2.2 | T3.3b | P0 | Critical #13 |
| REQ-16 Dynamic Views | §5 (F6-F12) | new §4.7 | new T3.0 | P2 | Medium #1 |
| REQ-17 Rate Limiting | §8 Risks | new §7.1 | T6.1 | P2 | Medium #2 |
| REQ-18 Checkpoint | §8 Risks | §7 | T3.2 | P2 | Medium #3 |
| REQ-19 Validation | §3 Metrics | new §8.2 | T5.1 | P2 | Medium #4 |
| REQ-20 Parser Robustness | §8 Risks | §4.8 | T3.1 | P1 | High #9 |
| REQ-21 Config Docs | §7 Assumptions | §1.2, new PRD §9 | T0.1 | P2 | Medium #5 |
| REQ-22 Performance | §3 Metrics | new §9 | T6.3 | P2 | N/A |
| REQ-23 Consistency | All | All | All | P1 | N/A |

**Summary:**
- Total Requirements: 23
- P0 (Critical): 9 requirements
- P1 (High): 9 requirements  
- P2 (Medium): 5 requirements
- Estimated Effort: 1.5 days (1 day pre-implementation, 0.5 day validation)
- Target Documentation Completeness: 95% (from current 85%)

## Validation Criteria

1. All 23 requirements have been incorporated into the appropriate documentation files
2. All cross-references between documents are valid and bidirectional
3. All Groundtruth findings are operationalized in requirements, design, or tasks
4. All acceptance criteria are measurable with clear pass/fail thresholds
5. Traceability matrix is complete with no orphaned requirements or implementation tasks
6. All terminology is consistent across documents and defined in glossaries
7. All code examples compile and match documented schemas
8. Documentation completeness metric reaches 95% based on checklist coverage
