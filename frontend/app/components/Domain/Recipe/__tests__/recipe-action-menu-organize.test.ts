import { shallowMount } from "@vue/test-utils";
import RecipeActionMenu from "../RecipeActionMenu.vue";

vi.mock("../RecipeContextMenu/RecipeContextMenu.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../RecipeFavoriteBadge.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../RecipeTimelineBadge.vue", () => ({
  default: { template: "<div />" },
}));

const globals = {
  icons: {
    alertCircle: "alert",
    close: "close",
    codeBraces: "code",
    delete: "delete",
    organizers: "organizers",
    save: "save",
  },
};

const stubs = {
  VBtn: {
    inheritAttrs: false,
    template: "<button v-bind='$attrs'><slot /></button>",
  },
};

function mountActionMenu(canEdit = true) {
  return shallowMount(RecipeActionMenu, {
    props: {
      recipe: { id: "recipe-id", name: "Recipe", slug: "recipe" },
      slug: "recipe",
      open: true,
      name: "Recipe",
      loggedIn: true,
      recipeId: "recipe-id",
      canEdit,
    },
    global: {
      mocks: {
        $globals: globals,
        $vuetify: { display: { xs: false } },
      },
      stubs,
    },
  });
}

describe("recipe editor organization action", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({ $globals: globals }));
  });

  it("opens the organizer while the recipe editor is active", async () => {
    const wrapper = mountActionMenu();
    const organizeButton = wrapper.findAll("button").find(button => button.text().includes("Organize"));

    expect(organizeButton).toBeDefined();
    await organizeButton!.trigger("click");
    expect(wrapper.emitted("organize")).toHaveLength(1);
  });

  it("hides the organizer when the recipe cannot be edited", () => {
    const wrapper = mountActionMenu(false);

    expect(wrapper.findAll("button").some(button => button.text().includes("Organize"))).toBe(false);
  });
});
