# PT-BQA-002 — Production release verification and rollback record

Status: **IN PROGRESS — no final deployment or public release acceptance claimed**.

## Reviewed code and evidence

- Baseline is PR #79 merge commit `bdea3d9b6c2dff51f8903c64bc995864df252e01`, containing the PT-BQA-001 automation and explicit 404 `noindex,nofollow` fix.
- Original PR exact-head checks, browser compatibility, and startup-performance workflows all concluded success.
- This task adds a read-only, repeatable production smoke via `node scripts/verify-production-release.mjs` (Node.js and Python 3, using the same standard-library robots parser as PT-SEO-008). This checks live HTML and crawler surfaces, not document upload, browser interactions, mobile rendering, or private account indexing.
- Production target: `https://akshat4112.github.io/pdf-tools/`. Verify the host and base path in the deployment settings before running.

## Release gate sequence

1. **Pin deployment SHA.** Check GitHub Actions Pages deploy run; record successful deploy workflow, run URL, published artifact/source SHA, deployed timestamp, and target root. Do not infer publication from PR merge alone.
2. **Static production smoke.** Run `node scripts/verify-production-release.mjs > production-smoke.json` from a network-enabled operator terminal. Verify no errors. It checks homepage branding and indexability, the controlling origin-root `/robots.txt`, project sitemap, every sitemap URL canonical/indexable, Help/Privacy/Trust/Limitations, and 404 noindex. Only URLs and status codes are recorded; no document content. A project-folder robots file does not control this shared origin, and the origin robots file need not advertise this project's sitemap. Missing origin robots (404) is recorded as absent; other non-200 statuses and disallowed Googlebot paths require review. Redirects are rejected. Do not change the separate portfolio website's robots policy as part of this task.
3. **Synthetic functional smoke.** Fresh desktop and mobile browsers: open merge, choose *synthetic* PDFs, merge, download, reopen with independent reader, reset, and confirm no outbound document-data request. Check at least one additional representative tool. Do not test with personal documents.
4. **Hosted validation.** Verify JSON-LD using a hosted validator; read real HTTPS responses and deep-links, CSS/JS/icons, no-JS page content, and cache behavior. Record sanitized results.
5. **Manual owner gates.** Explicitly record native Safari/Edge, iOS/Android, assistive technology/200% zoom, legal/publisher privacy approval, and Search Console property verification, sitemap submission and URL Inspection. Missing evidence is BLOCKED, not PASS.
6. **Rollback.** Before release, identify previously successful Pages deployment SHA and its workflow URL. To roll back, redeploy the previous reviewed artifact/commit through the approved workflow, repeat the production smoke, and record restoration. Never imply a rollback occurred without a workflow run and real production readback.

## Evidence register — fill only with actual observations

| Gate | Current state | Evidence |
| --- | --- | --- |
| Reviewed baseline | PASS (code only) | PR #79 merged as `bdea3d9b` |
| Live Pages deployment SHA and workflow | PASS (deployment job readback) | `e35c25db04a187081f6a2a635d38ebe3bf6fcd15`; [deploy run 40947400982](https://github.com/Akshat4112/pdf-tools/actions/runs/40947400982), deployment job completed 2026-10-29 20:16:36 UTC; source SHA agrees with latest successful main checks |
| Read-only public smoke | PASS (static checks only) | [2026-10-29 sanitized report](2026-10-29-static-production-smoke.json), observed 21:08:31 UTC: all 28 sitemap URLs HTTP 200 with matching canonical/indexability checks, required public pages/404 pass, origin robots HTTP 200 permits Googlebot; no issues |
| Download/reset synthetic browsers | PASS (Chromium desktop and Pixel 7 emulation only) | [2026-10-29 sanitized functional report](2026-10-29-functional-production-smoke.json), observed 21:12:27 UTC: merge/download/reset, independent qpdf structure check and 2-page count, exact synthetic text export; no external/body-bearing/document-marker requests observed; local/session storage empty after reset. Not physical-device or native-browser evidence. |
| Native mobile/AT/zoom | BLOCKED | Owner/device evidence |
| Legal/publisher disclosure | BLOCKED | Owner approval |
| Hosted schema validation | BLOCKED | Validator readback |
| Search Console | BLOCKED | Owner/account access |
| Rollback candidate and drill | CANDIDATE VERIFIED; DRILL NOT RUN | Previous source `ade4131aee204cf9ec391d478a75373d9a81a376`, [successful deploy run 40714904640](https://github.com/Akshat4112/pdf-tools/actions/runs/40714904640), 2026-10-28. This is a previously deployed source candidate, not a retained-artifact guarantee or performed rollback. Rebuild/redeploy through the workflow and repeat smoke only when rollback is authorized. |

## 2026-10-29 verification correction

The initial production smoke at 21:05:05 UTC failed because it demanded `/pdf-tools/robots.txt` (HTTP 404) and a sitemap advertisement there. That was a verifier error: PT-SEO-008 already identifies the controlling file as the shared origin's `/robots.txt`. Independent readback found that file HTTP 200 with `User-agent: *`, empty `Disallow`, and the portfolio-root sitemap. The corrected smoke above passed without modifying production or sibling-project policy. Twelve offline regression tests cover origin/missing robots, blocking and user-agent-specific policies, unrelated sibling rules, unavailable robots, redirect refusal, out-of-property sitemap URLs, wildcard/end-anchor policies, overlapping Allow/Disallow paths, repeated groups and unsupported user-agent names; CI runs them.

**Conservative robots limitation:** Python's standard-library `RobotFileParser` does not implement Google's full wildcard, end-anchor, longest-match and group-merging semantics. This verifier therefore requires manual review for repeated user-agent names, names other than exact `*` or `Googlebot`, any rule path containing `*` or `$`, or overlapping nonempty Allow/Disallow path prefixes, even across user-agent groups. It does not interpret those policies as a pass and does not claim complete robots compliance. The observed empty-Disallow origin policy is unaffected. See [Google's robots specification](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec).

Deployment artifact readback: `github-pages` artifact `12929493263`, SHA-256 digest `8174d499d4f0d277c5ebf77d631475d2a749be0b95edca54d1cd76e7ee930aad`, created 2026-10-29 20:16:20 UTC for `e35c25db`. This confirms GitHub's deployment provenance; the static public checks do not independently prove every live asset byte equals that artifact.

**Decision: release sign-off withheld.** This checklist is not a certification of privacy, accessibility, SEO indexing, or deployment. Work is ready for owner/account/manual completion once automation and production evidence are collected.
