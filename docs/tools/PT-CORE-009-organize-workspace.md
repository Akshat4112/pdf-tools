# PT-CORE-009 — Organize and Rotate workspace

Task: Ship Organize PDF workspace. Features: PT-FT-003 and PT-FT-006.
Dependencies: PT-CORE-008, PT-CORE-006 and PT-UX-003 (merged).

## User workflow

1. Open Organize PDF or Rotate PDF and choose a local PDF. The original is retained unchanged.
2. Organize: drag a page handle onto another output position, use Earlier/Later buttons with touch or keyboard, or select one page and enter its target position.
3. Select thumbnails to rotate multiple pages left/right in 90° steps. Select all rotates the complete document. Each page also has a Rotate control.
4. Organize: duplicate a page immediately after itself or delete pages deliberately. Copies have independent identities and orientations. The only/all pages cannot be deleted, and duplication stops at the 300-page output limit.
5. Undo restores the exact previous plan (up to 50 changes). Restore original pages is itself undoable. Replacement, Clear files and Start over discard the history.
6. Review the complete output source order, absolute rotations, duplicate count and removed source pages. Removing source pages requires confirmation tied to the current file and complete plan. Any edit/undo invalidates that confirmation.
7. Create the new copy. Download is offered only after verification. Start over clears files, edits, history and outputs; Back returns to the catalog.

Rotate uses the same editor and export checks, with reorder/duplicate/delete controls omitted and a flow guard requiring every source page in original order.

## Preview and export fidelity

- The immutable reducer is the sole editor plan. Stable instance IDs distinguish duplicated pages; source page numbers always refer to the original PDF.
- Source rotations are read before editing. Left/right changes compose with those rotations, normalized to 0/90/180/270°.
- PDF.js renders each thumbnail using the plan's **absolute final rotation**. At most eight canvases are mounted, each bounded to a 280×360 pixel envelope. Pagination changes only the view, never the plan.
- Export snapshots the plan before asynchronous work and passes it to the existing `organizePdf` engine.
- Before success, the independent reader checks the output count and each position's expected rotation, displayed page dimensions and text. Structure/magic/trailer verification also gates the download.
- No full preservation of document-level forms, bookmarks or signatures is claimed. The UI explains that document-level forms/bookmarks may not survive and edits can invalidate digital signatures. Image-only page identity is covered by the writer's source-copy operation, not inferred from text verification.

## Lifecycle and privacy

Source bytes, document handles, edit plans, history and verified outputs remain in memory. No document data is written to URLs, localStorage, IndexedDB or a server. Preview renders are cancelled and canvases cleared on teardown; document readers are destroyed on replacement/exit. Jobs are session-tracked and cancelled on reset/exit. Stale callbacks are checked against both mount state and job identity, so late results cannot reappear after reset. Download object URLs are reused and revoked on every reset path.

## Verification

From `app/`:

```sh
npm ci
npm run lint
npm test
npx tsc -p tsconfig.test.json --noEmit
npm run build
npx playwright install --with-deps chromium
npm run test:pages-ui
```

On constrained machines, `npm test -- --maxWorkers=2` limits concurrent reader startup. An already installed Chromium can be selected with `PDF_TOOLS_CHROMIUM_PATH`.

| Requirement | Evidence |
| --- | --- |
| Drag/touch/keyboard reorder | Pointer capture on drag handles with drop highlighting; browser tests for desktop drag, browser-emulated touch drag and Earlier/Later, keyboard controls and cross-pagination target-position moves |
| Rotate/duplicate/delete/undo | Reducer regressions plus complete browser edit/undo/restore stories |
| Thumbnail state matches export | Real orientation-aware canvas assertion, page marker/order readback, mixed-size and pre-rotated output geometry/rotation checks |
| Deliberate deletions and quotas | Only/all-page delete blocked; 300-page duplication guard; file/plan-bound confirmation invalidated after edits |
| Recovery/reset/privacy | Malformed/encrypted input recovery, cancelled pending job with a fresh successful run, output URL revocation, route/reset state clearing; browser tests reject external requests |

Only synthetic repository fixtures are used. Browser coverage runs Chromium at desktop and mobile emulated viewports; physical mobile devices and Safari/Firefox remain later QA coverage. Traces, screenshots and videos are disabled in CI.

After this task merges: PT-CORE-010 — Implement JPG and PNG to PDF.
