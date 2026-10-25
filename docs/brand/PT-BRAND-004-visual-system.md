# PT-BRAND-004 — PDF Tools visual system and component library

Prepared 2026-10-15. Status: proposed implementation reference for review.
Depends on the existing PT-UX-001 system and accepted [brand kit](PT-BRAND-003-asset-kit.md). Current production routes and document processing are preserved.

## Deliverables and design direction

The reference contains [scoped tokens](../../app/public/design-system/tokens.css), [reusable component CSS](../../app/public/design-system/components.css), a [responsive homepage/workspace/state gallery](../../app/public/design-system/index.html), and [reference-only interactions](../../app/public/design-system/reference.js). It is ordinary HTML/CSS with native controls, not a second PDF implementation or a newly installed UI framework.

Direction: useful tools first, calm neutral surfaces, a restrained teal action color, readable type, clear file/order/option hierarchy, and honest state feedback. Use the original PDF Tools mark rather than security-shield decoration. Avoid oversized marketing sections, card-within-card clutter, gradients, decorative dashboards, fake statistics and claims of audited security.

The gallery's sample filenames, page thumbnails and processing/result messages are explicitly synthetic/static. Working-tool links lead to the existing routes. Only theme, example selection/reset, native fields and disclosure are interactive; no files, jobs, downloads or analytics are created. The gallery has `noindex,nofollow` and stays outside the tool sitemap.

## Tokens and themes

`tokens.css` is the source of truth for the reference. Tokens and primitives are opt-in under `.fl-system`; they are **not imported into `app/src/index.css`**. This avoids changing the existing `system.css`, engine geometry or PDF.js layout before the implementation tasks. Do not load both token sets globally and rely on selector order to reconcile them.

| Semantic role | Light | Dark | Use |
| --- | --- | --- | --- |
| Page background | `#F5F8F7` | `#101E27` | App chrome |
| Surface | `#FFFFFF` | `#192E39` | Panels, inputs and cards |
| Subtle surface | `#EAF7F3` | `#213D43` | Local-processing note and selected context |
| Text | `#142D3A` | `#EDF6F3` | Headings/body text |
| Muted text | `#4B606A` | `#B8CCC8` | Secondary help and metadata, not low-opacity text |
| Accent | `#08796D` | `#79DCC6` | Primary buttons, links and selection |
| On accent | `#FFFFFF` | `#102B27` | Primary action text |
| Control border | `#70838A` | `#92A9AD` | Required boundaries for fields/selectable controls |
| Decorative line | `#D4DFDC` | `#3C535D` | Nonessential panel/divider separation only |
| Focus | `#08796D` | `#A3ECDA` | 3 px outline with 3 px offset |

Error, warning, success and disabled colors have separate foreground/background pairs in the CSS. Status colors always accompany text/semantics; teal does not imply “verified” on its own. Do not use the subtle decorative line where a 3:1 control boundary is needed.

The [measured contrast record](PT-BRAND-004-contrast.json) contains 32 role-pair checks across light/dark. Text pairs use an unrounded 4.5:1 pass threshold and focus/control pairs 3:1. Primary button contrast measures 5.29:1 in light and 9.21:1 in dark; the weakest checked control boundary is 3.60:1. These measurements apply to the listed pairings, not arbitrary overlays/opacity or a blanket WCAG conformance claim. Rerun `python scripts/check_design_reference.py` after changing tokens; it validates contrast and HTML ID/resource wiring. A production build supplies generated route files used in that local-link check.

The reference starts in the OS-preferred theme and offers an in-memory toggle. No theme preference is persisted. The later shared header may offer System/Light/Dark, with a properly labelled control and scoped non-document preference only if that storage is separately approved. Never invert PDF canvases: page background/content remain faithful to the document in both themes.

## Typography, spacing and layout

| Foundation | Specification |
| --- | --- |
| Typeface | System sans stack; system monospace for technical values; no remote fonts. Outlined brand wordmark stays a brand asset |
| Body | 16 px / 1.6; help/metadata 14 px minimum; labels 14 px / 600–650 |
| Headings | Home 32–48 px / 1.15; tool title 28–36 px / 1.2 during integration; section 24 px / 1.3; panel 18 px / 1.4. Do not use color/size alone instead of real headings |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64 px; choose from the scale rather than ad-hoc margins |
| Shape | 8 px controls, 12 px panels/cards, 20 px only for larger grouped surfaces; pills reserved for short labels |
| Container | Up to 1120 px, centered; 24 px gutters above 600 px, 16 px below |
| Home catalog | Three columns on wide screens, two at 601–900 px, one at 600 px and below; DOM order remains visual/keyboard order |
| Tool workspace | File/order/preview region and summary/options region above 900 px; one column at 900 px and below, with primary action following relevant inputs |
| Page previews | Bounded responsive tiles; three columns by default, two on small screens. Actual page canvases retain geometry/aspect ratio; do not force them into decorative crops |
| Motion | Color transitions 140 ms; no layout shifts, moving cards or indefinite spinner animation required. Reduced-motion sets transition duration to zero |

Review at 320, 390, 768 and 1440 CSS px and at zoom/reflow equivalents. Never use device-pixel-ratio as a viewport/layout breakpoint. Document preview panes can scroll within a bounded region where necessary; fields, help, navigation and primary actions must reflow without horizontal page scrolling. Avoid sticky action bars until overlap, focus visibility and small-height/zoom behavior are verified.

## Component and state contracts

CSS classes supply visual primitives, not React behavior. During integration, retain the existing engine/session interfaces and extract shared React components only where actual repeated behavior warrants it. No parallel job state model belongs in the design layer.

| Component / reference primitive | Required states and semantics | Existing implementation / owner |
| --- | --- | --- |
| App shell / `.fl-shell` | Home/tool/help/404, stable hierarchy, one main region, skip link, content width | `App.tsx`; PT-UI-001/002/003/005 |
| Brand/navigation / `.fl-nav` | Proper home-link name; one accessible brand label; available tools only; desktop and narrow layouts; later menu uses button + aria-expanded/controls and ordinary links | `SiteHeader.tsx`; PT-UI-002 |
| Tool card / `.fl-card` | Available = descriptive anchor; unavailable = non-link with honest label; focus/hover do not shift layout | `ToolCatalog.tsx`; PT-UI-004 |
| Search/category controls | Visible label, clear/empty/results feedback; filter buttons aria-pressed and 44 px targets; static category badge is not the interactive chip | `ToolCatalog.tsx`; PT-UI-004 |
| Button / `.fl-button` | Primary, secondary, disabled, hover, visible focus; native button for actions and anchor for navigation. Disabled is not loading. No duplicate process action | Existing action controls; PT-UI-005/006 |
| File selection / `.fl-dropzone` | Empty, drag-active, validating, accepted, rejected; real file picker remains keyboard/touch accessible; actual measured quotas/support text | `FileSelection.tsx`; PT-UI-005 |
| File row / `.fl-file` | Name and metadata may wrap; explicit move/remove names; disable impossible moves; order is never color-only; restore sensible focus after remove/reorder | `FileSelection.tsx`, tool components; PT-UI-005 |
| Field / `.fl-input` | Label/help/default/focus/invalid/disabled; aria-invalid + described error; preserve correction input; avoid raw parser messages | Existing settings/range fields; PT-UI-005/006 |
| Checkbox/select | Native semantics, visible associated labels, 44 px label target, no custom fake ARIA widgets | Existing tool settings; PT-UI-005 |
| Preview tile / `.fl-page` | Loading, ready, selected, removal, failure; selected buttons use aria-pressed + text; accessible move controls supplement drag | `PageThumbnail.tsx`, page/organize/image components; PT-UI-005 |
| Progress | Real progressbar values only when measurable, otherwise indeterminate labelled progress; concise polite announcements; current-job cancel button | `ToolScreens.tsx`; PT-UI-006 |
| Error / `.fl-message--error` | Concise safe message + recovery action; associate field errors; announce new blocking failures once, retain stable focus | `ToolScreens.tsx`; PT-UI-006 |
| Warning / `.fl-message--warning` | State consequence and required action/acknowledgment; avoid alarm decoration for ordinary local processing | Tool-specific preservation warnings; PT-UI-005/006 |
| Verified result / `.fl-message--success` | Show only after output verification; actual bytes and safe name; download, retry, clear, continue semantics remain intact | `ToolScreens.tsx`; PT-UI-006 |
| Cancelled | No partial output, clear next steps, existing session lifecycle respected | `ToolScreens.tsx`; PT-UI-006 |
| Disclosure / native details | Summary focus/keyboard toggle, visible indicator, short help content; no menu role for ordinary help | PT-UI-005, PT-REL-001 |
| Footer | Same shell on home/tools/content, real source/license/help links; omit unbuilt pages until they exist | `App.tsx`; PT-UI-003 |

Icon rules: use original inline 24 px SVGs with consistent 1.8–2 px strokes and `currentColor`; decorative icons are aria-hidden. Icon-only actions require an accessible name and at least a 44 × 44 px target; tooltips cannot be the only label. No lock/shield/certification icon is used as proof of security. The gallery's three tool icons are original SVG geometry included with the MIT reference code.

The production state sequence remains configure → preview → processing → result/failed/cancelled, with the existing job orchestrator and output verification deciding transitions. Visual design never turns a “done” flag into an offered stale/partial file, keeps a cancelled worker alive, changes input ordering, alters rendering geometry or persists document content. Static specimen success/progress in the gallery are labelled examples rather than fabricated runtime results.

## Accessibility and content rules

Use normal text with at least 4.5:1 contrast, distinguish state with text/border/semantics, keep required control outlines at 3:1, and use visible focus. Project target size is 44 px even though WCAG's minimum target-size criterion includes a smaller threshold and exceptions. Never imply that button dimensions alone establish WCAG conformance.

Preserve logical headings, label fields visibly, connect help/errors, make a skip link available, and keep focus visible after resets/removals. Retain keyboard alternatives to drag, keep screen-reader announcements concise, and avoid repeatedly announcing an entire file list as progress updates. Support reduced motion and forced-colors system focus/borders. Reader/preview surfaces must not be recolored into unreadable negative PDFs.

Copy follows [PT-BRAND-001](PT-BRAND-001-positioning-and-promise.md): free forever, open source, no account, files processed on your device. Claims requiring PT-SEC-001/002 evidence remain gated. Do not add fake privacy/security badges, review stars, current-user counts, infinite-size promises or offline claims. Home uses working tools first; help explains practical limits without burying the picker. No filenames/text enter public metadata or URLs.

Primary guidance reviewed 2026-10-15: [W3C contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) and [disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/). These inform the implementation contract; a full production audit remains PT-UI-007 / PT-QA-002.

## Review, integration and next tasks

Local lint, TypeScript/build, static contrast/ID/resource checks and JS syntax checks are part of this change. `designSystem.spec.ts` adds desktop/mobile reference checks for light/dark layouts at 320/390/768/1440 px, accessible theme/selection/reset/disclosure behavior, control focus and absence of processing-engine requests. Local browser execution was initially unavailable because Chromium was not installed and its download failed; CI runs the same tests using its normal installed Chromium. Record CI results in the PR rather than treating the failed local setup as a product failure or asserting tests passed prematurely.

To review locally: build with `cd app && npm run build`, serve with `npm run preview`, then open `/pdf-tools/design-system/`. Toggle the theme and inspect home/workspace/component sections. Screenshots can be generated by `PDF_TOOLS_VISUAL_DIR=/tmp/pdf-tools-design-qa npm run test:pages-ui -- designSystem.spec.ts` where Chromium is installed; only synthetic design examples are captured. No screenshot upload or document artifact is added to CI.

After owner acceptance, evaluate readiness against all tracker dependencies:

1. PT-UI-002 can implement the shared header from this system and accepted name/route strategy.
2. PT-UI-001 additionally requires PT-TRUST-001; it must not skip trust evidence to publish stronger homepage claims.
3. PT-UI-003 additionally requires PT-TRUST-002 and PT-REL-001 for real footer content/links.
4. PT-UI-005 additionally requires PT-CORE-017, still in PR #43 at this writing. Existing tools remain usable while that separate PR is reviewed.
5. PT-UI-006 then applies processing/result/error patterns; PT-UI-007 verifies the final production redesign. PT-SEO-002/003/005 own static useful content, copy and metadata respectively.

Task completion requires owner acceptance of the reference, not deployment of the full redesign. No production component, engine, dependency, domain, tracking or storage change is included. Next independent UI implementation candidate after acceptance: **PT-UI-002 — branded responsive header/navigation**; evaluate PT-TRUST-001 alongside it to unblock the homepage.
