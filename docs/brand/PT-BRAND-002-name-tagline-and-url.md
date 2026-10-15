# PT-BRAND-002 — Product name, tagline and URL strategy

Prepared 2026-10-15. Owner: Akshat. Status: recommendation for owner review.
Depends on [PT-BRAND-001](PT-BRAND-001-positioning-and-promise.md) and uses the [SEO baseline](../seo/PT-SEO-001-baseline-and-keyword-plan.md).

## Recommended decision

**Preferred name: FolioLocal.** Use **“Free PDF tools. On your device.”** as the primary English tagline. Retain **“Free forever · Open source · No account required”** as supporting proof points with the scope defined in PT-BRAND-001. “Local” describes where document computation happens; it is not an offline, anonymity or security-certification claim.

**Preferred URL strategy: retain `https://akshat4112.github.io/pdf-tools/` and repository `Akshat4112/pdf-tools`.** A display brand does not require a repository rename or domain purchase. Keep all current tool slugs, including `/merge/`, `/split/` and `/images-to-pdf/`. Do not use `/foliolocal/` as a new path merely to match the wordmark.

This is a proposed decision, not a record that the owner has already selected the name. Merging this document accepts the recommendation for the later brand/design tasks. Until then, “PDF Tools” remains the working name. The implementation of the accepted identity belongs to PT-BRAND-003 and the UI/metadata tasks; this PR only supplies the decision brief. If the owner prefers the existing name, record that choice here before merge and use it consistently in downstream work.

Why this recommendation: FolioLocal combines a document-related word with the product's local-processing principle. It can work as a wordmark without copying competitors or implying enterprise certification. The more descriptive tagline supplies “PDF” so visitors do not have to infer the purpose from the coined name. These are editorial judgments, not user-test results or proof of superior search performance.

## Shortlist and obvious conflict screen

Public searches were performed on 2026-10-15 with two search providers. Exact phrases, close word spacing and PDF-specific queries were checked. Results are an initial product-naming screen, not a trademark, company-register or legal clearance search. Missing results do not prove exclusivity.

| Candidate | Strength | Evidence / drawback | Recommendation |
| --- | --- | --- | --- |
| PDF Tools (current) | Immediately explains the category; keeps existing recognition | Very generic. Existing Pdftools/PDF Tools AG operates in PDF software; see [official site](https://www.pdf-tools.com/de/). This demonstrates search/name ambiguity, not an adjudicated trademark conflict | Viable continuity fallback, weak as a distinctive identity |
| FolioLocal | Connects documents with local processing; compact wordmark; English/German-readable letters | No obvious exact-name standalone PDF product surfaced in this sample. `foliolocal` already appears as a technical namespace in the unrelated [FOLIO eureka setup repository](https://github.com/folio-org/eureka-setup/blob/master/eureka-cli/README.md); the wider word “Folio” is crowded. Name/handle clearance remains incomplete | Preferred candidate, subject to owner acceptance and a final pre-publication recheck |
| PDFPilot | Fits the portfolio's Immopilot/Nettopilot naming pattern | Direct category overlap: [pdfpilot.io](https://www.pdfpilot.io/), [pdfpilot.net](https://pdfpilot.net/) and [PDFPilot app](https://pdfpilotapp.com/) surfaced | Reject despite family resemblance |
| PageHarbor | Friendly document metaphor | [PageHarbor PDF](https://salmon-duck-bc55.squarespace.com/) and a [scanner product described as formerly PageHarbor](https://synapseworks.org/rme-pdf-scanner/) surfaced. The latter detail was available in the search result; a direct page fetch failed | Reject because of existing document-product use |
| PDF Nook / PDFNook | Short, approachable; explicit category | A PDF reader's [product privacy page](https://quickpdfviewpdf.com/privacy-policy/new2/pdfnook/) surfaced. Direct retrieval failed; treat the indexed first-party page as a conflict signal, not a functional product test | Reject because of existing category use |

No affiliation with any named product is implied. No competitor assets, copy or logos should be reused. Existing “PDF Tools” source/document names remain historical records rather than being rewritten wholesale.

## Tagline and language handoff

| Surface | Proposed wording | Constraint |
| --- | --- | --- |
| Wordmark | FolioLocal | Keep exact capitalization; no “official,” certification shield or geographic-hosting implication |
| Primary English tagline | Free PDF tools. On your device. | Explain practical purpose and local computation; not an offline promise |
| Supporting promise | Free forever · Open source · No account required | Link the pledge and source; preserve PT-BRAND-001 scope and evidence gates |
| Homepage opening | Everyday PDF tools, processed on your device. | Follow immediately with working capabilities and a visible catalog |
| Title pattern | Merge PDF — FolioLocal | Descriptive action first; canonical remains the existing tool URL |
| German tagline draft | Kostenlose PDF-Tools. Auf deinem Gerät. | Candidate translation only; native-language review and PT-UX-005 precede German publication |

Do not keyword-stuff the brand or create a second English landing page at a name-based URL. PT-SEO-003 owns useful per-tool copy; PT-SEO-005 owns consistent static/client metadata and share previews after the identity is accepted. PT-TRUST-001 owns proof-point wording and audit gates. A name decision cannot mark PT-SEC-001/002 complete.

## GitHub and social handles

| Identifier | Checked evidence | Current decision |
| --- | --- | --- |
| `Akshat4112/pdf-tools` | Existing repository is the authorized project and source destination | Keep the existing repository, issues, PR history and source links |
| GitHub name `foliolocal` | Scoped public search for the exact name and GitHub/social domains surfaced technical FOLIO references rather than a verified exact-name account. Direct public profile retrieval returned a search-service error | Availability **unverified**; no account/organization created or reserved |
| X `@foliolocal` | Scoped search did not surface a verified matching profile; direct public retrieval returned a search-service error | Availability **unverified**; no profile or social link advertised |
| Instagram/YouTube `foliolocal` | Scoped indexed-result screen found no verified exact matching profile in the sample | Availability **unverified**; platform availability must be checked in the normal naming flow before reservation |

These are documented checks and limitations, not claims that handles are free. Standalone social accounts are unnecessary for the app launch; existing source links work without them. PT-GROW-001/002 may revisit handles if the owner chooses actual promotional channels. Do not create accounts or publish announcements as part of this task.

## URL and domain comparison

| Option | Cost evidence | Benefits / migration implications | Decision |
| --- | --- | --- | --- |
| Current GitHub Pages project URL | $0 incremental domain-registration cost; no new hosting purchase proposed | Existing links, build base and canonical paths remain valid. Shares an origin with portfolio/sibling apps, so path scoping is not security isolation | Recommended for the current launch |
| Optional `foliolocal.com` | Registry RDAP returned 404 at 2026-10-15T14:22:58Z. This indicates no registration record was returned, not a registrar guarantee of availability. Porkbun's published standard `.com` table on this date lists USD $11.08 registration and $11.08 renewal for a non-premium single year; exact name quote, taxes/currency and future renewal price not confirmed | A separate origin can support a clearer identity and isolate browser origin storage from sibling apps. Requires purchase/renewal ownership, verification, HTTPS, URL mapping and SEO migration checks | Defer; no purchase/registration/availability guarantee |
| Rename repo/path to `foliolocal` on the existing origin | No domain-registration fee, but engineering/migration effort | Changes project base path, links and asset paths without providing a separate origin; adds redirect/canonical work solely for name matching | Reject for this launch |

Sources: [Verisign RDAP lookup](https://rdap.verisign.com/com/v1/domain/foliolocal.com); [Porkbun published pricing](https://porkbun.com/products/domains) (`.com` registration/renewal columns, USD, non-premium; checked 2026-10-15); [domain renewal price guidance](https://kb.porkbun.com/article/108-how-to-check-domain-renewal-price). Registration status and prices are time-sensitive and must be rechecked before any later purchase. The RDAP read retained only time, URL and status; no registrant/contact information was stored. No DNS result was used as proof that a domain is available.

A custom domain is not a prerequisite for the professional UI or technical SEO fixes and does not itself guarantee ranking gains. This recommendation preserves the user-requested portfolio project hosting while leaving a separately reviewed migration possible.

## Implementation and migration boundaries

For the recommended current-URL option:

1. Accept a single name in this PR before final logo production. PT-BRAND-003 creates the original logo/wordmark/favicon/social assets.
2. PT-UI-001/002/003 and PT-SEO-005 apply the accepted identity consistently to home, tool headers, footers, page titles, share cards, source presentation and accessible labels. Keep MIT attribution and dependency notices accurate.
3. PT-SEO-002 continues using `/pdf-tools/` and the original tool slugs for links, generated pages, canonical/OG URLs, sitemap, PDF.js workers/fonts/WASM and refresh behavior.
4. PT-SEO-008 verifies the existing URL-prefix property; there is no name-based second site to index. PT-BQA-001/002 check the final deployed identity and route/asset behavior.
5. Do not alter the portfolio root repository, root robots rules, sibling routes or root domain settings to implement a display-name change. PR #43's inspector work remains independent.

If a custom domain is later separately approved, prepare a scoped migration PR and read the current [GitHub custom-domain overview](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages), [configuration guidance](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) and [Google URL-move guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes):

- Record ownership, renewal responsibility, the final canonical origin/base and one-to-one old/new URL mappings for every working tool. Verify the domain before attaching it and follow the host's documented DNS/HTTPS setup. Do not change the portfolio's user-site domain to brand one project.
- Update build/router base, static entries, all canonical/OG/sitemap URLs, internal links and worker/font/WASM paths together. Inventory existing hard-coded `/pdf-tools/` assumptions before choosing a root-path deployment.
- Verify actual old-URL redirects/status/location and deep-route refreshes rather than assuming GitHub redirects preserve our intended path mapping. GitHub Pages does not provide arbitrary server redirect rules; if requirements exceed its behavior, choose an appropriate host/redirect layer in that later design.
- Verify the new property and migration reports in Search Console using the method supported for the actual move, retain the old site's access/redirects as needed, and monitor canonical/indexing behavior. Do not publish two independently indexable copies with conflicting canonicals.
- Run route/asset/privacy smoke checks on production, confirm sibling sites still work, and prepare a tested rollback. A separate origin requires reevaluating any allowed UI-preference storage and service-worker scope; it does not complete a security audit.

No migration, purchase, DNS/Pages settings change, tracking integration, new account or runtime rename is included here.

## Acceptance record

- [x] Compared retaining PDF Tools with four distinctive-name candidates and recorded visible category conflicts.
- [x] Recorded preferred name, English tagline, German draft and claim constraints.
- [x] Checked GitHub/social naming signals and explicitly recorded unverified availability.
- [x] Compared the current path, optional custom domain and renamed path, with dated registration/pricing evidence and limitations.
- [x] Documented canonical, route, asset and sibling-project implications and handoffs.
- [ ] Owner selects the proposed identity through review/merge (or edits the choice before merge).

Tracker state should be **Review**, not Done, until owner acceptance. Next in this brand workstream after acceptance: **PT-BRAND-003 — original logo and brand asset kit**. Domain migration remains deferred even if the name is accepted.
