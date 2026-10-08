# PT-PD-006 — Capability and license decisions

- Decision record version: 1.0
- Prepared: 2026-10-08
- Status: proposed, ready for PR review. Becomes the dependency baseline when merged.
- Repository: [Akshat4112/pdf-tools](https://github.com/Akshat4112/pdf-tools)
- [Project tracker](https://docs.google.com/spreadsheets/d/1m3iyaksGD-hY51JwFfIzb-JS5S3GSp0uJqS4Ae77-lg/edit)
- Depends on: PT-PD-004 ✓, PT-PD-005 ✓
- Task: *"Select core libraries after spikes. Record versions, licenses, maintenance and security posture. Decide open-source/commercial licensing for advanced engines."* Note: PT-SP-001 (rendering/edit spike) and PT-SP-003/004 (advanced engine spikes) run *after* this task in the dependency graph (they depend on PT-PD-005/006 outputs, not the reverse). This record therefore (a) approves the **core R1 stack** with live-verified data, (b) sets **binding selection rules** the spikes must apply, and (c) defers advanced-engine selection to the named spikes with explicit gates. PT-PD-001 §7 already required exactly this posture: packages are *candidates* until proven.

## 1. Decision method

Every version/license/maintenance fact below was verified live on 2026-10-08 against the npm registry and GitHub API (no assumptions from memory). Security posture = release recency + maintenance signals + known license constraints; the actual vulnerability gate is PT-SEC-003 (dependency license and vulnerability checks in CI), which this task configures with its rules.

## 2. Approved core stack (R1)

| Capability | Library | Version (2026-10-08) | License | Maintenance | Decision |
| --- | --- | --- | --- | --- | --- |
| Rendering + text extraction (PDF→JPG/PNG, reader, TXT) | `pdfjs-dist` | **6.4.299** (2026-10-03) | Apache-2.0 | mozilla/pdf.js — 54k stars, release 5 days ago, active monthly releases | **Approved** |
| Page writing (merge, split, rotate, delete, extract, organize, images→PDF, numbering, watermark) | `pdf-lib` | **1.17.1** | MIT | last publish 2021-11-06 — stable but dormant (see §3) | **Approved with condition** |
| ZIP packaging (split, PDF→images multi-file) | `@zip.js/zip.js` | **2.23.0** (2026-10-03) | BSD-3-Clause | active, zero deps, maintained (gildas-lormeau) | **Approved** |
| Compression helper (deflate streams where needed) | `fflate` | **0.8.3** (2026-05-16) | MIT | active, zero deps, fastest-in-class | **Approved** |

### 2.1 pdf-lib dormancy — condition and fallback

`pdf-lib` (Hopding) has not published since 1.17.1 (2021-11-06). The API surface we need for R1 (copy pages, rotate, split, page insertion, draw text, embed JPG/PNG) is complete and heavily battle-tested; dormancy is acceptable for a **stable, spec-complete** library. **Condition:** if PT-SP-001 (the rendering/edit spike) hits an unfixable pdf-lib defect on the benchmark corpus, switch to the actively maintained fork **`@cantoo/pdf-lib` v2.11.1** (2026-09-15, MIT — verified live), which tracks upstream + adds fixes. This swap must then be recorded as an amendment to this ADR. Unmaintained ≠ unusable; unusable = fails the corpus, which the spike decides.

### 2.2 Explicitly rejected for R1

| Library | Reason |
| --- | --- |
| `mupdf` (npm, AGPL-3.0-or-later, v1.28.1) / `mupdf-js` (AGPL) | **AGPL** — the tracker acceptance criterion is "no unreviewed AGPL/commercial dependency"; AGPL in a distributed web bundle triggers §13 network-copyleft obligations for the entire combined work. Rejected for this MIT-licensed project unless a future PT-EXT decision buys a commercial Artifex license — out of scope for a free tool |
| `jszip` | Dual-licensed `(MIT OR GPL-3.0-or-later)` — usable but adds an avoidable licensing footnote and more deps; `@zip.js/zip.js` is leaner (0 deps) and BSD-3 |
| `pdfkit` | MIT, but it's a *generator* (node-oriented); overlaps pdf-lib's role with a heavier font stack (fontkit, linebreak, noble-ciphers). No R1 capability needs it |
| `qpdf-wasm` | v0.1.0 (2025-07-26), single pre-release, Apache-2.0 — too immature; revisited only by PT-SP-003 (compression/encryption spike) |
| `tesseract.js` | Not R1 scope. OCR is R3 gated (PT-SP-005). Confirmed Apache-2.0 (v7.0.0, 2025-12-15) for the future spike, with its `idb-keyval` dependency noted — IndexedDB caching must be **disabled** to honor PT-PD-003 §3 |

## 3. Advanced engine licensing decision (open-source vs commercial)

**Decision: open-source (permissive) only.** R1–R4 ship on GitHub Pages as a free static site under the project MIT license. Any engine whose redistribution terms are AGPL/copyleft, or which requires a per-seat/per-use commercial license in the browser bundle, is rejected *by default*; a future PT-EXT-001 (R5) decision may revisit with explicit budget, but no R3/R4 capability may silently introduce one:

- **Compression/encryption (PT-SP-003):** candidate path is pdf-lib + fflate (MIT/MIT) with a linearization pass; qpdf-wasm only if it matures; never `mupdf`-wasm.
- **OCR (PT-SP-005):** tesseract.js (Apache-2.0) is the default candidate, with cache-to-IndexedDB disabled and worker-size limits respected. Any alternative must be permissively licensed and pass the corpus accuracy gates.
- **Office/ODF/EPUB conversion (PT-SP-006):** browser-side engines are almost uniformly immature or copyleft; each format gate defaults to *defer* unless a permissive-licensed, corpus-proven engine exists. Honest "limited local" subsets remain the expectation, per PT-PD-001 §6.

The license gate for every future dependency is fixed here: **MIT, Apache-2.0, BSD-2/3-clause, ISC, 0BSD, or CC0** (for assets) only; anything else (AGPL, GPL/LGPL, SSPL, BSL, unknown/"custom") requires an explicit ADR amendment before `npm install` — enforced mechanically by PT-SEC-003's CI check.

## 4. Version pinning and supply-chain posture

1. **Pin exact versions** in `package.json` (no `^` ranges for runtime deps) — the registry metadata above is the pin source. Upgrades are deliberate PRs with re-validation against the corpus.
2. **Lockfile committed** (`package-lock.json`), `npm ci` in CI — no floating resolution.
3. PT-SEC-003 will add: `npm audit --omit=dev` gate + license allowlist scan (fail on §3's deny list) + `actions/setup-node` with pinned Node LTS.
4. Font decision (watermark/numbering glyphs, EN/DE): use pdf-lib's embedded standard-fonts for Latin coverage; any custom font must be self-hosted, subset, and OFL/CC0 — decided when PT-CORE-016 needs it, under this gate.
5. The corpus (PT-PD-005) is the acceptance harness for every engine decision above — a spike "approves" an engine only by passing `scripts/validate_corpus.py` expectations on transformed outputs, not by documentation claims.

## 5. PT-PD-006 acceptance review

| Tracker requirement | Evidence |
| --- | --- |
| Select core libraries after spikes / record versions, licenses, maintenance and security posture | §2 table with live-verified versions/licenses/dates; spike ordering caveat addressed in the header; supply-chain rules in §4 |
| No unreviewed AGPL/commercial dependency | §2.2 rejects mupdf/mupdf-js (AGPL) and unproven qpdf-wasm; §3 fixes a permissive-only allowlist enforced by PT-SEC-003 CI |
| Unsupported capabilities remain hidden | §2.2 + §3: OCR/Office/compression engines stay unselected until their spikes pass; product rule from PT-PD-001 §6 restated as engine rule |
| Dependency inventory reviewable | §2 + §2.2 tables are the inventory; future changes require ADR amendment |

After merge, PT-PD-006 is **Done**, unblocking PT-SP-001/002/003/004/006 and PT-FND-001.

## 6. Sources (checked 2026-10-08)

- npm registry live metadata: `pdfjs-dist`, `pdf-lib`, `@cantoo/pdf-lib`, `@zip.js/zip.js`, `fflate`, `jszip`, `pdfkit`, `tesseract.js`, `mupdf`, `mupdf-js`, `qpdf-wasm`, `canvg`, `fontkit`, `@pdf-lib/fontkit`
- GitHub API: `mozilla/pdf.js` (Apache-2.0, active, v6.4.299 released 2026-10-03), `Hopding/pdf-lib` (MIT, last push 2024-07-17, not archived)
