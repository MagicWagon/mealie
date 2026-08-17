import type { Recipe, RecipeCategory, RecipeTag } from "~/lib/api/types/recipe";

export type OrganizerOperation = "add" | "remove";

export interface RecipeOrganizerSelection {
  tags: RecipeTag[];
  recipeCategory: RecipeCategory[];
}

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
