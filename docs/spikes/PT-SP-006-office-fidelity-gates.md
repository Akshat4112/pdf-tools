# PT-SP-006 — Browser Office conversion fidelity gate (initial evaluation protocol)

Status: **in progress — protocol only, no engine approved**. This is a bounded first slice of the existing PT-SP-006 task, not a new backlog item or a release commitment.

## Scope and constraints

The task evaluates browser-side DOCX/XLSX/PPTX parsing and PDF-to-Office reconstruction. It does **not** authorize shipping conversion tools. Follow [PT-PD-001](../product/PT-PD-001-product-scope.md) and [PT-PD-006](../architecture/PT-PD-006-dependency-decisions.md): keep all document bytes local, reject unapproved copyleft/commercial dependencies, and describe limited reconstruction as limited. Do not advertise arbitrary-file fidelity. Do not enable a tool until its particular format gate passes.

## Reproducible synthetic test matrix

Use generated documents with invented content only; keep originals and expected outputs in a deterministic, versioned corpus. Each fixture needs a source hash, expected text/cells/slides, renderer/version, and acceptance notes.

| ID | Input | Synthetic content | Essential checks |
| --- | --- | --- | --- |
| O-01 | DOCX | Latin + German umlauts, headings, paragraphs, lists | Paragraph order, Unicode, font fallback, page count and line wraps |
| O-02 | DOCX | Table with merged cells, page break, header/footer | Table geometry, pagination, headers and merged-cell fidelity |
| O-03 | DOCX | Two columns, anchored image, footnote | Reading order, anchor placement, image scaling, footnote preservation |
| O-04 | XLSX | Strings, numbers, dates, formulas, multiple sheets | Typed values, evaluated-vs-formula distinction, locale and sheet boundaries |
| O-05 | XLSX | Merged cells, charts, print areas, hidden rows | Print geometry, chart fidelity, hidden content policy, pagination |
| O-06 | PPTX | Title, text boxes, images, grouped shapes | Slide size, layering, clipping and font fallback |
| O-07 | PPTX | Chart, notes, master/theme, hyperlinks | Visual match, unsupported element warnings and link policy |
| O-08 | PDF → DOCX | Selectable text, columns, embedded fonts | Extracted text correctness; disclose layout reconstruction losses |
| O-09 | PDF → XLSX | Ruled table, multiline and merged cells | Cell review/correction, CSV/XLSX injection neutralization |
| O-10 | PDF → PPTX | Mixed vector/text slide pages | Explicit image-per-slide mode versus editable reconstruction |
| O-11 | All ZIP-based Office formats | Oversized entry, path traversal, malformed XML, extreme compression ratio | Bounded uncompressed bytes/entries/depth, reject safely; no network requests |
| O-12 | All | Empty/invalid input, cancel/retry, repeated runs | Actionable error, no stale output, worker/object-URL cleanup and no persistent document bytes |

## Gate procedure

1. **Candidate inventory:** record exact version, SPDX license and transitive dependencies; run the existing supply-chain checks before introducing a runtime dependency. Record maintenance and known advisories at evaluation time. Do not bypass the license allowlist.
2. **Input handling:** reject malformed archives, excessive expansion and unsupported external references before allocating expensive renderers. Do not fetch remote linked media, templates or fonts. Enforce existing input/time/memory budgets or document a smaller measured budget.
3. **Conversion:** run each candidate on the same synthetic corpus in Chromium, Firefox and WebKit, with local network egress blocked. Preserve raw outputs and deterministic logs only when they contain synthetic content.
4. **Independent readback:** use a second parser to inspect DOCX XML text, XLSX typed cells/formulas and PPTX slide structure; use a target-office renderer for visual comparison when available. A ZIP that merely opens is insufficient.
5. **Visual comparison:** measure page/slide count, bounding-box alignment, font substitutions, table row/column breaks, image placement and charts; record per-fixture screenshots and explicit mismatches. Do not invent numeric pass thresholds without a measured baseline.
6. **Privacy/reliability:** exercise cancellation, malformed input, repeat runs and reset; assert no document-bearing storage, telemetry, third-party fetch, leaked object URLs or workers.
7. **Decision:** classify each direction independently as *supported limited local*, *gated*, or *deferred*. Publish only documented passing subsets. No candidate receives a general “faithful Office conversion” claim based on one fixture.

## Decision table (unverified, not approvals)

| Direction | Intended first subset | Current gate |
| --- | --- | --- |
| DOCX → PDF | Plain paragraphs and simple tables | **Unverified** — benchmark and license review required |
| XLSX → PDF | Selected sheets / print areas | **Unverified** — formulas, print fidelity and charts required |
| PPTX → PDF | Simple slides | **Unverified** — shapes, fonts, themes and chart fidelity required |
| PDF → DOCX | Text reconstruction, not faithful editing | **Unverified** — reading order and layout loss must be disclosed |
| PDF → XLSX | User-reviewed table reconstruction | **Unverified** — formula-injection defenses mandatory |
| PDF → PPTX | One rasterized image per page | **Unverified** — explicitly non-editable output |

## Remaining mandatory PT-SP-006 work

Implement/generate O-01–O-12 fixtures and candidate-specific browser harnesses; record actual license/version/security evidence; run cross-browser tests and independent target-program readback; quantify fidelity and memory; document final supported-versus-deferred decisions with reproducible results. Until those checks exist, keep PT-SP-006 **In progress**, and do not change the public feature catalog.
