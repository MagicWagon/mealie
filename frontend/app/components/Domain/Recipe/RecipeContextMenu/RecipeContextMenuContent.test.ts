import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, test, vi } from "vitest";
import RecipeContextMenuContent from "./RecipeContextMenuContent.vue";

const mocks = vi.hoisted(() => ({
  recipe: {
    id: "recipe-id",
    slug: "carnitas",
    name: "Carnitas",
    userId: "user-id",
    groupId: "group-id",
    householdId: "household-id",
    settings: { public: true },
  },
  group: {
    id: "group-id",
    preferences: { privateGroup: false },
  },
  household: {
    id: "household-id",
    groupId: "group-id",
    preferences: { privateHousehold: false },
  },
  groupRef: { value: null as unknown },
  householdRef: { value: null as unknown },
  userApi: {
    households: { getOne: vi.fn() },
    recipes: {
      getOne: vi.fn(),
      deleteOne: vi.fn(),
      duplicateOne: vi.fn(),
      share: {
        createOne: vi.fn(),
        getZipRedirectUrl: vi.fn(),
      },
    },
  },
  refreshGroup: vi.fn(),
  getShoppingLists: vi.fn(),
  executeAction: vi.fn(),
  alertError: vi.fn(),
}));

vi.mock("~/components/Domain/Recipe/RecipeDialogAddToShoppingList.vue", () => ({ default: { template: "<div />" } }));
vi.mock("~/components/Domain/Recipe/RecipeDialogPrintPreferences.vue", () => ({ default: { template: "<div />" } }));
vi.mock("~/components/Domain/Recipe/RecipeDialogPublicShare.vue", () => ({
  default: {
    props: ["modelValue", "link"],
    template: "<div v-if=\"modelValue\" data-testid=\"public-share-dialog\">{{ link }}</div>",
  },
}));
vi.mock("~/components/Domain/Recipe/RecipeDialogShare.vue", () => ({
  default: {
    props: ["modelValue"],
    template: "<div v-if=\"modelValue\" data-testid=\"token-share-dialog\" />",
  },
}));
vi.mock("~/composables/api", () => ({ useUserApi: () => mocks.userApi }));
vi.mock("~/composables/api/use-downloader", () => ({ useDownloader: () => vi.fn() }));
vi.mock("~/composables/shopping-list-page/use-add-to-shopping-list-dialog", () => ({
  useAddToShoppingListDialog: () => ({
    open: { value: false },
    shoppingLists: { value: [] },
    getShoppingLists: mocks.getShoppingLists,
  }),
}));
vi.mock("~/composables/use-group-recipe-actions", () => ({
  useGroupRecipeActions: () => ({ recipeActions: { value: [] }, execute: mocks.executeAction }),
}));
vi.mock("~/composables/use-groups", () => ({
  useGroupSelf: () => ({
    group: mocks.groupRef,
    actions: { refresh: mocks.refreshGroup },
  }),
}));
vi.mock("~/composables/use-households", () => ({
  useHouseholdSelf: () => ({ household: mocks.householdRef }),
}));
vi.mock("~/composables/use-logged-in-state", () => ({
  useLoggedInState: () => ({ isOwnGroup: { value: true } }),
}));
vi.mock("~/composables/use-toast", () => ({ alert: { error: mocks.alertError } }));

describe("RecipeContextMenuContent sharing", () => {
  beforeEach(() => {
    mocks.group.preferences.privateGroup = false;
    mocks.groupRef.value = mocks.group;
    mocks.householdRef.value = mocks.household;
    vi.stubGlobal("useMealieAuth", () => ({ user: { value: { groupSlug: "default", id: "user-id" } } }));
    vi.stubGlobal("useRoute", () => ({ params: { groupSlug: "default" } }));
    vi.stubGlobal("useRouter", () => ({
      push: vi.fn(),
      resolve: (path: string) => ({ href: path }),
    }));
    vi.stubGlobal("useNuxtApp", () => ({
      $globals: {
        icons: new Proxy({}, { get: (_target, key) => String(key) }),
      },
    }));
    vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));

    mocks.userApi.households.getOne.mockReset();
    mocks.userApi.households.getOne.mockResolvedValue({ data: mocks.household });
    mocks.refreshGroup.mockReset();
    mocks.alertError.mockReset();
  });

  test("opens the public link dialog after checking the recipe household", async () => {
    const wrapper = mount(RecipeContextMenuContent, {
      props: {
        slug: "carnitas",
        name: "Carnitas",
        recipeId: "recipe-id",
        recipe: mocks.recipe as never,
        useItems: { share: true } as never,
      },
      global: {
        stubs: {
          BaseDialog: true,
          BaseButton: true,
          MealPlanAddRecipeDialog: true,
          RecipeDialogAddToShoppingList: true,
          VList: { template: "<div><slot /></div>" },
          VListItem: {
            emits: ["click"],
            template: "<button type=\"button\" @click=\"$emit('click')\"><slot name=\"prepend\" /><slot /></button>",
          },
          VListItemTitle: { template: "<span><slot /></span>" },
          VIcon: { template: "<span><slot /></span>" },
          VDivider: true,
          VCardText: true,
          VTextField: true,
        },
      },
    });

    const shareItem = wrapper.findAll("button").find(button => button.text().includes("Share"));
    expect(shareItem).toBeDefined();
    await shareItem!.trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-testid=\"public-share-dialog\"]").text())
      .toBe("http://localhost:3000/g/default/r/carnitas");
    expect(mocks.userApi.households.getOne).not.toHaveBeenCalled();
    expect(mocks.alertError).not.toHaveBeenCalled();
  });

  test("opens the token dialog for a private recipe", async () => {
    mocks.group.preferences.privateGroup = true;
    const wrapper = mount(RecipeContextMenuContent, {
      props: {
        slug: "carnitas",
        name: "Carnitas",
        recipeId: "recipe-id",
        recipe: mocks.recipe as never,
        useItems: { share: true } as never,
      },
      global: {
        stubs: {
          BaseDialog: true,
          BaseButton: true,
          MealPlanAddRecipeDialog: true,
          VList: { template: "<div><slot /></div>" },
          VListItem: {
            emits: ["click"],
            template: "<button type=\"button\" @click=\"$emit('click')\"><slot name=\"prepend\" /><slot /></button>",
          },
          VListItemTitle: { template: "<span><slot /></span>" },
          VIcon: { template: "<span><slot /></span>" },
          VDivider: true,
          VCardText: true,
        },
      },
    });

    await wrapper.findAll("button").find(button => button.text().includes("Share"))!.trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-testid=\"token-share-dialog\"]").exists()).toBe(true);
    expect(wrapper.find("[data-testid=\"public-share-dialog\"]").exists()).toBe(false);
  });

  test("waits for missing group and recipe-household visibility data", async () => {
    mocks.groupRef.value = null;
    mocks.householdRef.value = { id: "current-household", groupId: "group-id" };
    mocks.refreshGroup.mockImplementation(async () => {
      await Promise.resolve();
      mocks.groupRef.value = mocks.group;
    });
    const wrapper = mount(RecipeContextMenuContent, {
      props: {
        slug: "carnitas",
        name: "Carnitas",
        recipeId: "recipe-id",
        recipe: mocks.recipe as never,
        useItems: { share: true } as never,
      },
      global: {
        stubs: {
          BaseDialog: true,
          BaseButton: true,
          MealPlanAddRecipeDialog: true,
          VList: { template: "<div><slot /></div>" },
          VListItem: {
            emits: ["click"],
            template: "<button type=\"button\" @click=\"$emit('click')\"><slot name=\"prepend\" /><slot /></button>",
          },
          VListItemTitle: { template: "<span><slot /></span>" },
          VIcon: { template: "<span><slot /></span>" },
          VDivider: true,
          VCardText: true,
        },
      },
    });

    await wrapper.findAll("button").find(button => button.text().includes("Share"))!.trigger("click");
    await flushPromises();

    expect(mocks.refreshGroup).toHaveBeenCalledOnce();
    expect(mocks.userApi.households.getOne).toHaveBeenCalledWith("household-id");
    expect(wrapper.find("[data-testid=\"public-share-dialog\"]").exists()).toBe(true);
  });
});
