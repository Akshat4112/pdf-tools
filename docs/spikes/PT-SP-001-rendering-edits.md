# PT-SP-001 — Rendering and core PDF edits spike report

- Spike version: 1.0
- Executed: 2026-10-08 (Node 22.23.1, macOS; deterministic, re-runnable)
- Status: proposed, ready for PR review
- Repository: [Akshat4112/pdf-tools](https://github.com/Akshat4112/pdf-tools)
- [Project tracker](https://docs.google.com/spreadsheets/d/1m3iyaksGD-hY51JwFfIzb-JS5S3GSp0uJqS4Ae77-lg/edit)
- Depends on: PT-PD-005 ✓ (corpus), PT-PD-006 ✓ (approved engines)
- Harness: `spike/pt-sp-001/spike.mjs` — 25 checks against 9 corpus fixtures; outputs in `spike/pt-sp-001/out/` (gitignored); machine-readable `report.json`

## 1. Verdict

**PASS — the approved core stack (pdfjs-dist 6.4.299 + pdf-lib 1.17.1) performs every R1 engine primitive on the benchmark corpus.** 25/25 checks green (run output in PR). pdf-lib's dormancy condition from PT-PD-006 §2.1 is **not triggered**: no unfixable defect was found; one real API bug was found and has a trivial, safe workaround (§2.2) that becomes a coding rule.

## 2. Findings (all real, from execution)

### 2.1 pdf.js 6.x API notes (implementation rules for PT-FND-005)

1. **Destroy lives on the loading task**: `getDocument().promise` yields a doc with `cleanup()` but **no `destroy()`**; lifecycle teardown must keep the `loadingTask` and call `loadingTask.destroy()` (matters for PT-PD-003 worker lifecycle).
2. **`standardFontDataUrl` is mandatory** for text extraction on documents using non-embedded standard fonts — must point at self-hosted `standard_fonts/` under `/pdf-tools/` (no CDN, per PT-PD-001 §5). Suppression: pass `useSystemFonts: false` on Node; in the browser the param still applies.
3. **Encrypted inputs reject cleanly** (`PasswordException`) → maps to taxonomy **E-INPUT-02**; malformed truncated file **throws** → **E-INPUT-03**; scan-like page yields **zero-length text** → drives the "no searchable text" notice for Reader/TXT (PT-FT-010/013).
4. **Rotation readback works** (`page.rotate`) — organize/rotate preview can trust it.
5. Rendering with the bundled `@napi-rs/canvas` (Node stand-in for browser canvas) produced a correct 1190×1684 PNG (22 KB) of the image-bearing page — the same `page.render` call pattern the browser will use.

### 2.2 pdf-lib 1.17.1 JpegEmbedder bug (byteOffset) — REAL DEFECT, WORKAROUND RULE

`JpegEmbedder.for()` reads via `new DataView(imageData.buffer)` **ignoring `byteOffset`**. A Node `Buffer` inside a pooled ArrayBuffer (observed byteOffset=376) fails with `SOI not found in JPEG` on a perfectly valid JPEG. The progressive-JPEG fixture (F-007-img, JFIF, 755 B) reproduced it deterministically.

**Browser impact: none** — `File.arrayBuffer()` / `Blob` reads always produce offset-0 buffers. **Node/worker impact: real** — any subarray/pooled view breaks.

**Rule for the app (goes into PT-FND-002/005 acceptance):** every byte sequence passed to pdf-lib (`PDFDocument.load`, `embedJpg`, `embedPng`) must be normalized to an offset-0 `Uint8Array` (copy via `u8.set(src)`). Implemented in the spike as `toU8()`/`pdfLibLoad()` and verified: embed + all transforms then pass.

### 2.3 Core-edit proofs (pdf-lib on corpus)

| Primitive | Fixture | Result |
| --- | --- | --- |
| Merge | F-001 + F-002 | 33 pages; markers across the file boundary verified via pdf.js re-parse (page 4 = F-002 p1) ✓ |
| Split (ranges) | F-002 → 1-5 / 8 / 12-30 | 5 / 1 / 19 pages ✓ |
| Rotate (+compose with existing /Rotate) | F-001 (+90), F-004 p2 (90+180→270) | readback `[90,90,90]`, `270` ✓ |
| Delete pages | F-002 remove p1 | 29 pages ✓ |
| Extract custom order | F-002 pages 30,1,6 | order verified by markers ✓ |
| Images→PDF (JPG+PNG embed) | F-007-img, F-013-img | 1 page, both images ✓ |
| AcroForm field parse | F-005 | `fullname:PDFTextField`, `subscribe:PDFCheckBox` (R2 fill will extend this) ✓ |
| Encrypted rejection | F-010 | throws `Input document to PDFDocument.load is encrypted` → E-INPUT-02 ✓ |
| Text draw (numbering/watermark path) | synthetic | Helvetica + opacity + 45° rotate render; text extractable by pdf.js ✓ |

**Annotation preservation on merge:** copying F-006's page into a new document preserved **4 annotations (Highlight, Link, Text, Popup)** — page-level annotation loss is *not* an issue for merge/extract of whole pages. Outline (bookmarks) on F-014 is a document-level structure that whole-page merge does **not** reconstruct into a combined outline; per PT-PD-001 §3 this gets the disclose-or-block treatment in tool copy (documented limitation, not silent loss).

### 2.4 Cross-reader verification (tracker requirement)

Every spike output was verified by **three independent readers**:
1. **pdf.js re-parse** (the engine that ships in the browser) — page counts, rotation readback, text markers, annotation survival.
2. **qpdf `--check`** — structural validation: all 10 output PDFs pass.
3. Generation-side assertions (pdf-lib API semantics) during the transforms.

Outputs also re-validated by the corpus validator's reader semantics: no output claimed success without a verified re-parse.

## 3. Incompatibilities and limitations recorded (honest list)

1. pdf-lib has **no page-content stream editing** — "existing text editing" stays gated R4 (PT-SP-004), as scoped.
2. **Document-level structures** (outlines, named destinations) are not merged into a new outline by whole-page copy; merge/organize will disclose "bookmarks are not combined" rather than silently dropping (fixture F-014 covers this).
3. **pdf.js `getDocument` in a worker** still needs a canvas for rendering in browser (Node used @napi-rs/canvas); the browser build will rely on `OffscreenCanvas` — PT-SP-002 measures the memory cost of that path on large pages.
4. **pdf-lib dormancy**: unchanged posture — approved with @cantoo/pdf-lib fallback if a future corpus case fails; the byteOffset bug is worked around, not fixed upstream.
5. pdf.js warnings (`standardFontDataUrl`) are noise in Node but confirm the self-hosted-fonts deployment requirement.

## 4. Engine decision confirmation

PT-PD-006 approved the stack *conditionally on this spike*. Conditions resolved:
- pdfjs-dist **6.4.299**: confirmed for render/text/reader/txt/image-export paths.
- pdf-lib **1.17.1**: confirmed for merge/split/rotate/delete/extract/organize/images→PDF/numbering/watermark with the **offset-0 normalization rule** added to the foundation acceptance criteria (PT-FND-002/005).
- `@zip.js/zip.js` / `fflate`: not exercised here (no multi-file output in this spike's scope) — exercised first by PT-FND-007 output packaging; no change to their approval.

## 5. Reproduction

```bash
cd spike/pt-sp-001
npm ci            # pinned: pdfjs-dist@6.4.299, pdf-lib@1.17.1, @napi-rs/canvas (transitive)
node spike.mjs    # 25/25 PASS expected; writes report.json + out/*
```

## 6. PT-SP-001 acceptance review

| Tracker requirement | Evidence |
| --- | --- |
| Prototype PDF.js rendering/text extraction plus pdf-lib merge, split, rotate and forms on benchmark files | §2.1–2.3: 25 checks over 9 fixtures incl. rendering, extraction, all four edit families, AcroForm parse |
| Reloaded output has expected order, text and appearance | §2.3 table: order-by-marker verification, rotation readback, content preservation across merge boundary |
| Incompatibilities recorded | §3 (content-stream editing, outline merge limitation, worker canvas path, byteOffset bug + rule) |
| Cross-reader compare and structural inspection | §2.4: pdf.js re-parse + qpdf --check (10/10 outputs) + generation-side asserts |

After merge, PT-SP-001 is **Done**, unblocking PT-SP-002, PT-FND-001, PT-FND-005 (renderer utilities) and the core engine chain.
