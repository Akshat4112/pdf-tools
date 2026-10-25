# PT-SEC-003 — Dependency integrity, license and vulnerability gates

## Controls

- Direct application dependencies are pinned to fixed versions (TypeScript is currently the sole tilde-pinned dev tool, explicitly reviewed); the npm v3 lockfile tracks full resolved versions, integrity hashes and registry sources. CI uses `npm ci`.
- `node scripts/check_supply_chain.mjs --self-test --write-notices` validates package/lock synchronization, registry-based resolutions, integrity strings, SPDX license allowlist and known license exceptions. The generated inventory at `app/public/THIRD_PARTY_LICENSE_INVENTORY.txt` lists every locked package, including build-only packages. A shipping release must independently inspect bundled licenses and their attribution requirements: a license inventory alone is not a full reproduction of license texts.
- Production dependency audit remains `npm audit --omit=dev --audit-level=high` and fails on high/critical advisories. Lockfile CVE data is time-sensitive; refresh before a release and triage any exceptions with a written decision, expiry and mitigation. The current task grants no advisory exemptions.
- `MPL-2.0` appears in `lightningcss` and its platform variants. It is allowed only when `dev: true` in the lockfile and is NOT approved for shipped runtime dependencies. Zlib in the `pako` transitive graph is allowed as a permissive license. Changing license categorization requires review and a regression.
- The runtime/browser regression and privacy surface gates remain mandatory alongside dependency checks.

## GitHub Actions review

Existing workflows use `actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-python@v5`, plus deployment actions. They are tag-version references, **not immutable commit-SHA pins**. Changing action refs to full verified SHA pins and adding a verified notice-text inventory are additional supply-chain hardening opportunities; do not describe existing workflows as SHA-pinned. CI's `permissions: contents: read` and job-specific deployment permissions should be kept minimal. Updates must check publisher, release provenance, security advisories and required scopes.

## Dependency update procedure

1. Propose one narrowly scoped update PR. Check npm package provenance, license and direct/transitive vulnerability history, and assess whether new code goes into the shipped runtime or build only.
2. Change package manifest/lock together using lock-aware npm tooling; do not hand-edit transitive integrity hashes. Keep production runtime versions exact.
3. Re-run license gate, `npm audit --omit=dev --audit-level=high`, lint/typecheck/unit tests, browser output/privacy regression, and reproducible corpus checks.
4. Reassess generated inventory and original upstream license files/notice obligations. Preserve any applicable bundled notices and do not publish legal compliance guarantees without legal review.
5. Use exact reviewed head CI evidence, merge only after passing checks. Review advisories regularly and immediately for critical vulnerability reports.

## Negative gate exercises

- Removing a locked integrity field, switching a tarball URL to another host, changing a root dependency version, or declaring a runtime GPL/MPL dependency must fail.
- The script's `--self-test` exercises disallowed GPL/AGPL/unknown expressions and accepted permissive expressions; full mutation tests against a copied lockfile should be part of a follow-up gate enhancement.

This is a CI technical check, not a comprehensive source-code audit, legal review, SLSA certification, or automatic confirmation of GitHub Action publisher integrity.

## 2026-10-25 maintenance — Vite advisory remediation

Vite is pinned to 8.3.5, replacing 8.3.0. The older build tool was flagged by the full npm audit (including the Windows launch-editor issue [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) and related editor/server advisories). This is a development/build dependency; production-only audits did not cover it. The fixed version removes the currently reported advisory group, without an audit exemption or production PDF-engine update.

CI now additionally runs `npm audit --audit-level=high` across the full dependency graph. The separate production gate remains. Both audits are time-sensitive and do not establish permanent freedom from vulnerabilities. Rebuild the license inventory from the updated lockfile; validate the production build and existing output/privacy/browser suites before merging.
