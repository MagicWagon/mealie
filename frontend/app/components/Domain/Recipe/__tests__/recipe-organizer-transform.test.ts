import { describe, expect, it } from "vitest";
import type { Recipe, RecipeCategory, RecipeTag } from "~/lib/api/types/recipe";
import {
  buildBulkOrganizerPatch,
  buildBulkOrganizerPatches,
  buildSingleOrganizerPatch,
} from "../recipe-organizer-transform";

const tag = (id: string, name = id): RecipeTag => ({ id, name, slug: name.toLowerCase() });
const category = (id: string, name = id): RecipeCategory => ({ id, name, slug: name.toLowerCase() });
const recipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: "recipe-1",
  slug: "recipe-1",
  tags: [tag("existing-tag")],
  recipeCategory: [category("existing-category")],
  ...overrides,
});

describe("recipe organizer transformations", () => {
  it("adds organizers without duplicates", () => {
    const patch = buildBulkOrganizerPatch(
      recipe(),
      { tags: [tag("existing-tag"), tag("new-tag")], recipeCategory: [category("new-category")] },
      "add",
    );

    expect(patch).toEqual({
      id: "recipe-1",
      tags: [tag("existing-tag"), tag("new-tag")],
      recipeCategory: [category("existing-category"), category("new-category")],
    });
  });

  it("removes selected organizers and leaves absent items alone", () => {
    const patch = buildBulkOrganizerPatch(
      recipe(),
      { tags: [tag("existing-tag"), tag("missing-tag")], recipeCategory: [category("missing-category")] },
      "remove",
    );

    expect(patch).toEqual({
      id: "recipe-1",
      tags: [],
    });
  });

  it("omits empty organizer fields from bulk patches", () => {
    const patch = buildBulkOrganizerPatch(
      recipe(),
      { tags: [], recipeCategory: [] },
      "add",
    );

    expect(patch).toBeNull();
  });

  it("builds patches only for recipes that change", () => {
    const patches = buildBulkOrganizerPatches(
      [recipe(), recipe({ id: "recipe-2", slug: "recipe-2", tags: [] })],
      { tags: [tag("new-tag")], recipeCategory: [] },
      "add",
    );

    expect(patches).toHaveLength(2);
    expect(patches[0]?.tags).toEqual([tag("existing-tag"), tag("new-tag")]);
    expect(patches[1]?.tags).toEqual([tag("new-tag")]);
  });

  it("includes both organizer fields for a single-recipe save", () => {
    expect(buildSingleOrganizerPatch({ tags: [], recipeCategory: [] })).toEqual({
      tags: [],
      recipeCategory: [],
    });
  });
});
