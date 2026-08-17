# Quick and Bulk Recipe Organization: Pre-PR Review Plan

## Review outcome

The remediation resolves the previously identified data-integrity and navigation defects. The bulk organizer now preflights the complete request and commits once, stale Select All responses are rejected, recipe cards expose a native link outside selection mode, and the main-page **Select** action is immediately before the desktop view-toggle menu.

The branch is not ready to submit yet. One known fork-only file still has to be removed from the upstream PR, and both recipe-card variants need a small accessibility correction in selection mode. The remaining test gaps listed below should be closed before the final PR-ready run.

Review basis:

- Target: `upstream/mealie-next` at `44f8eda5`
- Reviewed branch: `agent/quick-and-bulk-recipe-organization`
- Reviewed state: four feature commits plus the current uncommitted remediation
- Combined scope: 25 tracked files, approximately 1,747 additions and 287 deletions, plus new untracked tests and planning documents

## Remaining findings

### 1. PR blocker: fork-specific image workflow remains in the upstream diff

Severity: **P1 for PR readiness** (repository scope, not an application-runtime defect)

Evidence:

- `.github/workflows/publish-custom-image.yml:6` triggers on the personal feature branch `agent/quick-and-bulk-recipe-organization`.
- `.github/workflows/publish-custom-image.yml:24` publishes to `ghcr.io/magicwagon/mealie`.
- The workflow requests `packages: write` and is introduced by commit `f0eaf5ea`.

Why this matters:

- It is specific to the contributor's fork and feature-testing workflow.
- It adds unrelated package-publishing behavior and permissions to the upstream project.
- Its branch trigger and registry owner would not represent a maintainable upstream configuration.

Resolution plan:

1. Finish the currently planned manual image testing.
2. Preserve the workflow on a fork-only branch if it remains useful for personal testing.
3. Remove `.github/workflows/publish-custom-image.yml` from the upstream PR's commit range. Prefer dropping or splitting commit `f0eaf5ea` rather than adding a compensating add/delete pair to the final history.
4. Do not generalize the workflow for upstream unless a maintainer explicitly requests that scope.
5. Verify that `git diff --name-status upstream/mealie-next...HEAD` no longer lists the workflow.

Acceptance criteria:

- The PR contains no references to `magicwagon`, the contributor feature-branch name, or the custom image tag.
- The PR does not introduce new package-publishing permissions or triggers.

### 2. Accessibility: selection-mode cards are focusable without an interactive role or state

Severity: **P2**

Evidence:

- `frontend/app/components/Domain/Recipe/RecipeCard.vue:13-16` makes the visual card focusable and handles only Enter.
- `frontend/app/components/Domain/Recipe/RecipeCardMobile.vue:14-16` does the same.
- The focusable card has no button/checkbox role, accessible name, or selected state.
- The nested selection buttons at `RecipeCard.vue:24-37` and `RecipeCardMobile.vue:24-37` use the generic label “Select” and do not expose whether the recipe is selected.

Impact:

- A screen reader encounters an extra focus target without knowing that it toggles recipe selection.
- The visual selected state is not conveyed programmatically.
- The custom card interaction supports Enter but not the Space key expected for button or checkbox behavior.

Recommended implementation:

1. Use the existing selection button as the single keyboard interaction target.
2. Remove selection-mode `tabindex` and custom key handling from the surrounding `v-card`; retain the broad card click target for pointer users.
3. Give the selection button a recipe-specific accessible label, such as “Select {recipe name}” / “Deselect {recipe name}”.
4. Add `:aria-pressed="selected"` to expose the current toggle state.
5. Preserve the visible selected icon and card styling.
6. Apply the same behavior to desktop and mobile cards.

Alternative implementation, if the entire card must remain keyboard-focusable:

- Give the card an appropriate role, accessible name, and `aria-checked` or `aria-pressed` state; support both Enter and Space; and remove the duplicate nested selection control so interactive elements are not nested conceptually.

Regression tests:

- Assert that selection mode has only one keyboard focus target for selection.
- Assert that its accessible label includes the recipe name and changes between select/deselect wording.
- Assert that `aria-pressed` reflects the `selected` prop.
- Assert that activation emits selection exactly once in desktop and mobile variants.

Acceptance criteria:

- Keyboard and assistive-technology users can identify the recipe, the action, and the current selection state.
- There is no unlabeled focusable card and no duplicate selection event.

## Verified remediations

### Atomic bulk organization

Status: **resolved**

- The frontend sends recipe IDs and organizer operations to `POST /api/recipes/bulk-actions/organize` rather than calling the generic per-recipe PATCH loop.
- The service loads all group-scoped recipes and organizers and validates edit permission for every target before mutation.
- The repository helper stages changes, commits once, and rolls back on failure.
- No-op and idempotent operations return no changed recipes.
- Tests prove that a valid target preceding a locked target is not partially updated and that a foreign/missing target leaves valid targets unchanged.

### Stale Select All response handling

Status: **resolved**

- A monotonically increasing generation and stable query snapshot guard selection writes.
- Query changes, selection clearing, selection exit, and component unmount invalidate pending work.
- An older request cannot replace selection or clear a newer request's loading state.
- Deferred-promise tests cover a filter change and overlapping old/new requests.

### Native recipe-card navigation

Status: **resolved, subject to manual browser QA**

- Desktop and mobile cards now contain a native `NuxtLink` navigation layer in normal mode.
- Selection mode removes the navigation link.
- Action controls remain above the link layer and stop navigation.
- Component tests cover native href exposure, organize-button isolation, selection activation, and selected icon state.

### Main-page Select action placement

Status: **resolved**

- `frontend/app/components/Domain/Recipe/RecipeCardSection.vue:103-125` renders **Select** immediately before the desktop `ContextMenu` that toggles the view.
- A component test verifies DOM order.

## Coverage work before submission

These are coverage gaps, not confirmed implementation defects. Close them before declaring the branch PR-ready.

### Backend integration coverage

1. Add an invalid/cross-group organizer test, not only a nonexistent organizer ID:
   - include at least one valid recipe and one tag or category belonging to another group;
   - expect the project-standard failure response;
   - verify every valid recipe remains unchanged.
2. Add event tests:
   - a successful changed batch queues one update event per changed recipe;
   - an idempotent/no-op batch queues none;
   - permission, target-resolution, and organizer-resolution failures queue none.
3. If practical, inject or simulate a repository failure after staging to prove the rollback path, not just preflight atomicity.

### Selection-race coverage

1. Exit selection mode while Select All is pending, resolve the request, and verify selection remains empty.
2. Unmount while Select All is pending and verify resolution causes no state update or alert.
3. Reject a stale request and verify no current-session error alert appears.
4. Reject the current request and verify the error alert appears, loading clears, and selection mode remains usable.
5. Resolve a current request directly and verify all matching recipes are selected.

### Dialog coverage

1. Cover successful bulk Remove independently of the existing failed-remove case.
2. Assert a successful bulk response is emitted once, the dialog closes once, and returned recipes are forwarded unchanged.
3. Cover the single-recipe dialog path:
   - save both organizer fields;
   - clear all organizers;
   - include a newly created organizer;
   - retain the dialog and emit nothing on failure;
   - cancel without mutating the input recipe.
4. Assert repeated Save interaction cannot submit twice while loading.

### Browser-level card interaction matrix

Component stubs cannot validate real stacking and hit-testing. Run this matrix against the built application for both desktop and mobile card layouts:

- Primary click on card body navigates once.
- Cmd/Ctrl-click opens a background tab using native link behavior.
- Middle-click opens a background tab on desktop.
- Keyboard focus is visible and Enter activates the recipe link in normal mode.
- Favorite, rating, organizer, context-menu, and chip actions do not navigate.
- In selection mode, body click toggles selection and no part of the card navigates.
- The revised accessible selection control exposes its name and selected state.

## Branch and commit hygiene

The current remediation is not committed. The branch is also reported as 15 commits ahead of and 4 commits behind `origin/agent/quick-and-bulk-recipe-organization`.

Before opening the PR:

1. Review the 17 modified tracked files and the new untracked test files together; opening a PR from the current remote state would omit the remediation.
2. Decide which files under `plans/` belong in the PR. Exclude local planning artifacts if the upstream project does not conventionally accept them.
3. Commit the remediation separately from any history cleanup so reviewers can distinguish the safety fixes.
4. Remove or split out the custom workflow commit after manual image testing.
5. Fetch the latest upstream target and rebase or otherwise update the branch according to project policy.
6. Inspect the post-rebase range with `git range-diff` and the final patch with `git diff upstream/mealie-next...HEAD`.
7. If rebasing requires updating the contributor branch, use `--force-with-lease` only after confirming the remote branch contains no work that must be preserved.
8. Confirm `git status` is clean and `git diff --check upstream/mealie-next...HEAD` passes.

## Final validation gate

Repeat these checks after the accessibility fix, coverage additions, workflow removal, and upstream synchronization:

### Frontend

- Run the complete Vitest suite.
- Run the repository ESLint command.
- Run the production Nuxt build.
- Confirm no generated API type drift using the project's normal schema/type generation workflow.

### Backend

- Run Ruff lint and `ruff format . --check`.
- Run MyPy across `mealie`.
- Run the complete bulk-actions integration module.
- Run recipe repository, ownership, and cross-household suites.
- Run any broader backend suite required by the project's PR checklist or CI when time permits.

### Manual review

- Execute the card interaction matrix above at desktop and mobile breakpoints.
- Exercise Add and Remove across a multi-page filtered result set.
- Confirm a failed locked/missing/foreign target retains selection and shows an error without changing any recipe.
- Confirm successful results refresh loaded cards and exit selection mode exactly once.
- Review the final PR file list for fork-only artifacts and unrelated changes.

## Validation already completed for this review

- Frontend Vitest: **30 files, 268 tests passed**.
- Frontend ESLint: **passed**.
- Production frontend build: **passed**. It emitted non-blocking environment/network warnings while resolving fonts and under Node 24, but compilation completed successfully.
- Focused bulk-action integration module: **9 tests passed**.
- Recipe repository, ownership, and cross-household test selection: **67 tests passed**.
- Ruff lint on changed Python files: **passed**.
- Ruff formatting check across the repository: **675 files already formatted**.
- MyPy across `mealie`: **458 source files passed with no issues**.
- Combined patch whitespace check against `upstream/mealie-next`: **passed**.

## PR-ready definition

The branch is ready to submit when all of the following are true:

- The two remaining findings are resolved.
- The fork-only publishing workflow is absent from the upstream PR diff.
- The key coverage gaps are added or explicitly documented as an accepted risk in the PR description.
- Manual card and bulk-operation testing passes.
- Remediation and tests are committed and pushed.
- The branch is synchronized with the intended upstream target.
- The final file list contains only feature, test, generated-contract, and intentionally accepted documentation changes.
- All final validation commands pass from a clean worktree.
