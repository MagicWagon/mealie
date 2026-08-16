import type { Recipe, RecipeCategory, RecipeTag } from "~/lib/api/types/recipe";

export type OrganizerOperation = "add" | "remove";

export interface RecipeOrganizerSelection {
  tags: RecipeTag[];
  recipeCategory: RecipeCategory[];
}

export type RecipeOrganizerPatch = {
  id: string;
  tags?: RecipeTag[];
  recipeCategory?: RecipeCategory[];
};

type Organizer = RecipeTag | RecipeCategory;

function organizerKey(organizer: Organizer): string {
  if (organizer.id) {
    return `id:${organizer.id}`;
  }

  if (organizer.slug) {
    return `slug:${organizer.slug}`;
  }

  return `name:${organizer.name.trim().toLocaleLowerCase()}`;
}

function uniqueOrganizers<T extends Organizer>(organizers: readonly T[]): T[] {
  const seen = new Set<string>();
  return organizers.filter((organizer) => {
    const key = organizerKey(organizer);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function updateOrganizers<T extends Organizer>(
  existing: readonly T[] | null | undefined,
  selected: readonly T[],
  operation: OrganizerOperation,
): T[] {
  const current = [...(existing ?? [])];

  if (selected.length === 0) {
    return current;
  }

  if (operation === "remove") {
    const selectedKeys = new Set(selected.map(organizerKey));
    return current.filter(organizer => !selectedKeys.has(organizerKey(organizer)));
  }

  return uniqueOrganizers([...current, ...selected]);
}

function sameOrganizers(left: readonly Organizer[], right: readonly Organizer[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((organizer, index) => organizerKey(organizer) === organizerKey(right[index]!));
}

/**
 * Build the complete organizer payload used by the single-recipe editor.
 * Both fields are intentionally included so an empty selection clears that organizer type.
 */
export function buildSingleOrganizerPatch(selection: RecipeOrganizerSelection): Pick<Recipe, "tags" | "recipeCategory"> {
  return {
    tags: uniqueOrganizers(selection.tags),
    recipeCategory: uniqueOrganizers(selection.recipeCategory),
  };
}

/**
 * Build the partial payload for one recipe in a bulk organizer operation.
 * An organizer field is omitted when it was not selected or would not change.
 */
export function buildBulkOrganizerPatch(
  recipe: Recipe,
  selection: RecipeOrganizerSelection,
  operation: OrganizerOperation,
): RecipeOrganizerPatch | null {
  if (!recipe.id) {
    return null;
  }

  const patch: RecipeOrganizerPatch = { id: recipe.id };

  if (selection.tags.length > 0) {
    const nextTags = updateOrganizers(recipe.tags, selection.tags, operation);
    if (!sameOrganizers(recipe.tags ?? [], nextTags)) {
      patch.tags = nextTags;
    }
  }

  if (selection.recipeCategory.length > 0) {
    const nextCategories = updateOrganizers(recipe.recipeCategory, selection.recipeCategory, operation);
    if (!sameOrganizers(recipe.recipeCategory ?? [], nextCategories)) {
      patch.recipeCategory = nextCategories;
    }
  }

  return Object.keys(patch).length > 1 ? patch : null;
}

export function buildBulkOrganizerPatches(
  recipes: readonly Recipe[],
  selection: RecipeOrganizerSelection,
  operation: OrganizerOperation,
): RecipeOrganizerPatch[] {
  return recipes
    .map(recipe => buildBulkOrganizerPatch(recipe, selection, operation))
    .filter((patch): patch is RecipeOrganizerPatch => patch !== null);
}
