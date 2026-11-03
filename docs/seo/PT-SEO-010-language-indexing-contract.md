# PT-SEO-010 — Crawlable English/German URLs: implementation contract

Status: **staged implementation; full bilingual rollout not complete.** German Catalog and Merge are published. This implementation adds the complete German Split workflow as the next bounded slice. PT-UX-005 provides UI copy and accessible controls, but a language toggle alone is not an indexable German language variant. Do not emit a German `hreflang`, German sitemap URL, or a German canonical until the corresponding direct-load route renders complete, accurate German content without reliance on a stored preference.

## First German tool: Merge PDF

- The explicit route gate permits only the catalog, `/pdf-tools/de/merge/` and `/pdf-tools/de/split/`; German policy, guide and other tool aliases remain unavailable.
- The Merge pair has independent self-canonicals and reciprocal English/German/default alternatives. German metadata and no-JS guidance describe the same processing limits as the interactive workspace. German JSON-LD is deliberately omitted until translated schema is authored.
- Changing language within Merge updates the URL and interface without remounting the workspace. Selected files, order, active work and verified results stay in memory; filenames are rendered unchanged. Back/forward navigation between the pair follows the URL language.
- German navigation points to approved German Catalog/Merge/Split routes. Other resources explicitly identify their English destination; untranslated policy content is not republished under a German URL.
- German guidance covers input/output formats, 50 MiB input and 300-page limits, order, a synthetic example, signature/form caveats, original/download preservation and reset boundaries. It does not claim OCR, redaction or secure operating-system memory erasure.
- Release review must verify direct/no-JS HTML, locale/metadata parity, one heading, desktop/mobile synthetic merge/download/reset, order/count, failure/cancellation recovery, preserved language-switch state, zero document-data requests/storage, and startup budgets. Code review and emulation do not replace native-device, legal or owner-account acceptance.

## Next German tool: Split PDF

- Split has its own German direct-load/no-JS page, metadata, reciprocal language alternatives and sitemap entry. Language/history switching retains the selected file, mode, page-range expression, chunk size, active work and verified ZIP result without reloading the workspace.
- Authored guidance explains custom ranges, overlapping/omitted pages, fixed chunks with a shorter last part, one PDF per page, ZIP extraction, the single-custom-range warning, 50 MiB/300-page limits, signature/form caveats and reset boundaries. It does not promise immediate interruption of every background operation or secure operating-system memory erasure.
- Acceptance covers all three modes with synthetic PDFs: independently read each downloaded ZIP member using qpdf to verify page counts and order; test invalid/backwards/out-of-bounds ranges, chunk errors, malformed input, processing failure and cancellation, locale continuity, no document-data requests/storage and existing startup budgets. Native-device, legal and owner-account acceptance remain separate release gates.

## Existing public URL contract

The shipped, established canonical English URLs live under `https://akshat4112.github.io/pdf-tools/`, including tool, category, guide, help, privacy, limitations and trust routes. Preserve those URLs as English defaults for backlinks and current users. New German counterparts, if approved, use `/pdf-tools/de/` (homepage) and `/pdf-tools/de/<path>/`. Both language URLs must provide HTTP 200 on direct GitHub Pages access, including no-JS static HTML. The site itself is on a shared origin: do not alter its origin-level robots policy or another project's routes.

## Gate each language pair before indexing

1. **Translated content parity:** For each English indexable page, translate the page title, meta description, visible headings, no-JS article, navigation, key warnings, tool limitations and JSON-LD where appropriate. German content must be independently reviewed; duplicated English content under /de/ does not pass.
2. **Route/build:** Generate physical `dist/de/.../index.html` files. App hydration must recognize route locale without depending on localStorage and preserve tool selection, download/reset and keyboard behavior. The language switch must point to the equivalent route (fallback to language catalog only when no translated equivalent exists) and have meaningful accessible names.
3. **Canonical:** English page links to itself, German page links to itself, both absolute with `/pdf-tools/` base and trailing slash. Do not canonicalize a translated German page to English.
4. **Reciprocal alternatives:** Only for a *fully validated pair*, publish `hreflang="en"` and `hreflang="de"` on both pages, optionally `x-default` on the English default. Never publish missing/untranslated alternatives.
5. **Sitemap:** Include only actually shipped, indexable locale URLs in the sitemap. Hreflang sitemap annotations are optional; if used, parity and reciprocity must match HTML links. Preserve existing English routes and their indexability.
6. **Rendering and language semantics:** HTML root `lang` must match the rendered page. German tool content, limitations, privacy statements, keyboard labels and guide examples cannot be English just because the document `lang` is de. Avoid country redirects based on IP/browser settings.
7. **Checks:** Exact build tests for direct deep links, 404 paths, canonical/hreflang parity, sitemap uniqueness, static HTML without JavaScript, no accidental mixed-language metadata, browser language switching and synthetic local PDF downloads in both locales; test screen-reader labels and mobile state.

## Safety rule pending rollout

**Do not publish `/de/` route aliases, German canonicals, or reciprocal `hreflang` before content and route parity are complete.** The current English-only canonical/sitemap behavior is preferable to indexable half-translated duplicates.

## Planned implementation slices

- Slice A: shared locale/path helpers and one testable bilingual catalog/content pair; prove locale survives direct load and no-JS.
- Slice B: extend localized page data and static prerendering to all shipped routes, with translated trust/legal text reviewed against existing actual technical claims.
- Slice C: reciprocal canonical/hreflang, sitemap, navigation switch, schema language and extensive browser/crawler regression; then hosted Search Console verification when credentials are available.

This document is the source of truth for the rollout; it does not claim that Slice A–C has shipped.
