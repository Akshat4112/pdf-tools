# PT-SEO-004 — Useful category hubs and internal navigation

Four stable public hubs live at `/pdf-tools/tools/organize/`, `/tools/convert/`, `/tools/read/` and `/tools/markup/` (all beneath the project base). Conversion directions share one hub so the single images-to-PDF tool does not become a thin category page. Each hub has multiple shipped tools, distinct selection guidance and practical limitations, plus links to the existing privacy specification, local-processing audit and MIT license on GitHub. Public help/trust pages and practical guides have not shipped yet; their future URLs are not advertised.

The registry remains authoritative for tool availability. `categoryHubs.ts` owns the group map, escaped public HTML and navigation. Homepage category links and header Explore links lead to real pages, while catalog search/filter state remains local and creates no indexable pages. Static entry pages, sitemap, static and client metadata, refreshes and SPA/history navigation include the same four hubs. Tool URLs remain unchanged. Breadcrumbs describe catalog → task group → tool without relocating existing canonical tool URLs. Related-tool navigation links to shipped siblings and their hub; it never carries a file between tools.

## Verification

- Unit checks cover complete one-group-per-tool membership, at least two tools per hub, slash variants, metadata, invalid hubs and sibling links excluding the current tool.
- Browser checks crawl links from every generated public page and prove that every canonical public route is reachable from the homepage, every internal page target is known and served, and every route is present in the sitemap. Fragments, query-state pages and unknown category pages are not generated.
- With JavaScript disabled, every hub has one main, a visible heading and working direct links to its member tools.
- Keyboard Enter navigation, breadcrumbs, metadata, Back/Forward, 320/1440px fit and light/dark rendering are checked. A synthetic selected-file sentinel verifies that leaving a tool for a hub and returning does not restore file rows or put filenames into metadata.
- CI captures empty hubs only, asserting no file inputs, file rows or canvases before capture, alongside the existing one-day empty-workspace artifacts. Existing output, privacy, cleanup and browser suites remain required.

The static renderer accepts only registry/public editorial data and escapes text. No engine, upload, storage, processing, metadata input or dependency behavior changes. External GitHub evidence links reuse existing documented destinations; production deployment/link readback and broader real-device/screen-reader review remain separate release tasks. No rich-result or ranking guarantees are made.
