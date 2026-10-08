# PT-PD-002 — User journeys and success criteria

- Specification version: 1.0
- Prepared: 2026-10-08
- Status: proposed, ready for PR review. Becomes the user-journey baseline when merged.
- Repository: [Akshat4112/pdf-tools](https://github.com/Akshat4112/pdf-tools)
- Planned production URL: https://akshat4112.github.io/pdf-tools/
- [Project tracker](https://docs.google.com/spreadsheets/d/1m3iyaksGD-hY51JwFfIzb-JS5S3GSp0uJqS4Ae77-lg/edit)
- Depends on: PT-PD-001 (merged, PR #1)
- This task delivers a specification. It does not implement or deploy PDF tools.

## 1. Purpose

PT-PD-001 established the R1 scope: 14 capabilities, a common workflow (select files → configure → preview → process → review result → download → clear or continue), and a privacy boundary. This document defines, for every R1 capability:

1. The primary user journeys per persona, with concrete entry points and outcomes.
2. The step-level flow states for the shared workspace (entry, configuration, preview, processing, result, failure, reset).
3. Actionable failure and recovery states — every visible state must tell the user what happened, why, and what to do next.
4. Measurable success criteria per journey, usable later as acceptance evidence in PT-QA-001/PT-QA-002.

## 2. Personas

The four personas from PT-PD-001, restated as journey actors:

| Persona | Context | Primary tools | Defining constraint |
| --- | --- | --- | --- |
| **Sara, student** | Semester readings, lecture slides, scanned notes | Merge, Split, Extract, Reader, PDF→TXT | Low tolerance for signup; often on a laptop with many tabs open |
| **Priya, office professional** | Contract packets, reports, client attachments | Organize, Delete, Rotate, Images→PDF, PDF→Images, Page numbers | Needs predictable, explainable results; may repeat the same task weekly |
| **Paul, privacy-conscious user** | Documents with personal or financial content | All 14 tools; privacy claim is the selection reason | Will verify no upload occurs; abandons the tool if trust copy is unclear |
| **Mia, mobile user** | Quick tasks from email/WhatsApp downloads on a phone | Merge, Images→PDF, PDF→Images, Reader | Small viewport, touch-only, limited memory/patience; sessions are short |

## 3. Shared workspace journey (all tools)

Every tool page follows the same state machine. States are visible, named, and testable.

| State | What the user sees | Success criterion (testable) |
| --- | --- | --- |
| **S1 Entry** | Tool title, one-line purpose, accepted formats, current limits, privacy statement ("your file never leaves this browser"), accessible file picker + drag/drop target | Picker is keyboard reachable; drop target announces itself to screen readers; limits text is present on the page |
| **S2 Selection** | Selected file chips with name, type, size, page count (once parsed); remove buttons; add-more control; validation errors inline | Invalid files are marked with reason and a Remove action; no page blocks on a single bad file |
| **S3 Configuration** | Tool options (ranges, order, DPI, positions, margins); live preview where applicable | Every option has a label, a default, and an accessible description; changing an option never discards prior selection |
| **S4 Preview** | Page thumbnails/order representation; for destructive tools, an explicit "resulting document will contain N pages" statement | Preview matches actual output page set (verified by PT-QA-001); preview generation is cancellable |
| **S5 Processing** | Deterministic progress (pages done / total), cancel button; no navigation-away data loss warnings needed because work runs locally | Progress reaches 100% or a recoverable error; cancel returns to S3 without partial files left in the result area |
| **S6 Result** | Output file name, type, actual byte size, page/preview where relevant; Download button; "Start over" (Clear files) and "Continue to another tool" where output is a valid input | Byte size shown is the actual downloaded size (±0); success message never claims more than was verified |
| **S7 Failure** | Specific error class from a defined taxonomy (see §5), what the app did (nothing processed / partial?), and the next action | Every failure names a recovery action that exists (retry, re-select, reduce size, use desktop); no dead ends |
| **S8 Reset** | "Clear files" removes chips, revokes object URLs, cancels jobs; page returns to S1 | After reset, no file names remain in the DOM, no object URLs remain active, and devtools shows no residual references |

Journey-level rule: **S1→S6 must complete without a page reload for every tool**, and **no state transition may ever require re-uploading a file the app already holds.**

## 4. Per-tool journeys

Each tool below lists: primary journey (happy path), the persona it most serves, expected outcome, and tool-specific failure states beyond the shared taxonomy.

### PT-FT-001 Merge PDF
- **Primary journey (Sara):** open tool → select 4 lecture PDFs → drag to set order [ch1, ch2, ch3, ch4] → preview shows 4 sections with per-file page counts → Merge → download `merged.pdf` → open in reader: page order and count match preview.
- **Success criteria:** output page count = sum of input page counts; per-input page order preserved; text remains selectable in the merged output (for text PDFs); file names in result are input-derived and collision-safe.
- **Failure states:** mixed encrypted+unencrypted inputs → per-file marking, encrypted file identified, unencrypted files still selectable for a partial merge or the whole job is blocked with clear reason (decision recorded at implementation; either way the message is specific); a file that fails parsing mid-merge → error names the file and page, prior files' chips remain for retry.

### PT-FT-002 Split PDF
- **Primary journey (Sara):** select one 30-page reading → choose mode: ranges (1-5, 8, 12-30) / every N pages / one per page → preview shows resulting file list with page counts and names → Split → download ZIP (or single PDF if exactly one output).
- **Success criteria:** output set covers exactly the requested pages; ZIP contains safe deterministic names (`split-1-5.pdf` style); a range referring to a page beyond the document is rejected at configure time, not at process time.
- **Failure states:** no valid range selected → Split disabled with inline reason; ZIP packaging failure → single-file fallback offered where output count is 1; over-limit output count (per PT-SP-002 quota) → specific limit message with suggestion (e.g. "split into fewer, larger parts").

### PT-FT-003 Rotate PDF
- **Primary journey (Priya):** select scanned landscape report → pick pages (all / selection) → rotate 90° CW → preview thumbnails update rotation → Rotate → download; opening the output shows rotated pages, other pages untouched.
- **Success criteria:** rotation composes with existing page rotation (a page already at 90° becoming 180°, verified by PT-QA-001 fixture); non-selected pages byte-identical in appearance; output opens in two independent readers.
- **Failure states:** selecting zero pages → action blocked with reason; corrupted page tree → specific error, original file untouched.

### PT-FT-004 Delete pages
- **Primary journey (Priya):** select 12-page contract → check pages 2, 11 → preview states "resulting document will contain 10 pages" → Delete → download 10-page PDF.
- **Success criteria:** deletion cannot produce an empty document (blocked with explicit message if all pages selected); remaining pages preserve content and order; the original input is never modified in place.
- **Failure states:** all pages selected → "cannot delete every page" with option to re-select; encrypted input → early rejection at S2 with the encrypted-file explanation.

### PT-FT-005 Extract pages
- **Primary journey (Sara):** select 100-page reader → ranges 3-7 → preview shows the extracted page set in chosen order → Extract → download 5-page PDF.
- **Success criteria:** extracted pages keep orientation, content, and page-level properties; custom order (e.g. 7, 3-6) is honored; output is a fresh valid PDF, not a link to the original.
- **Failure states:** empty selection → blocked with reason; extraction exceeding quota → quota message with actionable suggestion.

### PT-FT-006 Organize PDF
- **Primary journey (Priya):** select deck → grid of page thumbnails → drag page 4 to position 1, rotate page 7, duplicate page 2, delete last page → undo the delete → Apply → download reordered PDF matching final grid.
- **Success criteria:** every grid action (move, rotate, duplicate, delete) is available by pointer and keyboard; undo history covers all four action types; final output page set equals final grid exactly (count, order, rotations).
- **Failure states:** keyboard-only reordering must work (arrow-based move control with announced position); cancellation mid-apply → grid state preserved, no partial download offered.

### PT-FT-007 JPG/PNG to PDF
- **Primary journey (Mia):** pick 6 photos from phone → drag order → choose page size A4, margin none, fit contain → preview first-page render → Create → download one PDF.
- **Success criteria:** image orientation (EXIF) honored without manual rotation; aspect ratio preserved (letterboxing shown in preview when fit mode implies it); page order matches the image list; output opens in two readers.
- **Failure states:** non-JPEG/PNG file (e.g. HEIC) → rejected at selection with "format not supported yet — convert to JPG/PNG first"; single image > size quota → quota message naming the limit.

### PT-FT-008 PDF to JPG
- **Primary journey (Mia):** select 3-page flyer PDF → select all pages → DPI 150, quality 80% → preview of page 1 render → Convert → download ZIP of 3 JPGs.
- **Success criteria:** rendered dimensions match the requested DPI within tolerance; output count equals selected page count; JPG files open in a standard image viewer; ZIP names derive from input name + page number.
- **Failure states:** DPI choice that would exceed the pixel quota → warning at configure time with the maximum permitted DPI suggested; image-only or broken page render → specific page named, other pages still exportable.

### PT-FT-009 PDF to PNG
- **Primary journey (Priya):** select chart PDF → DPI 200, background white → Convert → download PNG.
- **Success criteria:** transparent-PDF pages render with the explicitly chosen background (transparent vs. white is a visible, defaulted choice); PNG opens in a standard viewer; per-page success identical to PT-FT-008.
- **Failure states:** same as PT-FT-008, plus background policy is never silently applied — the choice is visible in the UI.

### PT-FT-010 PDF reader
- **Primary journey (Sara):** open reader → select lecture PDF → page navigation (prev/next, jump-to), zoom 50–400%, text search listing matches with click-to-jump, select and copy text → browser print → close.
- **Success criteria:** navigation and zoom work by keyboard and touch; search finds all text-layer matches on the fixture corpus; copying yields the same characters PT-FT-013 would export; image-only pages produce a visible "this page has no searchable text" notice, not silence.
- **Failure states:** encrypted file → early rejection with explanation; a page that fails to render → reader stays usable, page shows an in-page error card, adjacent pages remain navigable.

### PT-FT-011 Page numbers
- **Primary journey (Priya):** select report → options: start at 1, position bottom-center, apply to all pages → preview of first page shows placement → Apply → download.
- **Success criteria:** numbering matches start number and selection exactly; placement matches preview; number styling does not overlap content on the fixture corpus (misplacement on unusual page boxes is a documented limitation, not a silent failure); font renders digits in EN/DE contexts.
- **Failure states:** zero pages selected → blocked; range errors → same taxonomy as split.

### PT-FT-012 Text watermark
- **Primary journey (Paul):** select draft → text "CONFIDENTIAL", opacity 40%, position diagonal-center, all pages → preview → Apply → download; opens in a reader with the watermark visible and text still selectable underneath.
- **Success criteria:** opacity and position match configuration; watermark does not destroy existing text selection; per-page selection honored.
- **Failure states:** empty watermark text → blocked at configure time; glyphs outside the supported EN/DE set → warning that rendering may be incomplete, with the choice to continue or edit the text (never silent tofu).

### PT-FT-013 PDF to text
- **Primary journey (Sara):** select paper → Convert → download `.txt` → open in an editor: readable text with page separators.
- **Success criteria:** exported text equals the PDF's available text layer (fixture-verified); page separators are stable and documented (`\f` or labeled separators); a scan-only document produces an explicit "no text layer found — OCR comes in a later release" notice rather than an empty file.
- **Failure states:** partial text on some pages → those pages export available text and the result notes the pages lacking a text layer; multi-column reading-order caveats are disclosed on the page, not hidden.

### PT-FT-014 Document information
- **Primary journey (Paul):** select any local PDF → panel shows page count, page dimensions, producer/creator, title/author when present, encryption indicator, signature indicator with plain-language meaning.
- **Success criteria:** displayed metadata matches what two independent readers show for the fixture corpus; encryption/signature indicators use careful language ("indicator — not validation"); no modification is possible from this view.
- **Failure states:** unreadable/broken file → the panel reports "document could not be parsed" with the reason class; missing optional metadata shows "not present", not blank rows.

## 5. Failure taxonomy (shared)

Every error surfaced in S7 maps to one class; each class has a mandatory recovery action in the UI. Implementation may extend, never bypass, this taxonomy (PT-FND-006 builds the typed structure).

| Code | Class | User-facing meaning (plain language) | Required recovery affordance |
| --- | --- | --- | --- |
| E-INPUT-01 | Unsupported format | "This file type isn't supported by this tool yet." | Link to accepted formats; suggest conversion path |
| E-INPUT-02 | Encrypted document | "This PDF is password-protected. Unlocking is not available in this release." | Explain scope; keep other selected files usable |
| E-INPUT-03 | Corrupted / unparsable | "This file couldn't be read as a PDF." | Retry / re-save suggestion; remove the bad file |
| E-INPUT-04 | Over limit | "This file exceeds the current limit (N MB / N pages)." | Show measured limit; suggest page/size reduction tools |
| E-INPUT-05 | Empty selection | "Select at least one file or page to continue." | Focus the picker |
| E-CONFIG-01 | Invalid configuration | "Range '5' isn't valid for a 3-page document." | Field-level error; keep valid fields |
| E-PROC-01 | Processing failure | "Processing stopped on page 7 of 30." | Retry; partial results never presented as success |
| E-PROC-02 | Out of memory / quota | "Your browser ran out of memory for this job." | Suggest smaller ranges or fewer pages (mobile: use desktop) |
| E-OUT-01 | Output verification failed | "The generated file didn't pass our checks, so we're not offering it." | Retry; explicit honesty rule — no unverified download |
| E-OUT-02 | Download failure | "The download couldn't be started." | Retry download (no reprocessing needed) |
| E-SYS-01 | Worker/tech unavailable | "This browser can't run this tool (workers/WASM unavailable)." | Suggest a supported browser; tool entry hidden or disabled with reason |

Honesty rules: **no success message without verified output** (E-OUT-01 enforces this), **no generic "something went wrong"** — every error carries a class, and **no failure may leave a stale partial download link**.

## 6. Cross-tool success measures (baseline metrics)

These are the numbers PT-QA-002 will measure; PT-PD-002 sets the targets:

| Measure | Target (R1) |
| --- | --- |
| Journey completion (S1→S6) on fixture corpus | 100% of valid-input journeys complete |
| Failure-state coverage | Every taxonomy class has at least one fixture-triggered case per applicable tool |
| Keyboard-only journey completion | ≥ primary journey of every tool completable without pointer |
| Touch journey (400px viewport) | Merge, Images→PDF, PDF→Images, Reader complete on touch |
| 200% zoom | No journey blocked; no loss of critical controls |
| Preview/output fidelity | Preview page sets match outputs on 100% of fixture cases (PT-QA-001 evidence) |
| Reset cleanliness | Zero residual references after S8 on sampled tools (PT-SEC-002 audit) |
| Perceived progress | Every processing state shows deterministic progress and a cancel affordance |

## 7. Out of scope for this document

- Visual design, layout, and branding (PT-UX-001).
- Data lifecycle mechanics beyond journey-level reset behavior (PT-PD-003 owns the full lifecycle).
- Numerical quotas (PT-SP-002 measures; the UI displays measured values).
- The 48 later-release features: their journeys are defined in their own release-scope tasks; this document covers the 14 R1 capabilities only.

## 8. PT-PD-002 acceptance review

| Tracker requirement | Evidence in this document |
| --- | --- |
| Map student, office and privacy-conscious use cases | §2 personas; §4 primary journeys per tool with persona attribution |
| Define select, configure, preview, process, download and reset flows | §3 shared state machine S1–S8, mandatory for every tool |
| Every launch tool has a complete journey | §4 covers all 14 R1 capabilities (PT-FT-001…014) |
| Actionable failure state | §5 taxonomy with mandatory recovery affordances; §6 requires per-class fixture coverage |
| Walk through merge, split and image conversion journeys | §4 PT-FT-001, PT-FT-002, PT-FT-007/008 journeys are step-complete with success criteria and failure states |

After this standalone specification PR is reviewed and merged, PT-PD-002 becomes **Done**, unblocking PT-PD-005 (with PT-PD-003) and PT-UX-001 later in the chain.
