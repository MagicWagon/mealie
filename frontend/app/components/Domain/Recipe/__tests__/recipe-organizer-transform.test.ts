import { describe, expect, it } from "vitest";
import { buildSingleOrganizerPatch } from "../recipe-organizer-transform";

describe("recipe organizer transformations", () => {
  it("includes both organizer fields for a single-recipe save", () => {
    expect(buildSingleOrganizerPatch({ tags: [], recipeCategory: [] })).toEqual({
      tags: [],
      recipeCategory: [],
    });
  });
});
