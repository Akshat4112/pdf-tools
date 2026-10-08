# PT-PD-001 — Product scope and first release

- Specification version: 1.0
- Prepared: 2026-10-08
- Status: proposed scope baseline, ready for PR review. This becomes the agreed repository baseline when merged.
- Repository: [Akshat4112/pdf-tools](https://github.com/Akshat4112/pdf-tools)
- Planned production URL: https://akshat4112.github.io/pdf-tools/
- [Project tracker](https://docs.google.com/spreadsheets/d/1m3iyaksGD-hY51JwFfIzb-JS5S3GSp0uJqS4Ae77-lg/edit)
- This task delivers a specification. It does not implement or deploy PDF tools.

## 1. Product charter

PDF Tools will be a free collection of document utilities that people can use directly in their browser. The first release will help users organize PDFs, convert pages and images, read documents, export existing text, and add simple numbering or watermarks.

The broader goal is to support most useful PDF workflows over successive releases. Reliable outputs, understandable limitations and local handling of document contents determine what ships. A tool is available only when its complete selection-to-download workflow works.

Smallpdf informs the researched feature categories and workflow patterns. PDF Tools uses its own code, copy, visual identity and assets. It must not imply affiliation or inherit another product's security certifications, quality claims or pricing.

### Users and needs

| User | Immediate need | First-release response |
| --- | --- | --- |
| Students and researchers | Combine course material, extract readings and copy available text | Merge, split, extract, reader and TXT export |
| Professionals | Prepare document attachments and organize page order | Organize, delete, rotate, image conversion and numbering |
| Privacy-conscious users | Perform everyday PDF work without uploading document contents | Browser processing, explicit file cleanup and local downloads |
| Mobile users | Complete short document tasks without installing software | Touch-friendly selection, previews, bounded processing and downloads |

The first release targets individual document work. Team administration, legal signature services, unattended bulk conversion, enterprise document management and cloud synchronization are outside R1.

## 2. Decisions established by this scope

1. R1 is a free static browser application. No accounts, paywalls, billing, backend document processing or document cloud storage.
2. R1 contains the 14 capabilities in the table below. Shared workspaces may serve several capabilities; 14 entries do not require 14 independent implementations.
3. English and German are the initial interface languages. This does not promise recognition or font shaping for every document language.
4. The planned project-site path is `/pdf-tools/`. The portfolio root and sibling projects remain separate.
5. Inputs and outputs remain in memory during a session. No document persistence or document-bearing share links.
6. Advanced capabilities have explicit later-release classes. An unproven feature stays unavailable.
7. Technical packages and their versions remain candidates until the prototype and license tasks establish a supported choice.
8. Implementation starts in later tasks. This PR establishes product decisions and traceability only.

These decisions guide implementation without treating roadmap estimates as launch dates.

## 3. R1 capability and format contract

| Feature ID | Capability | Accepted input | Result | Minimum behavior | Delivery tasks |
| --- | --- | --- | --- | --- | --- |
| PT-FT-001 | Merge PDF | Unencrypted PDFs | PDF | Combine files in selected order. Preserve supported page content; disclose or block unsupported form/bookmark preservation. | PT-CORE-001, PT-CORE-002 |
| PT-FT-002 | Split PDF | Unencrypted PDF | PDF files / ZIP | Split by ranges, every N pages or one PDF per page. Preview the output page sets. | PT-CORE-004, PT-CORE-005 |
| PT-FT-003 | Rotate PDF | Unencrypted PDF | PDF | Rotate selected or all pages by 90-degree increments, composed with existing rotation. | PT-CORE-008, PT-CORE-009 |
| PT-FT-004 | Delete pages | Unencrypted PDF | PDF | Delete selected pages in a new copy. Reject an empty result. | PT-CORE-006, PT-CORE-007 |
| PT-FT-005 | Extract pages | Unencrypted PDF | PDF | Extract selected pages in the chosen order. | PT-CORE-006, PT-CORE-007 |
| PT-FT-006 | Organize PDF | Unencrypted PDF | PDF | Reorder, rotate, duplicate and delete pages with keyboard/touch controls and undo. | PT-CORE-009 |
| PT-FT-007 | JPG/PNG to PDF | JPEG / PNG images | PDF | Choose page size, margins, fit and order. Honor image orientation and aspect ratio. | PT-CORE-010, PT-CORE-011 |
| PT-FT-008 | PDF to JPG | Unencrypted PDF | JPG files / ZIP | Render selected pages at bounded DPI/quality. This does not extract original embedded images. | PT-CORE-012, PT-CORE-013 |
| PT-FT-009 | PDF to PNG | Unencrypted PDF | PNG files / ZIP | Render selected pages at bounded DPI with an explicit background policy. | PT-CORE-012, PT-CORE-013 |
| PT-FT-010 | PDF reader | Unencrypted PDF | View / browser print | Navigate, zoom, select/search available text and print. Explain image-only pages cannot be searched yet. | PT-CORE-014 |
| PT-FT-011 | Page numbers | Unencrypted PDF + options | PDF | Add page numbers with start number, position and page selection. | PT-CORE-016 |
| PT-FT-012 | Text watermark | Unencrypted PDF + text | PDF | Add a text watermark with position, opacity and page selection. | PT-CORE-016 |
| PT-FT-013 | PDF to text | Unencrypted PDF | UTF-8 TXT | Export available page text with separators. Flag scans and reading-order limitations. | PT-CORE-015 |
| PT-FT-014 | Document information | Local PDF | Information panel | Show page count, dimensions, known metadata and available encryption/signature indicators. Detection is not trust validation. | PT-CORE-017 |

### Support boundaries

- **PDF inputs:** supported, syntactically valid, unencrypted PDFs within tested resource limits. Detect encrypted files early; reading indicators does not authorize decryption. R1 has no password-protection or unlock workflow.
- **Complex PDFs:** signatures, interactive forms, outlines, links, attachments, tags, optional-content layers and unusual page boxes require fixture coverage. Define preservation for each transform. Block unsupported operations or explain specific losses before processing. Never silently discard content.
- **Signed PDFs:** viewing is distinct from modifying. Every modifying workflow must explain that a new output can invalidate a certificate signature. A signature indicator is not certificate-chain or identity validation.
- **Images:** JPEG/JPG and PNG first. Frame selection, multi-page TIFF, HEIC and other decoders remain outside the initial format promise.
- **Text:** export text already present in the PDF. Scanned or image-only documents need later OCR. Export can reflect imperfect reading order in multi-column documents.
- **Fonts:** additions require fonts that cover the supported EN/DE text and verified embedding. Unsupported glyphs must not silently become blank or replacement characters.
- **ZIP output:** package multiple generated files with safe deterministic names. This does not mean arbitrary ZIP archives are accepted as input.
- **Limits:** byte, page, rendered-pixel, output-count and time limits are determined by PT-SP-002 and enforced by PT-FND-006. This specification does not invent numerical quotas or promise unlimited files.

## 4. First-release workflow

Each tool follows **select files → configure → preview → process → review result → download → clear or continue**.

The common workspace must:

- Offer an accessible file picker and drag/drop, with keyboard/touch alternatives.
- Show selected files and pages, validation errors, documented format support and current limits.
- Keep file names and document-provided strings as text rather than executable markup.
- Show meaningful progress and allow cancellation of long work. A cancelled or failed job cannot expose another job's data.
- Preview page order and output options before processing.
- Preserve the original input and create a separately named output.
- Verify generated outputs before reporting success, then show output names and actual byte sizes.
- Support local PDF/TXT/image downloads and ZIP downloads for multi-file results.
- Offer retry and **Clear files**. Continuing to another tool may reuse the output in the same memory-only session.
- Avoid enabled catalog entries that lead to placeholders or files that are only nominally converted.

Detailed personas, steps, recovery states and success measures belong to PT-PD-002. The full lifecycle and cleanup rules belong to PT-PD-003.

## 5. Privacy and trust boundary

R1 processes document bytes locally after selecting a file. Documents, names, extracted text, passwords, signature images, thumbnails and edits must not be sent to a server, telemetry endpoint or remote conversion service.

No document data may be stored in localStorage, IndexedDB, URLs/query strings, application logs, analytics, service-worker caches, source control or GitHub Actions artifacts. No analytics or crash-reporting service is included by default.

The initial asset policy is self-hosted application code, workers and fonts with no runtime third-party asset CDN. The page still needs network access to load application assets. Browser print and downloads are deliberate user actions; the user's browser/device controls subsequent storage.

**Clear files** removes application-held references, revokes object URLs and terminates applicable jobs. It is application cleanup, not a claim that browser memory, operating-system caches or already downloaded files are securely erased.

GitHub Pages and other hosting layers may record visitor access information. Use a verified local-document-processing claim, not an unqualified claim that no data of any kind is collected. PT-SEC-002 must inspect actual requests, storage and logging before publication.

All `akshat4112.github.io` projects share an origin. Any settings keys must be scoped to this project, and any future service worker must be limited to `/pdf-tools/`. No document persistence is introduced to compensate for cross-page navigation.

## 6. Later releases and capability classes

The feature register below accounts for every remaining entry in the current tracker.

- **Local:** intended browser implementation, still subject to correctness, preservation and resource tests.
- **Gated local:** no release commitment until the named prototype or engine gate proves functionality, licensing and compatibility.
- **Limited local:** useful conversion of a documented subset. It must not be presented as faithful conversion of arbitrary files.
- **Backend:** optional R5 scope. Requires a separate future decision about uploads, retention, providers, infrastructure and budget.

| Feature ID | Capability | Release | Class | Delivery / gate tasks |
| --- | --- | --- | --- | --- |
| PT-FT-015 | Add text/images | R2 | Local | PT-EDIT-002, PT-EDIT-004 |
| PT-FT-016 | PDF annotations | R2 | Local | PT-EDIT-003, PT-EDIT-004 |
| PT-FT-017 | Form filling | R2 | Local | PT-EDIT-005, PT-EDIT-006 |
| PT-FT-018 | Visual signature | R2 | Local | PT-EDIT-007, PT-EDIT-008 |
| PT-FT-019 | Crop PDF | R2 | Local | PT-EDIT-009 |
| PT-FT-020 | Flatten PDF | R2 | Local | PT-EDIT-012 |
| PT-FT-021 | Image watermarks/stamps | R2 | Local | PT-EDIT-011 |
| PT-FT-022 | Resize/add blank pages | R2 | Local | PT-EDIT-010 |
| PT-FT-023 | Metadata editing/removal | R2 | Local | PT-EDIT-013 |
| PT-FT-024 | Bookmarks/links | R2 | Local | PT-EDIT-014 |
| PT-FT-025 | PDF/image OCR | R3 | Gated local | PT-SP-005, PT-ADV-001, PT-ADV-002, PT-ADV-004 |
| PT-FT-026 | Searchable OCR PDF | R3 | Gated local | PT-SP-005, PT-ADV-003, PT-ADV-004 |
| PT-FT-027 | Content-preserving compression | R3 | Gated local | PT-SP-003, PT-ADV-005, PT-ADV-007 |
| PT-FT-028 | Raster compression | R3 | Local | PT-ADV-006, PT-ADV-007 |
| PT-FT-029 | Protect PDF | R3 | Gated local | PT-SP-003, PT-ADV-008, PT-ADV-010 |
| PT-FT-030 | Unlock PDF | R3 | Gated local | PT-SP-003, PT-ADV-009, PT-ADV-010 |
| PT-FT-031 | Permanent redaction | R3 | Gated local | PT-SP-004, PT-ADV-011, PT-ADV-012 |
| PT-FT-032 | Camera PDF scanning | R3 | Local | PT-ADV-013, PT-ADV-014 |
| PT-FT-033 | BMP/GIF/TIFF/WebP to PDF | R3 | Gated local | PT-ADV-015 |
| PT-FT-034 | Embedded image extraction | R3 | Gated local | PT-ADV-016 |
| PT-FT-035 | Offline app | R3 | Local | PT-ADV-017 |
| PT-FT-036 | TXT to PDF | R4 | Local | PT-CONV-001 |
| PT-FT-037 | CSV to PDF | R4 | Local | PT-CONV-002 |
| PT-FT-038 | PDF to Word | R4 | Limited local | PT-CONV-003 |
| PT-FT-039 | PDF to Excel | R4 | Limited local | PT-CONV-004 |
| PT-FT-040 | PDF to PowerPoint | R4 | Limited local | PT-CONV-005 |
| PT-FT-041 | Word to PDF | R4 | Limited local | PT-CONV-006 |
| PT-FT-042 | Excel to PDF | R4 | Limited local | PT-CONV-007 |
| PT-FT-043 | PowerPoint to PDF | R4 | Gated local | PT-CONV-008 |
| PT-FT-044 | Local HTML to PDF | R4 | Limited local | PT-CONV-009 |
| PT-FT-045 | RTF to PDF | R4 | Gated local | PT-CONV-010 |
| PT-FT-046 | ODT/ODS/ODP to PDF | R4 | Gated local | PT-CONV-010 |
| PT-FT-047 | EPUB/ZIP to PDF | R4 | Gated local | PT-CONV-011 |
| PT-FT-048 | HWP/Pages to PDF | R4 | Gated local | PT-CONV-011 |
| PT-FT-049 | Existing-text editing | R4 | Gated local | PT-SP-004, PT-CONV-012 |
| PT-FT-050 | Faithful Office to PDF | R5 | Backend | PT-EXT-006 |
| PT-FT-051 | Advanced PDF to Office | R5 | Backend | PT-EXT-007 |
| PT-FT-052 | PDF/A archival conversion | R5 | Backend | PT-EXT-008 |
| PT-FT-053 | URL webpage to PDF | R5 | Backend | PT-EXT-009 |
| PT-FT-054 | AI assistant/chat | R5 | Backend | PT-EXT-010, PT-EXT-011 |
| PT-FT-055 | AI summary | R5 | Backend | PT-EXT-012 |
| PT-FT-056 | Translate PDF text/summary | R5 | Backend | PT-EXT-012 |
| PT-FT-057 | AI question generator | R5 | Backend | PT-EXT-013 |
| PT-FT-058 | Share PDF | R5 | Backend | PT-EXT-014 |
| PT-FT-059 | Request signatures | R5 | Backend | PT-EXT-015 |
| PT-FT-060 | Certificate signing | R5 | Backend | PT-EXT-016 |
| PT-FT-061 | Drive/Dropbox integrations | R5 | Backend | PT-EXT-017 |
| PT-FT-062 | Cloud workspace/accounts | R5 | Backend | PT-EXT-018 |

### Required proofs for gated capabilities

| Capability family | Required evidence before availability |
| --- | --- |
| OCR and searchable PDFs | PT-SP-005: rasterize PDF pages before image OCR; demonstrate measured ENG/DE accuracy, Unicode text, correct word coordinates and unchanged page appearance. TXT recognition alone is not searchable-PDF support. |
| Content-preserving compression | PT-SP-003: approved browser engine and benchmark showing actual size changes with supported text/forms retained. If no reduction is possible, report that truthfully. |
| Raster compression | Explicit loss of text selection, vectors, links, forms and signatures before a user chooses it. Keep the source and label the result as image-based. |
| Encryption/unlocking | PT-SP-003: modern AES roundtrip in independent readers; a valid supplied password for unlocking; no password cracking or silent encryption bypass. |
| Permanent redaction | PT-SP-004: remove underlying text/images and sensitive ancillary data from a fresh output. Sentinels must not survive extraction, decompressed object inspection, attachments, metadata or prior revisions. A rectangle or crop is insufficient. |
| Additional image codecs and image extraction | Test decoder size limits, animation/multi-page policies, masks, colorspaces and repeated image objects. Page rendering and embedded-image extraction are separate tools. |
| Existing-text editing | PT-SP-004: actual removal/replacement of original content, supported fonts and bounded reflow. Adding text or white rectangles does not establish this capability. |
| Office, HTML and less common formats | PT-SP-006: supported-format and fidelity matrix, safe archive/parser limits, target-program readback and visible limitations. Failed format gates are deferred. |
| Offline application | PT-ADV-017: cache only approved app assets, verify the project-specific scope and update flow, and disclose what works after assets have been loaded. |
| PDF/A and certificate signing | Independent validation of the chosen archival profile or signing model. Ordinary PDF writing and visual signature placement are insufficient. |

For R4 specifically, PDF-to-DOCX is text reconstruction; PDF tables-to-XLSX requires review/correction; PDF-to-PPTX initially means slide images. Simplified DOCX/XLSX-to-PDF tools cannot claim full Office layout equivalence. PPTX, ODF, RTF, EPUB, HWP and Pages conversion are gated separately.

R5 remains optional rather than a prerequisite for R1–R4. Faithful Office rendering, remote URL capture, AI, cloud sharing, signature requests and cloud integrations use a separately approved service design. If implemented, explicit upload consent and the retention/access contract precede document transfer. Provider credentials never belong in a static frontend bundle.

A commercial SaaS or paid-service goal also requires revisiting the hosting model before adding billing.

## 7. Hosting and architecture boundary

GitHub Pages serves the static frontend at the project URL. It does not execute a conversion API, job queue, database or secret-bearing server code. GitHub Actions builds/tests/deploys application code and synthetic fixtures; it must not become a live user-document processing service.

Current repository inspection on 2026-10-08 found a private repository with a README and MIT license. Preserve that license. Hosting eligibility is still unconfirmed: PT-PD-004 verifies the account plan, Pages permissions and deployment settings. This task does not change repository visibility.

Workers, fonts, lazy bundles and eventual WASM assets must resolve under `/pdf-tools/`. Direct tool URLs, refresh, 404 behavior, asset MIME types and sibling-project isolation are PT-FND-009/PT-UX-004 acceptance requirements.

The planned React/TypeScript/Vite application uses engine adapters. PDF.js is a rendering/text-extraction candidate; pdf-lib is a page-writing/forms candidate. Do not assume that the basic writer supplies encryption, OCR, existing-page text replacement, secure redaction or faithful Office conversion.

PT-PD-006 and the spikes determine versions, dependency maintenance, licenses and advanced engine selection. The repository's MIT license does not settle compatibility or redistribution rights for every potential dependency.

## 8. R1 launch and change-control rules

R1 is complete only when all 14 scoped capabilities meet their documented acceptance criteria:

1. Each advertised tool finishes its full valid-input workflow with a verified result.
2. Page selection/order/rotation and image dimensions match the preview.
3. Independent output parsing and cross-reader checks cover the synthetic supported corpus.
4. Unsupported files, formats, encrypted inputs and resource excess have clear recoverable errors.
5. No silent content loss, incorrect downloads or misleading success messages remain.
6. Browser/device support and numerical quotas are measured and published. Primary flows work with keyboard, touch and 200% zoom.
7. Network/storage/logging audits establish the local-document-processing promise.
8. Vulnerability and dependency-license checks have no unresolved release-blocking findings.
9. EN/DE copy, privacy/help pages, project-path production smoke tests and rollback instructions are present.

Only synthetic or properly licensed public fixtures belong in tests. Real private documents must not be committed or requested in public bug reports.

PT-QA-001/PT-QA-002 provide R1 verification; PT-REL-001 documents limitations; PT-REL-002 handles release. Passing this specification's review is not evidence that these implementation gates have passed.

Changes to the R1 tool list, accepted formats, document upload/persistence model, host path or capability labels require a scoped specification PR and corresponding tracker update. Later-release work cannot silently broaden the initial privacy promise.

The 122-task backlog and its rough engineering estimates remain planning inputs. No deadline, staffing commitment, package version, numerical quota or backend budget is established here.

## 9. PT-PD-001 acceptance review

| Tracker requirement | Evidence in this document |
| --- | --- |
| Free local PDF-tools charter | Sections 1–2 |
| Target users | Section 1 user table |
| Initial formats and release boundaries | Section 3 and later-release register |
| R1 tool list | All 14 R1 Features-tab entries mapped to implementation task IDs |
| Gated features explicitly classified | Section 6, all 48 later feature entries and required-proof table |
| Intended project path | `/pdf-tools/` and planned project URL |
| Non-goals and privacy boundary | Sections 1, 5–7 |
| Review charter against Features tab | 62 unique feature IDs accounted for; task IDs checked against the current Tasks tab |

After this standalone specification PR is reviewed and merged, PT-PD-001 becomes **Done** and its dependent product tasks can be evaluated for **Ready**. The next sequential task is **PT-PD-002 — Define user journeys and success criteria**.

## 10. Sources and decision basis

The feature inventory is based on the current project tracker and the Smallpdf research recorded on 2026-09-30. Current repository metadata and hosting/library references were checked on 2026-10-08. Product choices above are our scope decisions, not claims that another site's internals or conversion quality were benchmarked.

- [Smallpdf tool inventory](https://smallpdf.com/pdf-tools): feature-category reference.
- [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages): static hosting, project paths, private-repository availability and host access logging.
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): hosting limits and commercial-use boundary.
- [pdf-lib documentation and limitations](https://github.com/Hopding/pdf-lib): basic writer capabilities and limitations.
- [Tesseract.js scope](https://github.com/naptha/tesseract.js): image OCR; PDF ingestion needs a separate rendering step.
