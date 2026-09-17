import { flushPromises, shallowMount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import RecipeCardSection from "../RecipeCardSection.vue";

let intersectionCallback: IntersectionObserverCallback | undefined;

class TestIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }

  observe() {}

  disconnect() {}
}

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
    template: "<button v-bind='$attrs' :disabled='disabled' :data-loading='loading ? true : undefined' @click='$emit(\"click\")'><slot /></button>",
  },
  VMenu: {
    template: "<div><slot name='activator' :props='{}' /><slot /></div>",
  },
  VRow: {
    template: "<div><slot /></div>",
  },
  VSlideYTransition: {
    template: "<div><slot /></div>",
  },
  VTooltip: {
    template: "<div><slot name='activator' :props='{}' /><slot /></div>",
  },
  VChip: {
    inheritAttrs: false,
    template: "<span v-bind='$attrs'><slot /></span>",
  },
  VCol: {
    template: "<div><slot /></div>",
  },
  ContextMenu: {
    template: "<div data-view-toggle />",
  },
  RecipeCard: {
    emits: ["click"],
    template: "<button data-recipe-card @click='$emit(\"click\")' />",
  },
  RecipeCardMobile: {
    emits: ["selected"],
    template: "<button data-recipe-card @click='$emit(\"selected\")' />",
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
  intersectionCallback = undefined;
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
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
        selectionRemove: "selection-remove",
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
            selectionRemove: "selection-remove",
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
    expect(buttonByText(wrapper, "Select All Results")?.attributes("data-loading")).toBe("true");

    requestB.resolve({ data: { items: [recipeB] }, error: null });
    await flushPromises();
    expect(wrapper.text()).toContain("1");
    expect(buttonByText(wrapper, "Select All Results")?.attributes("data-loading")).toBeUndefined();
  });

  it("clears loaded selections immediately when the active query changes", async () => {
    const wrapper = mountSection({ search: "a" });
    await flushPromises();

    await buttonByText(wrapper, "Select")!.trigger("click");
    await wrapper.get("[data-recipe-card]").trigger("click");
    expect(wrapper.text()).toContain("Selected: 1");

    await wrapper.setProps({ query: { search: "b" } });

    expect(wrapper.text()).toContain("Selected: 0");
  });

  it("keeps selection mode for Clear and restores normal mode on Exit", async () => {
    const wrapper = mountSection();
    await flushPromises();

    await buttonByText(wrapper, "Select")!.trigger("click");
    await wrapper.get("[data-recipe-card]").trigger("click");
    await buttonByText(wrapper, "Clear")!.trigger("click");

    expect(wrapper.text()).toContain("Selected: 0");
    expect(buttonByText(wrapper, "Exit Selection")).toBeDefined();

    await buttonByText(wrapper, "Exit Selection")!.trigger("click");

    expect(buttonByText(wrapper, "Select")).toBeDefined();
    expect(wrapper.text()).not.toContain("Exit Selection");
  });

  it("does not apply a pending Select All response after selection mode is exited", async () => {
    const recipe = { id: "recipe-a", slug: "recipe-a" };
    const request = deferred<{ data: { items: typeof recipe[] }; error: null }>();
    api.recipes.search.mockReturnValueOnce(request.promise);
    const wrapper = mountSection();
    await flushPromises();

    await buttonByText(wrapper, "Select")!.trigger("click");
    await buttonByText(wrapper, "Select All Results")!.trigger("click");
    await buttonByText(wrapper, "Exit Selection")!.trigger("click");

    request.resolve({ data: { items: [recipe] }, error: null });
    await flushPromises();

    expect(alert.error).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain("Selected: 1");
  });

  it("selects every recipe returned for the current query", async () => {
    const recipeA = { id: "recipe-a", slug: "recipe-a" };
    const recipeB = { id: "recipe-b", slug: "recipe-b" };
    const request = deferred<{ data: { items: typeof recipeA[] }; error: null }>();
    api.recipes.search.mockReturnValueOnce(request.promise);
    const wrapper = mountSection({ search: "recipes" });
    await flushPromises();

    await buttonByText(wrapper, "Select")!.trigger("click");
    await buttonByText(wrapper, "Select All Results")!.trigger("click");
    request.resolve({ data: { items: [recipeA, recipeB] }, error: null });
    await flushPromises();

    expect(wrapper.text()).toContain("Selected: 2");
  });

  it("shows the compact actions only after the full toolbar leaves the viewport", async () => {
    const wrapper = mountSection();
    await flushPromises();

    expect(wrapper.find(".recipe-selection-floating-bar").exists()).toBe(false);

    await buttonByText(wrapper, "Select")!.trigger("click");
    expect(wrapper.find(".recipe-selection-floating-bar").exists()).toBe(false);

    intersectionCallback?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await nextTick();
    expect(wrapper.find(".recipe-selection-floating-bar").exists()).toBe(true);
    expect(wrapper.findAll(".recipe-selection-floating-bar button")).toHaveLength(3);

    intersectionCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await nextTick();
    expect(wrapper.find(".recipe-selection-floating-bar").exists()).toBe(false);
  });

  it("keeps compact actions accessible and wired to selection handlers", async () => {
    const wrapper = mountSection();
    await flushPromises();

    await buttonByText(wrapper, "Select")!.trigger("click");
    intersectionCallback?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await nextTick();

    let actionButtons = wrapper.findAll(".recipe-selection-floating-bar button");
    expect(actionButtons[0]!.attributes("aria-label")).toBeDefined();
    expect(actionButtons[1]!.attributes("aria-label")).toBeDefined();
    expect(actionButtons[2]!.attributes("aria-label")).toBeDefined();
    expect(actionButtons[0]!.attributes("disabled")).toBeDefined();
    expect(actionButtons[1]!.attributes("disabled")).toBeDefined();
    expect(actionButtons[2]!.attributes("disabled")).toBeUndefined();

    await wrapper.get("[data-recipe-card]").trigger("click");
    actionButtons = wrapper.findAll(".recipe-selection-floating-bar button");
    expect(actionButtons[0]!.attributes("disabled")).toBeUndefined();
    expect(actionButtons[1]!.attributes("disabled")).toBeUndefined();

    await actionButtons[0]!.trigger("click");
    expect((wrapper.vm as { organizerDialog: boolean }).organizerDialog).toBe(true);

    await actionButtons[1]!.trigger("click");
    expect(wrapper.text()).toContain("Selected: 0");

    await actionButtons[2]!.trigger("click");
    expect(wrapper.find(".recipe-selection-floating-bar").exists()).toBe(false);
    expect(buttonByText(wrapper, "Select")).toBeDefined();
  });
});
