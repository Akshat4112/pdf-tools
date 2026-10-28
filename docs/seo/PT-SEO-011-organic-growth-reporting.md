# PT-SEO-011 — Organic growth reporting and improvement loop

Status: **template ready for review; real Search Console baseline not yet available.** No analytics or visitor tracking is introduced.

## Measurement principles

Use aggregated Google Search Console property data only once PT-SEO-008 ownership and sitemap checks are complete. Never collect names, PDF contents, user file metadata, uploaded documents, sessions, or individual visitor behavior. No third-party analytics scripts are authorized by this task. Do not confuse site visits with Search Console clicks, or submitted URLs with indexed pages.

Store summaries in a maintainer-controlled, access-restricted reporting file, not the public repository. Do not publish raw query-level exports that might contain sensitive or personally identifying searches. The public repo may contain only this empty template and synthetic examples.

## Baseline (as of 2026-10-27)

| Metric | Value | Verification |
| --- | --- | --- |
| Search Console property verified | **Unknown / owner action pending** | PT-SEO-008 |
| Sitemap successfully submitted | **Unknown** | Search Console Sitemaps report |
| Indexed canonical pages | **No verified measurement** | Search Console Pages and URL Inspection |
| Search impressions, last 28 days | **No verified measurement** | Search Console Performance |
| Search clicks, last 28 days | **No verified measurement** | Search Console Performance |
| Search CTR | **Not calculated; no valid counts** | clicks / impressions when impressions > 0 |
| Average search position | **No verified measurement** | Search Console Performance; interpret cautiously |

Unknown does not mean zero. PR merges, sitemap availability and local crawl tests are not proof of Google indexing, impressions or clicks.

## 30 / 60 / 90 day review cadence

Time zero = **first verified Search Console baseline extraction date**, not the date of this document. Record calendar date, property type, site URL, country/device/search type filters and data availability. Search Console reporting has processing delays, and comparison periods must be aligned before trend claims.

| Review | Questions | Evidence | Action |
| --- | --- | --- | --- |
| Day 30 | Are intended canonical URLs indexed? Do impressions and clicks exist? | Coverage by page, sitemap submitted/seen, site queries and pages in 28-day window | Fix crawl/indexing, metadata, site availability and incorrect canonicals before content expansion |
| Day 60 | Which tool or guide URLs receive impressions but little engagement? Which queries mismatch page intent? | Compare two fully elapsed equal-length periods with identical filters | Improve titles, useful content, internal links and FAQs based on actual queries |
| Day 90 | Which changes improved discoverability and usefulness? Which problems persist? | Three review snapshots, page- and query-level aggregate trends, shipped-change log | Retain successful changes, prioritize remaining deficits, avoid extrapolating ranking guarantees |

## Recording template

- **Review ID and date:**
- **Property and verified URL scope:** 
- **Data extraction date, time zone, report lag:**
- **Search type, device/country/page filters:**
- **Period A / period B (same days, finalized data):**
- **Indexed known URLs / eligible canonical URLs:** unknown until verified
- **Clicks A / B:** unavailable
- **Impressions A / B:** unavailable
- **CTR A / B:** unavailable; if impressions=0 show N/A
- **Average position A / B:** unavailable
- **Top changing pages, reasons, user intent and source evidence:** unavailable
- **Top changing aggregate query themes (redact sensitive terms):** unavailable
- **Potential measurement caveats:** site property changes, missing data, search updates, device mix
- **Changes shipped since last check, with commits/PRs:**
- **Owner-approved prioritized backlog items and verification gate:**

## Triage rules

1. Indexability/canonical/sitemap or hosting errors first; assign a reproducible issue with affected public URL, Search Console state and source-test evidence.
2. High impressions with low CTR: inspect whether the snippet honestly addresses search intent; test focused metadata and visible-content edits. CTR shifts alone do not establish causality.
3. Queries indicating missing user guidance: propose a focused guide or FAQ using supported workflows and synthetic examples; do not advertise roadmap formats.
4. Low data volume: defer interpretation and record **insufficient evidence**, not a failed page.
5. Regression checks: run crawl/canonical/build tests for every SEO change; manual hosted validation for structured data and index status remains an external gate.

## Approval

Reporting method can be approved independently of the owner-controlled Search Console setup. **Do not mark PT-SEO-011 Done** until real baseline, reporting owner and review cadence are established, or tracker explicitly accepts a template-only milestone. Never promise Google rankings or indexed status.
