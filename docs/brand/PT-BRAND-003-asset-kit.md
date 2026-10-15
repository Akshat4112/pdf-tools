# PT-BRAND-003 — FolioLocal logo and brand asset kit

Prepared 2026-10-15. Status: ready for review. Depends on accepted positioning (PR #44) and name/URL strategy (PR #45). Source assets: [`app/public/brand`](../../app/public/brand/). Review sheet: [`index.html`](../../app/public/brand/index.html).

## Identity and provenance

The original mark combines a folded document with an offset lower sheet suggesting an L. It represents document work on the user's device; it is not a shield, certificate or promise that a document is encrypted. Geometry was drawn for this project in the generator, without tracing a competitor or using stock artwork.

The wordmark is **FolioLocal**, using outlined glyphs from the repository's existing PDF Tools Sans derivative of Noto Sans. There is no new font download, runtime font request or icon library. SVG paths remain editable in a vector editor; edit the text and geometry in the generator to regenerate the kit. Do not substitute a system font and still call it the canonical logo.

Original mark/artwork and generator follow the repository's [MIT license](../../LICENSE). Typeface provenance and the existing OFL-1.1 notice are included in [`FONT-LICENSE.txt`](../../app/public/brand/FONT-LICENSE.txt). The font itself remains under OFL; the rendered wordmark/artwork is not a newly redistributed font. No fonts or photos with unknown licenses were introduced. This records asset provenance, not trademark exclusivity.

## Deliverables

| Asset | Dimensions / format | Use |
| --- | --- | --- |
| `logo-light.svg` | 330 × 64, transparent | Teal mark + ink wordmark on white/light surfaces |
| `logo-dark.svg` | 330 × 64, transparent | Teal mark + white wordmark on ink/dark surfaces |
| `logo-mono.svg`, `logo-reversed.svg` | 330 × 64 | Single-ink and white lockups; mark strokes are transparent knockouts |
| `wordmark.svg`, `wordmark-reversed.svg` | 250 × 64 | Text-only identity where the document mark is already present |
| `mark.svg`, `mark-mono.svg`, `mark-reversed.svg` | 64 × 64 | Compact colored, single-ink and reversed identity |
| `favicon.svg`, `favicon-16.png`, `favicon-32.png`, `favicon.ico` | SVG + exact 16/32 px PNG/ICO entries | Browser icons; self-contained fixed-color mark |
| `apple-touch-icon.svg`, `apple-touch-icon.png` | 180 × 180 | Opaque teal touch icon with safe inner padding for platform corner masks |
| `icon-192.png`, `icon-512.png` | Exact 192/512 px transparent-corner PNGs | General icon exports; does not imply a PWA/offline feature exists |
| `social-card.svg`, `social-card.png` | 1200 × 630 | Reusable editable/outlines source and raster public share image |
| `brand.json` | JSON | Name, tagline, palette, license and source references |
| `index.html` | Responsive static review sheet, noindex | Variants, actual-size icons, desktop/mobile header samples and social preview |

The social artwork uses the accepted tagline **“Free PDF tools. On your device.”**, with “Free forever / Open source” and the current project URL. It contains no document-derived text, filenames, user counts, fake ratings or security/compliance badges. It does not announce unavailable capabilities.

## Usage rules

- Preserve the mark's 1:1 aspect ratio and the lockup's native proportions. Minimum compact-mark size: 16 CSS px; prefer 24–32 px in navigation. Use the horizontal lockup at least 160 CSS px wide. At narrower sizes use the compact mark with a separate accessible brand label.
- Keep clear space of at least one-eighth of the rendered mark width around the outside of the complete artwork. Do not stretch, rotate, add shadows/gradients, redraw the fold or place on busy photos.
- Use the light logo on white/mint and the dark logo on ink. Use single-ink files when color reproduction is unavailable. Reversed assets have transparent cutouts and must sit on a dark surface. Do not treat the teal and white primary mark as a one-ink print file.
- Colors: ink `#142D3A`, teal `#08796D`, mint `#EAF7F3`, white `#FFFFFF`. These are identity colors, not a complete UI token system; PT-BRAND-004 defines semantic states and component styles.
- Measured sRGB contrast: teal/white **5.29:1**, teal/mint **4.82:1**, ink/white **14.32:1**, ink/mint **13.02:1**. White wordmark on ink also measures 14.32:1. The mark on dark ink uses distinct white strokes; its teal outer tile must not become a UI focus/selection boundary by itself. Recheck any new surface/pairing in the visual-system task.
- For an image-only home link, use `alt="FolioLocal — home"`. If visible adjacent text already says FolioLocal, the duplicate mark uses empty alt / `aria-hidden`. When inserting SVG markup inline, use unique title/mask IDs per instance or the corresponding `img` asset to avoid ID collisions. The external SVGs contain accessible titles; HTML `img` still needs contextual alt text.
- Future social metadata should use a stable absolute public image URL, PNG dimensions, and descriptive image alt text. Never render a user's PDF as an OG image. PT-SEO-005 owns metadata wiring and platform preview verification.

## Build and verification

Run `python scripts/build_brand_assets.py` from the repository root. Build tools: Python fontTools, Inkscape, and ImageMagick's `convert` (ICO container). They are development/export tools, not application dependencies. The script reads the existing font from `app/src/assets/overlayFont.ts`, writes only this asset directory, and makes no network requests. It does not rewrite the review HTML. Keep the generated outputs committed so ordinary app builds need none of these export tools.

Verification performed:

- Parsed every SVG as XML; checked explicit view boxes, no external image/font/script resources and no live text/font dependency in the logos/social artwork.
- Inspected Inkscape raster exports for the four lockups on light/dark backgrounds and for real 16/32/180 px icon sizes. The 16 px icon retains the folded-page silhouette and lower-sheet stroke; the full wordmark is deliberately omitted at that size.
- Inspected desktop (190 px lockup) and 375 px mobile-header (160 px lockup) sizing compositions and 1200 × 630 social artwork. The responsive HTML review sheet also uses these sizes. This is asset-layout QA, not a claim that app header/mobile accessibility or social-platform rendering has been tested.
- Verified PNG/ICO dimensions, alpha/opaque touch-icon behavior, intended color contrast and local asset references. Verified the kit survives a normal production build and lint; no application source or dependency change is required.

## Integration handoff

This task delivers the asset kit and review surface. The app's current favicon/head/header are not replaced piecemeal. PT-UI-002 and PT-SEO-005 wire the final logo, accessible home link, favicon/touch icon and branded metadata together with the shared header/footer work. Existing `/pdf-tools/` routes, workers, fonts, source repo and canonical URL stay unchanged. No manifest/PWA, tracking, domain or security claim is added here.

The review sheet is excluded from the tool sitemap and carries static `noindex, nofollow`. It is an internal asset review page rather than a second tool landing page. Later production SEO work should retain this boundary.

Owner acceptance remains pending review/merge. Next: **PT-BRAND-004 — professional visual system and component library**.
