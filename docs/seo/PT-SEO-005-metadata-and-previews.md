# PT-SEO-005 — Page metadata and branded sharing

The source of public page copy is `app/src/lib/pageMetadata.ts`. The Vite HTML transform, generated route entries and client navigation consume the same metadata/tag builder; the build no longer keeps a second manual route-copy table.

## Public content

- The catalog title identifies PDF Tools and on-device use. Tool titles retain their clear action followed by the product name.
- Each shipped tool has a distinct concise description aligned with its real inputs, output and limits. Text extraction describes existing text and the absence of OCR; document information does not claim signature authentication.
- Home, all 14 tool entries and the explicit 404 document have one title, description, canonical and Open Graph/Twitter tag set. Canonical/OG URLs use the production `/pdf-tools/` base without query strings, fragments or selected-file data.
- The fixed 1200×630 PNG at `/pdf-tools/brand/social-card.png` is the PDF Tools brand artwork. Tags include its absolute HTTPS URL, PNG media type, actual dimensions and descriptive alt text. Twitter uses `summary_large_image` and the same image/alt text. No user PDF is rendered into a share image.
- The existing document favicon and a 180×180 Apple touch icon resolve under the project base. The security/privacy audit allowlists include that exact static icon path.
- Meta tag values and titles are HTML-escaped before static serialization. Client metadata uses DOM attributes/text, never HTML from a selected file.

## Verification

Unit tests cover shipped-route/unique-copy completeness, dimensions/alt text, tag replacement without duplicates and HTML escaping. Browser tests read raw built-route responses before JavaScript executes, verify image bytes/dimensions and icon URLs, and compare browser navigation/back/forward/404 metadata with the shared contract. A synthetic selected filename and URL canary must not enter the document head.

The raster brand artwork was visually inspected in PT-BRAND-005. This task verifies its metadata wiring and asset readback. Actual platform cards can vary with crawler caches and rendering; this does not claim external-platform preview validation, search inclusion, rich results or rankings. Search Console ownership/index checks remain PT-SEO-008. Structured data remains PT-SEO-006.
