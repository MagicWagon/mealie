import { flushPromises, shallowMount } from "@vue/test-utils";
import { ref } from "vue";
import RecipeCardSection from "../RecipeCardSection.vue";

const { api, fetchMore, alert } = vi.hoisted(() => ({
  api: {
    recipes: {
      search: vi.fn(),
    },
  },
  fetchMore: vi.fn(),
  alert: {
    error: vi.fn(),
  },
}));

vi.mock("~/composables/api", () => ({
  useUserApi: () => api,
}));

vi.mock("~/composables/recipes", () => ({
  useLazyRecipes: () => ({
    fetchMore,
    getRandom: vi.fn(),
  }),
}));

vi.mock("~/composables/use-logged-in-state", () => ({
  useLoggedInState: () => ({ isOwnGroup: { value: true } }),
}));

vi.mock("~/composables/use-users/preferences", () => ({
  useUserSortPreferences: () => ref({
    orderBy: "created_at",
    orderDirection: "desc",
    sortIcon: "sort",
    useMobileCards: false,
  }),
}));

vi.mock("~/composables/use-toast", () => ({
  alert,
}));

const stubs = {
  VBtn: {
    inheritAttrs: false,
    emits: ["click"],
    props: ["disabled", "loading"],
    template: "<button :disabled='disabled' @click='$emit(\"click\")'><slot /></button>",
  },
  VMenu: {
    template: "<div><slot name='activator' :props='{}' /><slot /></div>",
  },
  VRow: {
    template: "<div><slot /></div>",
  },
  VCol: {
    template: "<div><slot /></div>",
  },
  ContextMenu: {
    template: "<div data-view-toggle />",
  },
  RecipeCard: {
    template: "<div />",
  },
  RecipeCardMobile: {
    template: "<div />",
  },
  RecipeQuickOrganizeDialog: {
    template: "<div />",
  },
};

const visibleRecipe = {
  id: "visible-recipe",
  slug: "visible-recipe",
  name: "Visible Recipe",
  description: "",
  rating: 0,
  image: null,
  tags: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function mountSection(query: Record<string, unknown> = {}) {
  vi.stubGlobal("useDisplay", () => ({ smAndDown: ref(false), xs: ref(false) }));
  vi.stubGlobal("useMealieAuth", () => ({ user: { value: { groupSlug: "group" } } }));
  vi.stubGlobal("useRoute", () => ({ params: { groupSlug: "group" }, path: "/recipes" }));
  vi.stubGlobal("useRouter", () => ({ push: vi.fn() }));
  vi.stubGlobal("useScrollPosition", () => ({
    savePosition: vi.fn(),
    getSavedPage: vi.fn(() => 0),
    restorePosition: vi.fn(),
  }));
  vi.stubGlobal("useNuxtApp", () => ({
    $globals: {
      icons: {
        tags: "tags",
        diceMultiple: "random",
        checkboxMultipleBlankOutline: "select",
        checkboxMultipleMarkedOutline: "select-all",
        organizers: "organize",
        close: "close",
        eye: "eye",
      },
    },
  }));

  fetchMore.mockResolvedValue([]);
  return shallowMount(RecipeCardSection, {
    props: {
      recipes: [visibleRecipe],
      query,
      quickOrganize: true,
    },
    global: {
      mocks: {
        $globals: {
          icons: {
            tags: "tags",
            diceMultiple: "random",
            checkboxMultipleBlankOutline: "select",
            checkboxMultipleMarkedOutline: "select-all",
            organizers: "organize",
            close: "close",
            eye: "eye",
          },
        },
        $vuetify: {
          display: {
            xs: false,
            smAndDown: false,
          },
        },
      },
      stubs,
    },
  });
}

function buttonByText(wrapper: ReturnType<typeof mountSection>, text: string) {
  return wrapper.findAll("button").find(button => button.text().includes(text));
}

describe("RecipeCardSection selection requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.recipes.search.mockReset();
  });

  it("places Select immediately before the desktop view-toggle menu", async () => {
    const wrapper = mountSection();
    await flushPromises();

    const selectButton = buttonByText(wrapper, "Select");
    const viewToggle = wrapper.get("[data-view-toggle]");
    expect(selectButton).toBeDefined();
    expect(selectButton!.element.compareDocumentPosition(viewToggle.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("discards a stale Select All response after the query changes", async () => {
    const recipeA = { id: "recipe-a", slug: "recipe-a" };
    const requestA = deferred<{ data: { items: typeof recipeA[] }; error: null }>();
    api.recipes.search.mockReturnValueOnce(requestA.promise);
    const wrapper = mountSection({ search: "a" });
    await flushPromises();

    await buttonByText(wrapper, "Select")!.trigger("click");
    await buttonByText(wrapper, "Select All Results")!.trigger("click");
    await wrapper.setProps({ query: { search: "b" } });
    requestA.resolve({ data: { items: [recipeA] }, error: null });
    await flushPromises();

    expect(wrapper.text()).toContain("0");
    expect(alert.error).not.toHaveBeenCalled();
  });

  it("keeps a newer Select All spinner and selection safe from an older response", async () => {
    const recipeA = { id: "recipe-a", slug: "recipe-a" };
    const recipeB = { id: "recipe-b", slug: "recipe-b" };
    const requestA = deferred<{ data: { items: typeof recipeA[] }; error: null }>();
    const requestB = deferred<{ data: { items: typeof recipeB[] }; error: null }>();
    api.recipes.search.mockReturnValueOnce(requestA.promise).mockReturnValueOnce(requestB.promise);
    const wrapper = mountSection({ search: "a" });
    await flushPromises();

    await buttonByText(wrapper, "Select")!.trigger("click");
    await buttonByText(wrapper, "Select All Results")!.trigger("click");
    await wrapper.setProps({ query: { search: "b" } });
    await buttonByText(wrapper, "Select All Results")!.trigger("click");

    requestA.resolve({ data: { items: [recipeA] }, error: null });
    await flushPromises();
    expect(wrapper.text()).toContain("0");

    requestB.resolve({ data: { items: [recipeB] }, error: null });
    await flushPromises();
    expect(wrapper.text()).toContain("1");
  });
});
