# PT-SEO-006 — Public structured data

## Implementation

`pageMetadata.ts` builds one `@graph` per exact canonical in PUBLIC_PAGES. Homepage: WebSite and WebApplication. Tool entries: WebPage, WebApplication and BreadcrumbList. Category hubs and guide directory: CollectionPage and BreadcrumbList. Four published guides: WebPage and BreadcrumbList. Unknown routes, 404, query-bearing URLs and fragment-bearing URLs have no graph. Tool applications describe only shipped registry tools, visible public descriptions, browser requirements, free access, a zero-price Offer and the existing MIT license. No reviews, ratings, certifications, fabricated dates, download counts, personal publishers or search actions are added.

All 24 currently published routes (home, 14 tools, four hubs, directory, four guides) are handled; published guide breadcrumb labels follow the visible All PDF tools → Guides → guide navigation. The graph factory accepts only a canonical string and resolves all copy from the public registry/metadata. It never receives files, page text, settings or session state. A caller changing a PageMeta title cannot inject that title into JSON-LD. Serialization escapes HTML delimiters and Unicode line separators. The Vite build inserts static graphs into all generated HTML pages; client-side routing lazily loads the separate schema module, updates the owned script with textContent, and discards stale navigation updates. The schema module is not part of the initial catalog JavaScript bundle. Unknown routes have no graph. No DOM-generated document content is inspected to build the graph.

Breadcrumbs reproduce the visible All PDF tools → task hub → tool hierarchy, using absolute canonical URLs and consecutive positions. A hub or guide directory has two items; a tool or individual practical guide has three. Tool canonical URLs are unchanged. Public URLs with meaningful schema node fragments identify graph entities, not user/private state.

## Vocabulary and Google eligibility (checked 2026-10-25)

Primary references:

- https://schema.org/WebApplication
- https://schema.org/WebSite
- https://schema.org/BreadcrumbList
- https://developers.google.com/search/docs/appearance/structured-data/software-app
- https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- https://developers.google.com/search/docs/appearance/site-names

WebApplication supports browserRequirements and the inherited free-access, license and offers properties. Google documents a zero offer price for a free application; no arbitrary price currency is added. Its software-app rich result also requires a genuine rating or review. None exists in the public product evidence, so none is invented: this implementation does not claim software-app rich-result eligibility. WebSite describes the project site only and makes no promise about Google's displayed site name. No changes are made to the shared portfolio origin.

Breadcrumbs follow the visible navigation path rather than requiring matching URL folders, as Google recommends. Their properties meet the documented shape, but syntax/property correctness does not guarantee indexing, display or ranking. Category CollectionPage and WebSite are semantic descriptions, not promises of a dedicated rich result. Search Console/deployment readback stays with the existing release tasks.

## Validation and limits

Unit checks cover public-route allowlisting, real free/license fields, absence of invented structured properties, valid breadcrumb positions/targets, safe JSON round trips, stale-script replacement and caller-data isolation. Browser checks parse every built public graph and 404 response, compare static/client output, check names against visible tool headings/breadcrumbs, and exercise SPA/history, unknown paths, and synthetic selected-file isolation. Existing metadata, privacy, output and full browser regression suites remain required.

The hosted Schema.org validator could not be used: on 2026-10-25 this cloud browser received an unusual-traffic page with reCAPTCHA before the validator UI. No CAPTCHA was attempted. No hosted validator pass or Google Rich Results Test result is claimed. External validation and a production URL check remain explicit follow-up evidence; the automated checks are project contract checks, not substitutes for those hosted tools. There is no UI change requiring new layout captures and no processing, storage, upload or dependency change.
