# Quick and Bulk Recipe Organization: Review Remediation Plan

## Objective

Make quick and bulk recipe organization safe to submit by resolving the data-integrity and navigation findings from review, moving the main-page **Select** action to the requested toolbar position, and adding regression coverage for the newly introduced workflows.

The custom GHCR publishing workflow is intentionally deferred until manual feature testing is complete.

## Scope and Decisions

### Included now

- Make bulk organizer changes atomic and permission-aware.
- Prevent stale “Select all results” responses from restoring recipes from an obsolete filter.
- Restore native link behavior for desktop and mobile recipe cards without allowing action buttons to navigate.
- Move **Select** immediately to the left of the desktop stacked `...` view-toggle menu.
- Add frontend and backend regression tests for the reviewed failure modes and the original feature test plan.
- Run the repository-standard frontend checks and focused backend integration tests.

### Deferred

- Do not modify or remove `.github/workflows/publish-custom-image.yml` during this remediation.
- After manual testing, decide whether to:
  - keep the workflow only on the fork,
  - remove it from the upstream PR commit range, or
  - generalize it to use the current repository and an appropriate long-lived trigger.

### Key implementation decision

Do not use the existing generic `PATCH /api/recipes` route for the bulk organizer operation. That route patches and commits recipes one at a time, so it cannot provide the required all-or-nothing result.

Add an organizer-specific bulk endpoint that accepts recipe IDs plus an add/remove operation and organizer selections. The server will:

1. Resolve every target recipe within the current group.
2. Validate edit permission for the complete target set before any mutation.
3. Calculate tag/category changes against current database state.
4. Apply all changed recipes in one database transaction.
5. Roll back the entire operation on any error.
6. Return the updated recipe summaries needed to refresh loaded cards.

This keeps the backend authoritative for permissions and avoids replacing tags or categories from stale client-side snapshots.

## Phase 1: Define the Bulk Organizer Contract

### Backend schemas

Add request/response models alongside the existing recipe bulk-action schemas, likely in `mealie/schema/recipe/recipe_bulk_actions.py`.

Proposed request shape:

```json
{
  "recipes": ["recipe-id-1", "recipe-id-2"],
  "operation": "add",
  "tags": [{ "id": "tag-id", "name": "Dinner", "slug": "dinner" }],
  "categories": [{ "id": "category-id", "name": "Main", "slug": "main" }]
}
```

Contract requirements:

- `recipes` is a non-empty, duplicate-free list of recipe UUIDs.
- `operation` is an enum with only `add` and `remove`.
- `tags` and `categories` default to empty lists.
- An empty organizer list means “leave this organizer type unchanged.”
- Organizer identity is based on ID; the endpoint must reject organizer IDs outside the user’s group.
- Duplicate organizer IDs in the request are normalized or rejected consistently.
- The response is a list of updated `RecipeSummary` objects, including recipes whose organizer data changed.
- A request that produces no changes succeeds with an empty response or a clearly documented unchanged response; the frontend behavior must match that decision.

### Frontend types and API client

Update the generated TypeScript recipe types through the project’s normal schema-generation workflow rather than manually editing generated interfaces.

Add a method to `frontend/app/lib/api/user/recipe-bulk-actions.ts`, for example `bulkOrganize`, using the new request and response types.

Acceptance criteria:

- The frontend no longer casts partial objects to `Recipe[]` for bulk organization.
- The API method’s response type accurately represents the updated recipes returned by the server.
- Single-recipe quick organization continues using the existing `patchOne` route.

## Phase 2: Implement Atomic, Permission-Aware Bulk Organization

### Route and service flow

Add `POST /api/recipes/bulk-actions/organize` in `mealie/routes/recipe/bulk_actions.py` and implement its logic in the appropriate recipe service layer.

Implementation sequence:

1. Reject an empty target list before querying.
2. Load every requested recipe in a single group-scoped query.
3. Compare requested IDs with returned IDs. If any target is absent or outside the group, fail before mutation.
4. Call the same permission rules used by normal recipe updates for the complete set:
   - recipe owner access,
   - recipe lock state,
   - cross-household edit policy,
   - administrator behavior, if applicable.
5. Resolve selected tag and category IDs from group-scoped repositories and fail before mutation if any organizer is invalid.
6. Build each recipe’s next organizer collections using current database relationships:
   - **Add:** union selected IDs with existing IDs without duplicates.
   - **Remove:** subtract selected IDs; absent organizers are a no-op.
   - Empty tags leave tags unchanged.
   - Empty categories leave categories unchanged.
7. Skip recipes whose organizer collections do not change.
8. Stage updates without per-recipe commits.
9. Commit once after all updates are staged.
10. Roll back the session on any exception.
11. Publish recipe-updated events only after a successful commit, grouped consistently with existing bulk events.
12. Return refreshed summaries for changed recipes.

### Repository considerations

- Do not call `RecipeService.patch_one` in a loop because it reaches repository methods that commit each item.
- Reuse or introduce a repository bulk-update helper that stages relationship changes and performs one commit.
- Ensure the helper verifies that every expected recipe was loaded; silently updating a subset is not acceptable.
- Keep the new helper scoped enough that it does not unintentionally alter the semantics of unrelated generic bulk PATCH callers.
- Use `try/except` around the transaction boundary and explicitly call `rollback()` before re-raising.

### Error behavior

- Permission failure: return `403`; change no recipes.
- Missing or cross-group recipe/organizer: return the project-standard not-found or permission response; change no recipes.
- Invalid operation or malformed payload: return `422`; change no recipes.
- Database failure: return the existing server error response; change no recipes.
- Do not publish update events for failed or rolled-back requests.

### Backend integration tests

Add focused tests under `tests/integration_tests/user_recipe_tests/` covering:

- Adding tags and categories to multiple editable recipes.
- Removing tags and categories from multiple editable recipes.
- Duplicate prevention and idempotent repeated requests.
- Empty tag/category selections leaving those fields unchanged.
- A no-op request returning the documented success result.
- A batch containing an owned recipe followed by a locked recipe returns `403` and leaves both recipes unchanged.
- A batch containing an editable recipe followed by a recipe blocked by cross-household policy leaves both unchanged.
- A missing or cross-group recipe ID leaves every valid target unchanged.
- An invalid or cross-group tag/category ID leaves every recipe unchanged.
- Events are emitted only for successfully committed changes.

The locked-recipe test must order the editable recipe first so it specifically proves that the former partial-commit behavior is gone.

## Phase 3: Switch the Dialog to the Atomic Endpoint

Update `frontend/app/components/Domain/Recipe/RecipeQuickOrganizeDialog.vue`.

### Bulk save behavior

- Replace `buildBulkOrganizerPatches` plus `api.recipes.patchMany(...)` with the new `bulkOrganize` API call.
- Send only:
  - selected recipe IDs,
  - `add` or `remove`,
  - selected tag objects/IDs,
  - selected category objects/IDs.
- Keep the dialog open and preserve selection on any error.
- Merge returned updated recipes only after a successful response.
- Close the dialog and exit selection mode only after success.
- For an empty organizer selection, disable Save or treat it as a documented no-op without claiming recipes were updated.
- Prevent double submission while the request is running.

### Organizer transform cleanup

After the backend becomes responsible for add/remove calculations:

- Retain `buildSingleOrganizerPatch` for single-recipe saves.
- Remove bulk transformation functions that are no longer used, or narrow the module name and exports to the single-recipe behavior.
- Replace frontend transformation tests with backend operation tests and dialog request-shape tests.

### Dialog tests

Add component tests for:

- Single Save sends both organizer fields and emits the updated recipe.
- Single Save can clear all tags and categories.
- Cancel closes without mutating the input recipe.
- A newly created organizer is included in Save.
- Single-save failure keeps the dialog open and emits nothing.
- Bulk Add sends recipe IDs, operation, tags, and categories to `bulkOrganize`.
- Bulk Remove sends the correct operation.
- Bulk failure keeps the dialog and parent selection open and emits nothing.
- Bulk success emits returned recipes exactly once and closes.
- Empty bulk selection cannot submit, or follows the documented no-op behavior.

## Phase 4: Invalidate Stale “Select All” Requests

Update `frontend/app/components/Domain/Recipe/RecipeCardSection.vue` so an obsolete request can never write to `selectedRecipes`.

### Request-generation mechanism

Introduce a monotonically increasing request generation/token, for example `selectAllGeneration`.

On `selectAllResults()`:

1. Increment the generation and capture the new value locally.
2. Capture a stable serialized snapshot of the active query.
3. Set loading for that generation.
4. Start the search request with the captured query and `perPage: -1`.
5. Before assigning results, verify:
   - the local generation is still current,
   - selection mode is still active,
   - the current serialized query still matches the snapshot.
6. Discard the response silently if any check fails.
7. In `finally`, clear loading only if the local generation is still current, so an old request cannot clear a newer request’s spinner.

Invalidate the active generation when:

- the search/filter query changes,
- selection mode is exited,
- selection is reset for a new selection session,
- the component unmounts.

When query changes invalidate an in-flight request, clear its loading state immediately so the user can select all for the new filter without waiting for the old request.

If the request wrapper cleanly supports `AbortController`, cancellation may be added as an optimization, but response-generation checks remain the correctness guard.

### Selection race tests

Add component tests using deferred promises:

- Start Select All for query A, change to query B, resolve A, and assert no A recipes are selected.
- After invalidating A, start Select All for B, resolve A before B, and assert A neither changes selection nor clears B’s loading state.
- Exit selection mode while Select All is pending, resolve it, and assert selection stays empty.
- Resolve a current request and assert all matching results are selected.
- Reject a stale request and ensure it does not show an error for the current selection session.
- Reject the current request and ensure the error toast appears while selection mode remains usable.

## Phase 5: Restore Native Card Links

Update both:

- `frontend/app/components/Domain/Recipe/RecipeCard.vue`
- `frontend/app/components/Domain/Recipe/RecipeCardMobile.vue`

### Structure

Separate navigation from action controls instead of turning the entire `v-card` into a manually handled pseudo-link.

Recommended structure:

- Keep the visual card as the positioning container.
- Add a real `NuxtLink`/router-link navigation layer for the card’s non-action area when a recipe route exists and selection mode is off.
- Give the link an accessible name containing the recipe name.
- Keep favorite, rating, organizer, context-menu, chip links, and selection controls outside or above the navigation layer so they are not nested interactive content.
- In selection mode, remove/disable the navigation link and let card activation toggle selection.
- Preserve a visible focus indicator for keyboard users.

An absolute “stretched link” is acceptable if:

- the card establishes a positioned containing block,
- the link covers the intended navigable area,
- action controls and recipe-chip links have a higher stacking context,
- there are no nested links or buttons,
- focus styling clearly identifies the whole card.

### Remove manual navigation

- Remove normal-mode `router.push` click handling.
- Remove synthetic `role="link"` and manual `tabindex` once a real link exists.
- Keep selection-mode click/keyboard handling separate from navigation.
- Ensure organizer clicks neither navigate nor toggle selection.
- Hide or disable the per-card organizer action while bulk selection mode is active so the single and bulk workflows cannot be confused.

### Navigation tests

Test desktop and mobile cards for:

- The native link has the expected `/g/{group}/r/{slug}` destination.
- Normal click activates navigation.
- Cmd/Ctrl-click and middle-click remain native link events and are not replaced with `router.push`.
- The link exposes an `href` for context menus and copying.
- Organizer, favorite, rating, context-menu, and tag interactions do not activate the recipe link.
- Selection mode removes/disables navigation and card activation toggles selection.
- Enter on the link navigates; keyboard activation of action buttons performs only their action.

## Phase 6: Move the Main-Page Select Button

Update the non-selection toolbar in `frontend/app/components/Domain/Recipe/RecipeCardSection.vue`.

Current desktop order:

1. Random
2. Sort
3. Stacked `...` context menu for Toggle View
4. Select

Required order:

1. Random
2. Sort
3. Select
4. Stacked `...` context menu for Toggle View

Implementation:

- Move the existing `v-btn` for `enterSelectionMode` immediately before the `ContextMenu` block.
- Preserve all existing visibility, disabled, icon-only, and localization behavior.
- Do not move the controls shown after selection mode has already been entered.
- On breakpoints where the view-toggle menu is hidden, keep Select in the existing logical position after Sort.

Add a shallow component assertion that, when both controls are visible, the Select button appears before the view-toggle context menu in DOM/tab order.

## Phase 7: Complete Feature-Level Regression Coverage

The existing tests cover organizer transforms and two card interactions but not the full feature lifecycle. In addition to the tests above, cover:

- Loaded-card selections and filtered Select All can be combined predictably.
- Search/filter changes clear existing selection immediately.
- Clear preserves selection mode but empties the selection.
- Exit clears selection and leaves normal navigation restored.
- Canceling bulk organization preserves the selected recipes.
- Successful bulk organization merges returned summaries into loaded cards and exits selection mode.
- Updated recipes not currently loaded do not create duplicate cards.
- Public and non-owned group views do not expose quick or bulk organization.
- Recipe-page quick organization remains gated by `canEditRecipe`.
- Locked recipes cannot be mutated through the bulk endpoint even if a client submits their IDs directly.

## Phase 8: Validation and Manual Test Checklist

### Automated checks

Run:

- `git diff --check`
- Frontend ESLint with zero warnings.
- Full frontend Vitest suite.
- Focused backend integration tests for recipe bulk organization and permissions.
- Any backend formatter/linter/type checks required for changed Python files.
- Production frontend build.

The repository currently lacks a configured Vue type checker. Do not claim type-check success unless `vue-tsc` or Golar is added and run through an approved project change.

### Manual tests

Use a group with at least two households and recipes in these states:

- owned and editable,
- another user’s unlocked editable recipe,
- another household’s recipe with cross-household edits disabled,
- a locked recipe,
- recipes with and without the selected tags/categories.

Verify:

- Bulk Add and Remove are correct and idempotent.
- A mixed batch containing one forbidden recipe changes none of the recipes.
- Failure keeps the dialog and selection open.
- Changing filters during Select All never selects recipes from the prior filter.
- Single quick organization still works from desktop card, mobile card, and recipe page.
- Native open-in-new-tab, middle-click, context-menu, and keyboard navigation work on both card variants.
- Card action buttons never navigate.
- The Select control is immediately left of the desktop stacked view-toggle menu.
- Mobile and narrow toolbar wrapping remains usable.

## Deferred Workflow Follow-Up

After the feature passes manual testing, review `.github/workflows/publish-custom-image.yml` before preparing the upstream PR.

Decision checklist:

- If the workflow is only for fork testing, keep it out of the upstream PR commit range.
- If it should be reusable upstream, replace the hardcoded registry with `ghcr.io/${{ github.repository }}` or another approved input and use an appropriate branch/event trigger.
- Confirm package permissions and runner availability in the target repository.
- Keep workflow cleanup in a separate commit so it can be dropped without altering feature commits.

No workflow edits are part of Phases 1–8.

## PR Preparation

After implementation and testing:

1. Review the final diff against `upstream/mealie-next` and confirm only intended feature, backend, test, localization, and plan files remain.
2. Decide whether the original planning document and this remediation plan belong in the submitted PR.
3. Remove or isolate the fork-specific workflow commit as decided above.
4. Reconcile the rebased local branch with the older fork branch using a deliberate `--force-with-lease` push only after verifying the remote head.
5. Summarize the atomicity guarantee, permission tests, request-race protection, and restored native link behavior in the PR description.

## Completion Criteria

This remediation is complete when:

- Bulk organizer operations are server-authoritative, permission-aware, and atomic.
- A failed batch demonstrably leaves every target unchanged.
- Stale Select All responses cannot modify current selection state.
- Desktop and mobile recipe cards use real links outside selection mode.
- Card action controls do not trigger navigation.
- The Select button appears immediately before the desktop view-toggle `...` menu.
- The specified frontend and backend regression tests pass.
- Manual multi-household and locked-recipe testing passes.
- The custom GHCR workflow remains unchanged pending the separate post-testing decision.
