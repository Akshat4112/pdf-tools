# PT-SEO-008 — Search Console setup and indexing readback

Status: **in progress; owner-account actions are pending**. A public crawl check cannot establish ownership, sitemap submission, Google indexing or Google's selected canonical. Do not mark the tracker task Done from this document or its readiness report alone.

## Property and sitemap

| Setting | Intended value |
| --- | --- |
| Property type | URL prefix |
| Exact property | `https://akshat4112.github.io/pdf-tools/` |
| Sitemap | `https://akshat4112.github.io/pdf-tools/sitemap.xml` |
| Hosting | Existing GitHub Pages project site; no domain change |
| Public prerequisite report | `PT-SEO-008-public-readiness.json` beside this document |

This prefix covers this project, including its tool and category routes. Keep the HTTPS protocol, `/pdf-tools/` path and final slash. A property for the whole GitHub Pages origin would include other projects; a Domain property requires DNS verification and is not the choice for this subdirectory. A custom domain remains a separate owner decision.

## Public readiness evidence

The report records the observation time, deployed sitemap, HTTP responses, HTML-declared canonicals, HTML/header indexing directives and origin robots check. It compares the deployed inventory with a local build from merge `05ead73f53ca1926a91ccc5b78ec267afa5427fd` (PR #68). Matching public prerequisites does not prove which commit is deployed or which URLs Google has indexed.

Reproduce from the repository root:

```sh
npm --prefix app ci
npm --prefix app run build
python3 -B -m unittest discover -s scripts -p test_search_console_readiness.py
python3 -B scripts/check_search_console_readiness.py
python3 -B scripts/check_search_console_readiness.py --live --output /tmp/pdf-tools-readiness.json
```

The live option sends credential-free GET requests only to this property's exact public sitemap/directory URLs and the shared origin's `/robots.txt`. It refuses cross-site redirects, query strings, fragments and noncanonical paths. It never opens, selects or uploads a document. Tests exercise rejected URLs, redirects, sitemap duplicates, canonical failures, noindex headers and implicit HTML heads. CI runs the offline check against each build; production checks remain explicit to avoid coupling PRs to deployment timing or network availability.

`/pdf-tools/robots.txt` does not govern crawling on a shared origin. The controlling file is `https://akshat4112.github.io/robots.txt`, owned by the separate website repository. A missing origin robots file is recorded as missing, not as a file published by this task. Broader origin changes require their own scope.

## Owner-account steps remaining

1. Sign in to Search Console using the intended site-owner Google account. First inspect the property selector: reuse this exact URL-prefix property if present, rather than creating a duplicate under another scope/account. Existing verified owner access may already cover it; read back that state.
2. If verification is required, choose HTML file verification and obtain Google's exact filename, bytes and required public URL. Do not invent a token. The expected project-root location maps to `app/public/<Google-provided-filename>.html`, copied unchanged by Vite to `dist/` and deployed beneath `/pdf-tools/`. If Google specifies an origin-root location outside this prefix, stop and resolve the property/method; do not modify the portfolio repository implicitly. HTML meta verification is an alternative only when explicitly selected from Google's verification options and supported in the static homepage source.
3. Review and deploy only the owner-provided public verification proof. Confirm its exact public content with a credential-free request, then click Verify and read back the ownership result. Keep the verification proof deployed. Never commit OAuth tokens, cookies, passwords or account recovery data. The intentionally public Google verification file/tag is distinct from these secrets.
4. In this exact property's Sitemaps report, submit the full sitemap URL above (or `sitemap.xml` when the UI already supplies the prefix). Reuse an existing submission if correct. Record the submitted URL, submission/read time, status, discovered-page count and any reported errors. An accessible XML file does not prove submission or processing success.
5. Inspect the priority URLs below. Record indexed-page results first; use Test live URL separately when needed. A successful live test is not proof of indexing or Google's selected canonical. Request indexing for representative changed URLs only when appropriate and permitted; repeated requests do not guarantee faster inclusion.

| Priority URL path beneath the property | Indexed result | Last crawl | User-declared canonical | Google-selected canonical | Live-test result / next action |
| --- | --- | --- | --- | --- | --- |
| `/` (property home) | Pending account readback | Unknown | Pending readback | Unknown | Pending |
| `merge/` | Pending account readback | Unknown | Pending readback | Unknown | Pending |
| `split/` | Pending account readback | Unknown | Pending readback | Unknown | Pending |
| `images-to-pdf/` | Pending account readback | Unknown | Pending readback | Unknown | Pending |
| `pdf-to-jpg/` | Pending account readback | Unknown | Pending readback | Unknown | Pending |
| `pdf-to-png/` | Pending account readback | Unknown | Pending readback | Unknown | Pending |
| `reader/` | Pending account readback | Unknown | Pending readback | Unknown | Pending |
| `pdf-to-text/` | Pending account readback | Unknown | Pending readback | Unknown | Pending |
| `tools/convert/` | Pending account readback | Unknown | Pending readback | Unknown | Pending |

Use only public route URLs in inspections. Do not paste document names, text, file URLs, query/fragment state or private session information into Google or the tracker. Search Console setup adds no on-site analytics, tag manager or session recording.

## Completion evidence

Before Done, replace the pending account fields with dated observations: verified ownership for the exact property; confirmed sitemap submission and its reported status; priority URL Inspection records including unavailable/no-data states and any needed fixes. Keep this task In progress while sign-in or owner proof is missing. Index inclusion and rankings are not guaranteed. PR #67's hosted structured-data validation remains a separate open item.

## Primary references

- [Property types and URL-prefix scope](https://support.google.com/webmasters/answer/34592?hl=en)
- [Ownership verification methods and preserving proof](https://support.google.com/webmasters/answer/9008080?hl=en)
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Request crawling and understand its limits](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
