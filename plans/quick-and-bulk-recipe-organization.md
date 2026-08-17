# Quick and Bulk Recipe Organization

## Summary

Add a shared organizer dialog that edits tags and categories without entering full recipe edit mode. Reuse existing selectors and recipe PATCH APIs; no backend, database, or public API changes.

## Implementation Changes

- Create a reusable recipe organizer dialog with:
  - Existing `RecipeOrganizerSelector` fields for categories and tags.
  - Creation of new organizers enabled.
  - Explicit Save and Cancel actions.
  - Local copies so Cancel never mutates recipes.
- For one recipe, prefill both fields and save only `tags` and `recipeCategory` through `patchOne`.
- Add an Organize icon button:
  - On desktop and mobile main-screen recipe cards.
  - In the recipe-page action toolbar when the user can edit the recipe.
  - Stop the click from navigating into the recipe.
- Keep recipe cards displaying tags only; categories remain available inside the dialog.

## Bulk Organization

- Add a Select mode to the main recipe-grid toolbar.
  - Card clicks toggle selection instead of opening recipes.
  - Show selected count, Select all results, Organize, Clear, and Exit controls.
  - Clear selection when active search/filter criteria change.
- “Select all results” fetches every recipe matching the current search, filters, cookbook, and household constraints using the existing search endpoint with `perPage: -1`.
- Open the shared organizer dialog in bulk mode with Add or Remove selected.
  - Add unions chosen organizers into every recipe without duplicates.
  - Remove deletes chosen organizers where present and otherwise does nothing.
  - Empty tag or category fields leave that organizer type unchanged.
- Submit partial recipes containing only `id` and changed organizer fields through the existing `patchMany` API.
- On success, merge returned recipes into loaded cards, show the existing recipe-updated feedback, and exit selection mode.
- On failure, keep the dialog and selection open, show an error, and avoid applying optimistic UI changes.

## Interfaces and Localization

- Add internal card props/events for selection state and opening quick organization.
- Have the shared dialog accept one or more recipes plus single/bulk mode and emit updated recipes after a successful save.
- Add only necessary English strings—such as Remove and bulk organizer labels—to `en-US.json`; leave Crowdin-managed locales untouched.
- Do not change the existing Group Data → Recipes bulk screen.

## Test Plan

- Unit-test organizer transformations: add, remove, duplicate prevention, absent-item removal, and leaving empty organizer fields unchanged.
- Test individual Save, clearing all organizers, Cancel, creation of a new organizer, and failed-save behavior.
- Test desktop and mobile card actions, including preventing navigation while organizing or selecting.
- Test selection mode, filtered “Select all results,” selection reset after filter changes, and merging bulk results into loaded cards.
- Verify quick actions are hidden for public/non-owned group views and the recipe-page action respects existing edit permissions.
- Run frontend lint, type checking, and Vitest through the repository’s standard UI checks.

## Assumptions

- Bulk operations apply to all recipes matching the active search and filters, including unloaded results.
- Bulk replacement is intentionally excluded; only Add and Remove are supported.
- Successful bulk saves clear selection; canceling preserves it.
- Existing backend PATCH permission checks remain authoritative.
