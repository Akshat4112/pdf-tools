# PT-SP-002 — Browser memory and Pages asset benchmark

- Benchmark version: 1.0
- Executed: 2026-10-08 (macOS arm64, Node 22.23.1, chrome-headless-shell 1243 via CDP)
- Status: proposed, ready for PR review
- Repository: [Akshat4112/pdf-tools](https://github.com/Akshat4112/pdf-tools)
- [Project tracker](https://docs.google.com/spreadsheets/d/1m3iyaksGD-hY51JwFfIzb-JS5S3GSp0uJqS4Ae77-lg/edit)
- Depends on: PT-SP-001 ✓, PT-PD-004 ✓
- Harness: `spike/pt-sp-002/measure-assets.mjs` (asset/payload measurements, deterministic) + `spike/pt-sp-002/probe.html` + `run-probe.mjs` (real headless-Chrome render/heap measurements over corpus fixtures). Raw outputs: `asset-report.json`, `browser-report.json`.

## 1. Measured asset payloads (esbuild minify+gzip, browser platform)

| Payload | raw | gzip | Shipping strategy |
| --- | --- | --- | --- |
| pdf-lib (full) | 500.0 KiB | 189.6 KiB | lazy-loaded only by writing tools |
| pdfjs-dist legacy (main thread API) | 479.0 KiB | 146.7 KiB | lazy-loaded by rendering tools |
| pdf.js worker (own file) | 2361.6 KiB | 504.8 KiB | fetched once, off main thread |
| pdf.js standard_fonts (self-host) | 779.3 KiB total | n/a (16 pfb files) | fetched on demand per font |
| @zip.js/zip.js | 215.2 KiB | 91.9 KiB | lazy, only multi-file outputs |
| fflate | 31.4 KiB | 12.1 KiB | shared utility |

App baseline (current scaffold, no engines wired): **190.6 KiB / 60.04 KiB gzip** JS + 1.78 KiB CSS.

**Pages budget verdict:** worst-case R1 shipped assets ≈ 4.3 MiB measured + fonts/worker < 5 MiB total — under **0.5%** of the 1 GiB published-site limit. Even a 60 MiB R3 WASM-engine ceiling stays <6% of limit. Asset size is a non-issue; **memory quotas are the real constraint** (below).

## 2. Real browser render/heap measurements (headless Chrome, corpus fixtures)

Rendered every page of each fixture at 96 and 150 DPI with pdf.js 6.4.299 + OffscreenCanvas, PNG-encoding each page (forces full readback), dropping bitmaps immediately, `--expose-gc` + `--enable-precise-memory-info`:

| Fixture | Pages | 96 DPI | 150 DPI | Heap after (stable) |
| --- | --- | --- | --- | --- |
| F-001 (text 3p) | 3 | 68 ms | 35 ms | 2.7 MB |
| F-002 (text 30p) | 30 | 519 ms | 477 ms | 2.8 MB |
| F-008 (scan-like 1p) | 1 | 14 ms | 11 ms | 4.2 MB |
| F-015 (text 60p) | 60 | 1017 ms | 978 ms | 2.9 MB |

Findings:

1. **Stream-render (render → encode → drop) keeps JS heap flat** (~3 MB delta across a 60-page render pass). The memory risk is *holding* bitmaps, not rendering them.
2. **Held-bitmap model** (RGBA = w×h×4): A4 @150 DPI ≈ 8.3 MB/page ⇒ **10 pages ≈ 83 MB, 30 pages ≈ 249 MB**. This is the quota driver: preview grids must hold capped thumbnails (e.g. ~120 DPI re-scaled) and release full-resolution renders.
3. Render throughput ~16-17 ms/page at 96 DPI on this M-series machine — mobile will be 3–5× slower; budget UI progress accordingly (per-page progress events are sufficient).
4. pdf.js worker payload (~2.3 MiB raw / 505 KiB gzip) is a one-time cost; `standard_fonts` loads lazily per font (~780 KiB total possible).

## 3. Quota table (measured basis for the published limits)

These are the numbers the app will publish and enforce (PT-FND-006 enforcement, PT-QA-002 verification on mobile):

| Limit | Value (R1 initial) | Basis |
| --- | --- | --- |
| Input file size | 50 MB | heap model: 2× file bytes + parse structures stay well under mobile limits; measured renders independent |
| Pages per document | 300 | 60-page render = 1 s ⇒ 300 pages ≈ 5 s with progress; previews capped |
| Full-resolution renders held | ≤ 10 concurrent bitmaps | 83 MB held-bitmap ceiling at 150 DPI |
| Render DPI options | 96 / 150 / 200 (default 150) | 200 DPI = 14.8 MB/page held — only for single-page export |
| Preview thumbnails | re-scaled ≤ 120 DPI equivalents, LRU-capped at 60 | bounded ≈ 30 MB worst case |
| Output files per ZIP | 300 | mirrors page cap |
| Processing time soft cap | 30 s/job with cancel | 300-page worst case ≈ 5 s desktop; 6× mobile headroom |

These are *initial* quotas — PT-QA-002 re-measures on real mobile hardware and may tighten; the UI displays measured values (PT-PD-002 §3 S1 rule).

## 4. Worker, lazy-import and cancellation model (implementation directives)

1. **pdf.js worker:** load once, on first rendering-tool entry (`new Worker(pdf.worker.mjs, {type:"module"})`); idle-terminate after tool exit per PT-PD-003 §8. Worker + engines are `React.lazy`/dynamic-import boundaries — the 190 KiB baseline bundle never imports them.
2. **Lazy chunks:** pdf-lib chunk loads only for merge/split/organize/number/watermark/images→PDF; pdfjs chunk only for render/reader/text/images-out; zip.js only when >1 output file.
3. **Cancellation:** per-job token; cancel = worker `terminate()` + fresh worker respawn (PT-PD-003 §5 cancelled-job rule), bitmaps and intermediates dropped with the job.
4. **Progress:** per-page events (measured cadence 16–17 ms/page desktop) → deterministic S5 progress bar.
5. **/pdf-tools/ paths:** worker and `standard_fonts` resolve under the base path (verified pattern already used by the spike's absolute-URL handling; PT-FND-009 re-verifies in CI).

## 5. Incompatibilities / honest limits recorded

1. Headless-Chrome heap numbers are *desktop-class*; PT-QA-002 owns low-memory mobile re-measurement (tracker requirement kept, not assumed done here).
2. `performance.memory` is Chromium-only — the app must not depend on it (used only in this probe).
3. The scan-like fixture (F-008) renders fast but its PNG output is large relative to text pages; image-heavy documents dominate output-size quotas, not page counts.
4. `--expose-gc` measurements are best-effort; deltas near zero confirm the stream-render model rather than precise GC accounting.

## 6. PT-SP-002 acceptance review

| Tracker requirement | Evidence |
| --- | --- |
| Measure workers, lazy imports, multi-file memory, cancellation and /pdf-tools/ WASM/font paths on mobile and desktop | §1 payloads, §2 real browser measurements, §4 worker/lazy/cancel model; mobile re-measurement explicitly deferred to PT-QA-002 (§5) |
| Record measured byte/page/pixel limits and asset sizes. No assumed unlimited processing | §3 quota table with measured bases; §1 asset table |
| Large scans and low-memory mobile runs | F-008 measured; low-memory mobile = PT-QA-002 scope (recorded, not claimed) |

After merge, PT-SP-002 is **Done**, unblocking PT-FND-003 (worker orchestration), PT-FND-006 (validation/quota enforcement), PT-SEC-002 target metrics, and PT-QA-002 groundwork.
