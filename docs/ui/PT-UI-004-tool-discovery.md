# PT-UI-004 — Tool discovery and search

The catalog reuses PDF Tools's light/dark palette, original icons, registry routes and availability flags. Cards have consistent headings, descriptions, file-format cues and full-card links. Unavailable capabilities remain inert, visibly labelled cards. The file-limit cue comes from the shared quota and distinguishes tool/device limits.

Search accepts multiple task/format words, punctuation, case differences and familiar aliases (join/combine, photos, metadata/properties, and similar). Aliases describe existing operations, not unavailable conversions or OCR. All words must match. Matching is local React state: no query URL, storage or analytics is introduced; titles, canonical URLs and sitemap stay unchanged.

Category counts describe the full category inventory. Result counts distinguish matching tools from the number ready to use. Category changes keep focus on the selected button. Clear search preserves category, Reset filters restores the full catalog and both return focus to the search field. Escape clears the query; the existing slash shortcut focuses it. Live result counts use one polite atomic status region. Empty states offer concrete recovery, and React renders query text safely.

The layout includes 44px active targets, visible focus, 320/390/640/768/1440px layouts, both themes, reduced motion and scoped styles. The 640px viewport approximates available CSS width at 200% zoom on a 1280px display; it is not a claim of physical-device or screen-reader certification (PT-QA-002/PT-UI-007).

Validation includes task/format lookup and unavailable-card unit tests; browser checks combine search and categories, keyboard focus, empty recovery, inert query text, route navigation, registry counts, computed text/control-boundary contrast, 3px focus and viewport bounds. Only empty workspaces are used. PDF engines, workers, session ownership and downloads are unchanged; the full output/privacy regressions remain required.

Footer/help/trust content tasks retain their declared dependencies. PT-UI-004 depends only on merged PT-UI-001 and PT-BRAND-004 and is independent of security maintenance PR #58. Public help/privacy is PT-REL-001; this task does not publish those pages or claim broad browser/device validation.

CI captures only the empty catalog in light/dark at 320/1440px, with a dedicated variable used exclusively in the discovery test. Those PNG files are the only uploaded visual artifacts, retained one day. Document tests keep screenshots/video/traces disabled. Local Chrome launch was blocked by the environment; use exact-head CI browser results and these catalog captures for visual review.

The six discovery scenarios run first in CI; the following R1 regression step explicitly excludes that already-run describe group and executes the other 200 scenarios. This preserves all 206 interface scenarios while failing quickly on discovery regressions. Theme colors change without color transitions, so control boundaries do not briefly inherit low-contrast colors from the previous theme.
