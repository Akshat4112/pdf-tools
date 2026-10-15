# PT-SEO-001 — SEO baseline and query-to-page plan

Prepared 2026-10-15. Status: review; this is an audit and proposed plan, not deployed SEO changes.
Source baseline: main `6b8df84d8416d8cac44fcc3419d6b5ec7856defa`. Production: https://akshat4112.github.io/pdf-tools/.

## Evidence and limits

The accompanying [HTTP snapshot](2026-10-15-live-audit.json) records GET responses for the home page, all 14 registered tool paths, sitemap, both robots locations, explicit 404, a missing path and merge URL variants. It extracts static metadata, H1s, anchors and root text without executing JavaScript. Repeat with `python docs/seo/audit_public_site.py > /tmp/pdf-tools-seo-audit.json` from the repo root; inspect HTTP errors before comparing. It makes public GET requests only and follows redirects. Four initial 502 responses succeeded on a subsequent read; the snapshot preserves those earlier attempts. These transient observations do not establish site downtime or a Google crawl failure.

Rendered browser observation on 2026-10-15: homepage shows the working catalog, generic PD monogram, local-processing banner and basic source/license footer; it says **13 of 14 tools available**. The merge workspace has its heading, file picker and options, but no shared footer. No documents were selected during this audit. The browser renders content absent from the HTTP body. This is not a Googlebot render or Search Console inspection.

Source reviewed: `app/index.html`, `app/vite.config.ts`, `app/src/lib/seo.ts`, `app/src/registry.ts`, `app/src/App.tsx`, the header and product/lifecycle specifications. The build calls its route cloning “prerendering,” but currently generates per-route head tags around an empty application root rather than rendered page content.

No Search Console account data, Google URL Inspection result, traffic totals, keyword volumes, backlink inventory, field Core Web Vitals or measured ranking positions were available to this audit. None are inferred from the public search sample. An HTTP 200 or a sitemap entry is not proof of indexing.

## Measured production baseline

The snapshot contains each route's exact title, description, canonical, social tags, language, response size and body hash. This table summarizes it without substituting assumptions for those records.

| Check | Observed result | Interpretation / next owner |
| --- | --- | --- |
| Home + 14 registered clean tool URLs | All final reads HTTP 200; canonical points to the matching trailing-slash URL | Preserve base-path behavior in PT-SEO-002; HTTP availability alone is not feature availability |
| Unique metadata | 15 distinct titles, descriptions and self-canonicals; English language; OG title/description/url/site_name/type and Twitter summary fields present | PT-UX-004 already provides these; PT-SEO-005 refines copy and brand assets rather than rebuilding from zero |
| Static page content | All 15 entry bodies have empty `#root`, no H1 and no anchors | PT-SEO-002 must render useful headings, explanations and navigation in HTML; JS enhancement still runs tools. This does not prove Google cannot render the app |
| Sitemap | 15 entries: home + all 14 tools, including unavailable `/doc-info/`; all lastmod values 2026-10-15 | Filter to actually useful shipped/indexable pages; omit unavailable pages until released. Use significant content-change dates or omit lastmod instead of build dates (PT-SEO-002) |
| Origin robots | `/robots.txt` is HTTP 200, allows crawling (`Disallow:` empty), advertises the portfolio-root sitemap | It is the operative origin robots file; project SEO work must not overwrite sibling-project rules |
| Project robots | `/pdf-tools/robots.txt` is HTTP 200, Allow `/`, project sitemap line | It does not replace origin robots. Submit project sitemap through Search Console; a root sitemap reference is separately scoped |
| Slash variants (merge sample only) | `/merge` finishes at `/merge/`; `/merge/index.html` is 200 with `/merge/` canonical | Canonical consolidates the duplicate; this audit did not record every intermediate redirect code or test variants for every tool |
| Missing path | `/seo-audit-missing-page/` returns true HTTP 404 with not-found metadata | Preserve the status and file-URL semantics; see explicit 404 row below |
| Explicit `/404.html` | HTTP 200; both it and the missing-path response canonicalize to `/pdf-tools/404.html`; no robots noindex tag | Not-found canonical is a file URL, **without** a trailing slash. Exclude it from sitemap (already excluded) and consider static noindex for the explicit file in PT-SEO-002 |
| Social artwork | No `og:image` or Twitter image in audited entries | PT-BRAND-003 / PT-SEO-005 supply real branded public images; no document data |
| Structured data | Source generation has no JSON-LD | PT-SEO-006 adds only accurate visible product facts; no fake ratings or promised rich results |
| German versions | Current entries `lang=en`; no localized route/canonical/hreflang set in source | German query mapping below is future planning, gated on PT-UX-005 and PT-SEO-010 |

Use the exact snapshot canonical value for the 404 file. All other canonical page URLs end with `/`.

## Priority implementation backlog

| Priority | Finding → action | Task / acceptance evidence |
| --- | --- | --- |
| P0 | Empty initial content/link graph → generate meaningful static page content and crawlable links, retain functional client routing | PT-SEO-002: generated HTML has a useful H1, purpose and working links for every shipped page; compare with rendered UI; unknown paths remain 404 |
| P0 | Sitemap includes unavailable inspector → centralize availability rules for sitemap, navigation and route content | PT-SEO-002: exclude unshipped tools; revisit `/doc-info/` after PR #43 merges and deploys. Do not label the current placeholder as working |
| P0 | Indexing status unknown → verify correct URL-prefix property and inspect home, merge, split and image conversion | PT-SEO-008 after PT-SEO-002 and brand/domain decision; retain Google-selected canonical, index/crawl state and sitemap readback |
| P1 | No origin reference to the project sitemap observed → submit project sitemap; assess a root robots/sitemap change only in a separately scoped portfolio-repo PR | PT-SEO-002/008; root sitemap contents were not crawled, so no claim it lacks PDF Tools entries |
| P1 | Lastmod is always build date → track significant page changes or remove the optional field | PT-SEO-002; generator test does not treat every code build as a content edit |
| P1 | Sparse explanatory content → add useful steps, formats, real limits, examples and related links close to the working tool | PT-SEO-003/004; start merge/split/images without burying the picker |
| P1 | Generic branding/share previews → final name, original favicon, titles, public share image | PT-BRAND-002/003, PT-SEO-005; preserve existing URLs until migration is deliberately decided |
| P1 | No recorded performance/field baseline → capture mobile lab measurements before changing bundle loading | PT-SEO-007; report lab results separately from field data; preserve local-only operation |
| P2 | No German publication yet → translate working UI/content before crawlable localized pages/hreflang | PT-UX-005 / PT-SEO-010; reciprocal annotations and locale self-canonicals |

PT-UX-004 is not being reopened as unfinished. It delivered direct static entry files and metadata. These tasks extend its coverage to static **body content**, availability policy, richer useful content and production indexing verification.

## Search-intent evidence

Public web searches on 2026-10-15 used two search providers, not an authenticated Google ranking/keyword report. The table records representative first-party pages returned, not their absolute position, volume, popularity or independently tested claims.

| Query | Representative source pages returned | What the sample supports |
| --- | --- | --- |
| `free merge PDF locally browser open source` | [PDFsam](https://pdfsam.org/), [PDFsam official source](https://github.com/torakiki/pdfsam), [EmbedPDF merge](https://www.embedpdf.com/tools/pdf-merge), [FreeMergePDF](https://freemergepdf.com/) | Results mix desktop open-source utilities and local browser tools. Clearly say “in your browser” and link our own source; local/free is not an exclusive differentiator |
| `PDF zusammenfügen kostenlos lokal Browser ohne Upload` | [PDF24](https://tools.pdf24.org/de/pdf-zusammenfuegen), [Smallpdf](https://smallpdf.com/de/pdfs-zusammenfuegen), [pdf.de](https://www.pdf.de/pdf-zusammenfuegen/), [pdfzus](https://pdfzus.de/) | German phrasing distinguishes merge action, cost, local execution and upload concern; a translated useful page is preferable to English copy with German keywords |
| `site:akshat4112.github.io/pdf-tools/` | No target-site match appeared in the returned sample from either provider | Index status remains **unknown**. These are not verified Google index exclusions; confirm in Search Console |

All remaining query ideas below are editorial hypotheses derived from our working capabilities and these intent patterns. They have not been assigned search volume, keyword difficulty, paid acquisition value or rank estimates. Priorities reflect functionality and user usefulness, not measured demand. Avoid targeting “Word to PDF,” OCR, compress, password unlock, electronic signature or redaction pages until those distinct features genuinely ship.

## Query-to-page map

Paths below are relative to `/pdf-tools/`. Keep a single page for closely related synonyms; do not create thin pages for every query variant. German phrases are candidate intent translations requiring native-language editorial review and a working localized experience before publication. “Free,” “no account,” “local” and “no upload” are supporting modifiers where the brand claim matrix permits them.

| Canonical path | Status / priority | One primary English purpose/query | Secondary English intent | Future German primary intent | Page-specific content requirement |
| --- | --- | --- | --- | --- | --- |
| `/` | Live / P0 | free local PDF tools | open-source PDF tools in browser | kostenlose lokale PDF-Tools | Explain collection, pledge and working tool categories; link each tool |
| `/merge/` | Live / P0 | merge PDF files | combine PDFs without upload | PDF zusammenfügen | File order, two-file minimum, supported inputs and preservation limits |
| `/split/` | Live / P0 | split PDF | split PDF into separate pages | PDF teilen | Distinguish ranges, every N pages and per-page ZIP from extracting one new PDF |
| `/images-to-pdf/` | Live / P0 | images to PDF | JPG to PDF; PNG to PDF | Bilder in PDF umwandeln | One combined JPEG/PNG page; ordering, page size/margins and supported format limits |
| `/pdf-to-jpg/` | Live / P0 | PDF to JPG | convert PDF pages to JPEG locally | PDF in JPG umwandeln | Selected pages, DPI, JPEG quality and output packaging |
| `/pdf-to-png/` | Live / P1 | PDF to PNG | PDF pages to transparent PNG | PDF in PNG umwandeln | Background choice, selected pages and pixel limits; don't promise vector preservation |
| `/rotate/` | Live / P1 | rotate PDF pages | save rotated PDF locally | PDF-Seiten drehen | Rotation selection, 90-degree steps and saving a new PDF |
| `/delete-pages/` | Live / P1 | delete pages from PDF | remove PDF pages free | PDF-Seiten löschen | Retained-page rule and original unchanged; deletion is not secure redaction |
| `/extract-pages/` | Live / P1 | extract PDF pages | save selected PDF pages | PDF-Seiten extrahieren | One selected-page PDF, ordering and difference from split ZIP |
| `/organize/` | Live / P1 | reorder PDF pages | organize PDF pages | PDF-Seiten neu anordnen | Preview order, duplicate/rotate/delete and undo; link specific one-action tools |
| `/reader/` | Live / P1 | PDF reader in browser | read and search PDF locally | PDF im Browser lesen | Navigation, search/copy text layer and printing; no OCR claim |
| `/page-numbers/` | Live / P1 | add page numbers to PDF | number PDF pages free | PDF-Seiten nummerieren | Start value, selected pages, placement and output preview |
| `/watermark/` | Live / P1 | add text watermark to PDF | watermark PDF locally | Textwasserzeichen in PDF einfügen | Text, opacity, placement and selection; no image-watermark or tamper-proof claim |
| `/pdf-to-text/` | Live / P1 | PDF to text | extract PDF text to TXT | PDF in Text umwandeln | UTF-8 text-layer export, reading-order limits and scanned-file/no-OCR distinction |
| `/doc-info/` | Placeholder / gated | inspect PDF metadata | PDF page size and page count | PDF-Metadaten anzeigen | Publish/index only after inspector release; signature indicators are not certificate validation |

Initial content batch: home, merge, split and image conversions; then remaining working tools. PT-SEO-004 may create useful organize/convert/read/markup hubs only with enough distinct helpful content. Existing category filter states do not need separate indexed pages. The homepage owns broad collection intent; tools own specific actions. Guides explain distinct workflows and link to the action rather than duplicate its landing page.

Candidate guide backlog for PT-SEO-009 (no guides authored/published here):

1. Combine PDF attachments in the correct order → merge.
2. Split a long PDF into chapter files → split.
3. Make a PDF from phone JPG/PNG images → images-to-pdf.
4. Choose JPG or PNG when exporting PDF pages → both image exporters.
5. Reorder pages and undo a mistaken change → organize.
6. Number selected pages with a custom start → page-numbers.
7. Why a scanned PDF may export no text → pdf-to-text; explain absence of OCR.
8. Deleting a page versus redacting information → delete-pages; explain that secure redaction is unshipped.

## Measurement and acceptance handoff

Record the verified Search Console property and setup date in PT-SEO-008, not credentials. For home and priority tool URLs record last crawl, index status, user/Google canonical, sitemap status and mobile usability evidence where available. PT-SEO-011 then compares aggregated query/page impressions, clicks and CTR at 30/60/90-day reviews; absent data stays “not available,” never zero by assumption. Do not collect PDFs, filenames, page text, document-level events or session recordings to measure growth.

Current baseline: public entry responses and metadata measured; index coverage, impressions, clicks, CTR and rankings unknown. Field performance unknown; lab measurements not taken by this planning task. PT-SEO-007 establishes a repeatable mobile lab baseline and seeks field data only when sufficient traffic exists.

Acceptance: dated route inventory and reproducible HTTP snapshot supplied; live rendered UI checked; EN/DE intent research distinguished from hypotheses; all 13 working tool intents and the gated inspector mapped; prioritized gaps assigned to existing task IDs. Owner review remains pending. No rank, launch date or indexing guarantee is made.

## Primary guidance reviewed 2026-10-15

- [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide): useful original content, descriptive links and metadata; no guaranteed inclusion or first-place ranking.
- [Robots introduction](https://developers.google.com/search/docs/crawling-indexing/robots/intro): origin-root robots scope; crawl control is not access security.
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): intended canonical URLs, truthful significant-update lastmod, submission as a hint; priority/changefreq are not Google ranking controls.
- [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals): measure user experience; distinguish lab diagnostics from actual field measurements.
- [Localized page versions](https://developers.google.com/search/docs/specialty/international/localized-versions): implement correct language variants/annotations when translated pages exist.
- [Structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies): visible, accurate markup and eligibility limits; no fabricated reviews or guarantees.
