# PT-OPS-001 — Contributor pull-request and tracker workflow

This is the project workflow for `Akshat4112/pdf-tools`. Every implementation is scoped to a single tracker ID and a reviewable pull request. The live tracker is [PDF Tools — Project Plan and Task Backlog](https://docs.google.com/spreadsheets/d/1m3iyaksGD-hY51JwFfIzb-JS5S3GSp0uJqS4Ae77-lg/edit).

## Task lifecycle

1. **Planned:** confirm dependencies and acceptance criteria in the Tasks tab. If a dependency is not Done, pick a different unblocked task. Confirm there is no existing open PR before starting.
2. **Implementation:** branch from the current `main` as `feat/<task-id>-short-topic`, `fix/...`, `test/...` or `docs/...`. Never commit directly to main.
3. **Review:** open a PR whose title/body includes the task ID, scope, evidence, current risks, and tests run. Put the PR URL in the tracker and set status **Review**. Do not call tests passing until the exact head SHA has a completed successful run.
4. **Done:** after GitHub confirms the PR is merged, set **Done** and record merge commit/date. If changes are only partially implemented, keep the task under review or split new tracker work rather than reporting full completion.
5. **Blocked:** record the blocker and required next action in Verification. The tracker uses existing status values; do not silently mark an unshipped task Done.

## PR body template

```markdown
## Task
PT-XXX-000 — name; linked tracker row.

## Scope
What changed, user-visible behavior, and explicitly excluded follow-ups.

## Privacy and behavior
Document-data boundary, cleanup, and relevant app behavior changes (or "none").

## Acceptance criteria
List each acceptance item with evidence or a reason it remains open.

## Validation
Commands and counts, browser/device coverage, build/corpus results, exact commit SHA and CI URL. Clearly label anything not run.

## Review notes
Known limitations, migrations, accessibility checks, screenshots with synthetic data only, and dependencies.
```

## Merge gates

- Required build, lint, typing, unit and applicable browser/fixture tests pass at the reviewed head. Do not treat an old run as final.
- Any inline review findings are resolved, with code and tests updated where relevant.
- No leaked document content, filenames, passwords, screenshots with sensitive inputs, credentials or unauthorized upload/analytics/storage behavior.
- Verify that a task which changes copy, SEO or available tools still matches the released registry and documented privacy evidence.
- Ensure branch is based on current main where necessary; GitHub mergeability and CI must be rechecked after competing PRs merge.
- Only merge with a green reviewed head. An open PR is **Review**, not **Done**.

## Workflow while several tasks are underway

Independent tasks may have separate PRs simultaneously. Prefer finishing the oldest review and fixing failing CI, but continue an independent unblocked task when a run is pending. Do not merge one PR based on another branch's checks. Record dependency or shared-file conflicts explicitly, and rebase/merge main and rerun checks as necessary.

## Review and tracking example

- PT-SEC-002 → [PR #50](https://github.com/Akshat4112/pdf-tools/pull/50), merged and Done.
- PT-TRUST-001 → [PR #51](https://github.com/Akshat4112/pdf-tools/pull/51), merged and Done.
- Use the Tasks tab's **Issue / PR** and **Verification** columns for links and evidence. Do not add unapproved status values.

## Scope and privacy hygiene

Tests should use reproducible synthetic PDFs. Never attach a user's private documents to issues/PRs or CI artifacts. Request sanitized reproduction instructions and browser versions in public issues. Keep the repository's single-client local-processing and resource-cleanup promises under review for each new feature.

This workflow is governance documentation; it is not an automated GitHub branch-protection policy, and no claim is made that reviewers or CI enforce it unless repository settings are separately verified.
