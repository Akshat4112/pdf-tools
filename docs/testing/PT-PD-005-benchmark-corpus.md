# PT-PD-005 — Synthetic PDF benchmark corpus

- Corpus version: 1.0
- Prepared: 2026-10-08
- Status: proposed, ready for PR review. Becomes the test-corpus baseline when merged.
- Repository: [Akshat4112/pdf-tools](https://github.com/Akshat4112/pdf-tools)
- [Project tracker](https://docs.google.com/spreadsheets/d/1m3iyaksGD-hY51JwFfIzb-JS5S3GSp0uJqS4Ae77-lg/edit)
- Depends on: PT-PD-002, PT-PD-003 (both Done)
- Consumed by: PT-SP-001…006 (spikes), PT-FND-008 (fixture harness), PT-QA-001/002 (validation)

## 1. Purpose

Every engine decision, quota measurement, and acceptance test in this project must run against **known, license-free, synthetic inputs** — never real private documents (PT-PD-003 §10). This corpus provides that baseline: 16 fixtures (14 PDFs, 2 raster images) covering the input classes the R1 tools must handle or explicitly reject.

## 2. Fixture inventory

| ID | File | Class | Purpose |
| --- | --- | --- | --- |
| F-001 | `pdf/F-001-plain-text-3p.pdf` | plain text, 3 pages | baseline merge/extract/text ops |
| F-002 | `pdf/F-002-plain-text-30p.pdf` | plain text, 30 pages, 2-column page 10 | split/organize stress + reading-order caveats |
| F-003 | `pdf/F-003-mixed-sizes.pdf` | A4 portrait/landscape, US Letter, A5 | mixed geometry handling |
| F-004 | `pdf/F-004-rotated-pages.pdf` | /Rotate 0/90/180/270 | rotation composition tests |
| F-005 | `pdf/F-005-form-acroform.pdf` | AcroForm: text field + checkbox | form preservation / blocking decisions |
| F-006 | `pdf/F-006-annotations.pdf` | highlight + link + text-note annotations | annotation preservation tests |
| F-007 | `pdf/F-007-image-page.pdf` | 1 embedded JPEG | render fidelity (PDF→JPG/PNG) |
| F-007-img | `images/F-007-photo.jpg` | JPEG 120×160 | JPG→PDF conversion input |
| F-008 | `pdf/F-008-scan-like.pdf` | image-only page, no text layer | "no searchable text" notice, TXT-export honesty, OCR gap evidence |
| F-009 | `pdf/F-009-signed-marker.pdf` | visual signature block (not cryptographic) | signature-warning copy test; info-panel language test |
| F-010 | `pdf/F-010-encrypted-aes256.pdf` | AES-256, user pw `synthetic-password-2026` | early encrypted-input rejection (E-INPUT-02) |
| F-011 | `pdf/F-011-malformed-truncated.pdf` | truncated at 45% of F-001 | unparsable-input recovery (E-INPUT-03) |
| F-012 | `pdf/F-012-empty.pdf` | zero bytes | empty-input handling |
| F-013-img | `images/F-013-diagram.png` | PNG 300×200 | PNG→PDF conversion input |
| F-014 | `pdf/F-014-outline.pdf` | 6 pages, 5 outline/bookmark entries | bookmark preservation question on merge/split |
| F-015 | `pdf/F-015-pages-60p.pdf` | plain text, 60 pages | split-every-N, quota boundary tests |

`fixtures/manifest.json` is the machine-readable contract: per fixture — sha256, byte size, purpose, and **expected** properties (page count, text markers like `PACKING-BOX-0007`, rotations, form fields, encryption, outline entries) that downstream validators assert against.

## 3. Generation and licensing

- Generator: `scripts/generate_fixtures.py` — PyMuPDF 1.28.0, deterministic (seeded RNG, fixed Base-14 fonts, ASCII/EN text). Rerunning produces equivalent structure; committed binaries are the canonical reference (sha256-pinned in the manifest).
- All text content is synthetic, written for this project, and free of any third-party or personal content. Fonts are PDF Base-14 (helvetica/times/courier) — standard, non-embedded, no license question. No real private document was used, generated from, or committed (PT-PD-003 §10 rule).
- The F-010 password is intentionally synthetic and public within the corpus.

## 4. Dual-reader validation (acceptance requirement)

Acceptance: *"Validate fixtures with two independent readers."* Implemented in `scripts/validate_corpus.py`:

- **Reader A — PyMuPDF:** structural parse; asserts page counts, text markers, rotations, page sizes, form-field names, encryption flag, absence of text layer (F-008), outline depth/count, embedded image counts, annotation types, link counts.
- **Reader B — qpdf** (`qpdf --check`): independent syntax/structure validation of every positive PDF; for F-010 additionally verifies the supplied password opens it. Negative fixtures (F-011, F-012) must be **rejected by both readers** (qpdf hard-fails; PyMuPDF either errors or opens in repair mode with a broken page tree — both treated as correctly invalid).

Result on 2026-10-08: **all 16 fixtures pass both readers** (validation output archived in PR). Re-run anytime: `python3 scripts/validate_corpus.py` (exit 0 = pass).

Known fixture nuance: F-011 opens in PyMuPDF's repair mode (`is_repaired=True`) — this is expected behavior for truncated streams and is itself useful evidence that "parses with repair" ≠ "valid document": tools must not silently process a repaired file as if intact.

## 5. Manifest identifies expected outputs

Per the acceptance criteria, the manifest records for each fixture what correct behavior looks like:

- Expected page counts and per-page text markers (unique `PACKING-BOX-NNNN` strings) — merge/split/extract/numbering outputs must contain exactly these.
- Expected form fields, annotations, rotations, sizes — preservation tests compare post-transform state against these.
- Expected failure classes for negative fixtures (E-INPUT-02 for F-010, E-INPUT-03 for F-011/F-012) — matching PT-PD-002 §5 taxonomy; §6 of PT-PD-002 requires per-class fixture coverage and this corpus supplies it.
- F-008 drives the "no text layer" notices required by PT-FT-010 (reader) and PT-FT-013 (TXT export).

## 6. Corpus limits (honest scope)

- No real certificate-signed PDF (signing toolchain out of scope); F-009 covers indicator language only, and document-info must never claim a cryptographic signature from it.
- No HEIC/TIFF/WebP (R1 accepts JPEG/PNG only — matches scope).
- No multi-embedded-image or image-mask stress fixture yet; PT-SP-001 findings may append an F-016+ generation PR rather than reopening this task.
- Corpus is deliberately small (≈1.6 MB total, dominated by F-008's raster page). Memory/limit measurements in PT-SP-002 will generate larger synthetic stress files at run time; those are not part of this committed corpus.

## 7. PT-PD-005 acceptance review

| Tracker requirement | Evidence |
| --- | --- |
| Licensed synthetic text, scan, forms, fonts, rotations, mixed sizes, annotations, signed, encrypted and malformed cases | §2 table: F-001/002 (text), F-008 (scan-like), F-005 (forms), F-003/004 (sizes/rotations), F-006 (annotations), F-009 (signed-marker), F-010 (encrypted AES-256), F-011/012 (malformed/empty), F-007/013 (image inputs) |
| Manifest identifies expected pages, text, forms and visual outputs | §5 + `fixtures/manifest.json` (sha256, page counts, markers, field names, rotations, outline, failure classes) |
| No real private documents | §3 licensing statement; content fully synthetic |
| Validate fixtures with two independent readers | §4: PyMuPDF + qpdf, `scripts/validate_corpus.py`, passed 2026-10-08 |

After merge, PT-PD-005 is **Done**, unblocking PT-SP-001, PT-SP-006, PT-FND-008 and (with PT-PD-004) PT-PD-006.
