# PT-BQA-002 — Production release verification and rollback record

Status: **IN PROGRESS — no final deployment or public release acceptance claimed**.

## Reviewed code and evidence

- Baseline is PR #79 merge commit `bdea3d9b6c2dff51f8903c64bc995864df252e01`, containing the PT-BQA-001 automation and explicit 404 `noindex,nofollow` fix.
- Original PR exact-head checks, browser compatibility, and startup-performance workflows all concluded success.
- This task adds a read-only, repeatable production smoke via `node scripts/verify-production-release.mjs`. This checks live HTML and crawler surfaces, not document upload, browser interactions, mobile rendering, or private account indexing.
- Production target: `https://akshat4112.github.io/pdf-tools/`. Verify the host and base path in the deployment settings before running.

## Release gate sequence

1. **Pin deployment SHA.** Check GitHub Actions Pages deploy run; record successful deploy workflow, run URL, published artifact/source SHA, deployed timestamp, and target root. Do not infer publication from PR merge alone.
2. **Static production smoke.** Run `node scripts/verify-production-release.mjs > production-smoke.json` from a network-enabled operator terminal. Verify no errors. It checks homepage branding and indexability, robots+sitemap, every sitemap URL canonical/indexable, Help/Privacy/Trust/Limitations, and 404 noindex. Only URLs and status codes are recorded; no document content.
3. **Synthetic functional smoke.** Fresh desktop and mobile browsers: open merge, choose *synthetic* PDFs, merge, download, reopen with independent reader, reset, and confirm no outbound document-data request. Check at least one additional representative tool. Do not test with personal documents.
4. **Hosted validation.** Verify JSON-LD using a hosted validator; read real HTTPS responses and deep-links, CSS/JS/icons, no-JS page content, and cache behavior. Record sanitized results.
5. **Manual owner gates.** Explicitly record native Safari/Edge, iOS/Android, assistive technology/200% zoom, legal/publisher privacy approval, and Search Console property verification, sitemap submission and URL Inspection. Missing evidence is BLOCKED, not PASS.
6. **Rollback.** Before release, identify previously successful Pages deployment SHA and its workflow URL. To roll back, redeploy the previous reviewed artifact/commit through the approved workflow, repeat the production smoke, and record restoration. Never imply a rollback occurred without a workflow run and real production readback.

## Evidence register — fill only with actual observations

| Gate | Current state | Evidence |
| --- | --- | --- |
| Reviewed baseline | PASS (code only) | PR #79 merged as `bdea3d9b` |
| Live Pages deployment SHA and workflow | NOT VERIFIED | Requires GitHub Actions deployment readback |
| Read-only public smoke | NOT VERIFIED | Script authored; must execute against network-accessible production |
| Download/reset synthetic browsers | NOT VERIFIED in production | CI is not production evidence |
| Native mobile/AT/zoom | BLOCKED | Owner/device evidence |
| Legal/publisher disclosure | BLOCKED | Owner approval |
| Hosted schema validation | BLOCKED | Validator readback |
| Search Console | BLOCKED | Owner/account access |
| Rollback candidate and drill | NOT VERIFIED | Record prior successful deployment and smoke |

**Decision: release sign-off withheld.** This checklist is not a certification of privacy, accessibility, SEO indexing, or deployment. Work is ready for owner/account/manual completion once automation and production evidence are collected.
