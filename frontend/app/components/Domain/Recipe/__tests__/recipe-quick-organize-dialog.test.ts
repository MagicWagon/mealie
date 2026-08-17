import { flushPromises, shallowMount } from "@vue/test-utils";
import RecipeQuickOrganizeDialog from "../RecipeQuickOrganizeDialog.vue";

const { api, alert } = vi.hoisted(() => ({
  api: {
    bulk: {
      bulkOrganize: vi.fn(),
    },
    recipes: {
      patchOne: vi.fn(),
    },
  },
  alert: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("~/composables/api", () => ({
  useUserApi: () => api,
}));

vi.mock("~/composables/use-toast", () => ({
  alert,
}));

const tag = { id: "tag-1", name: "Dinner", slug: "dinner" };
const category = { id: "category-1", name: "Main", slug: "main" };
const recipe = {
  id: "recipe-1",
  slug: "recipe-1",
  name: "Recipe",
  tags: [],
  recipeCategory: [],
};

const stubs = {
  BaseDialog: {
    template: "<div><slot /><slot name='card-actions' /></div>",
  },
  BaseButton: {
    props: {
      cancel: Boolean,
      disabled: Boolean,
      loading: Boolean,
      save: Boolean,
    },
    template: "<button :data-save='save ? true : undefined' :disabled='disabled' @click='$emit(\"click\")'><slot /></button>",
  },
  RecipeOrganizerSelector: {
    props: ["modelValue", "selectorType"],
    setup() {
      return { category, tag };
    },
    template: "<button :data-selector='selectorType' @click='$emit(\"update:modelValue\", selectorType === \"tags\" ? [tag] : [category])'>select</button>",
  },
  VRadioGroup: {
    template: "<div><slot /><button data-operation='remove' @click='$emit(\"update:modelValue\", \"remove\")'>remove</button></div>",
  },
};

function mountDialog(props: Record<string, unknown>) {
  return shallowMount(RecipeQuickOrganizeDialog, {
    props,
    global: {
      mocks: {
        $globals: { icons: { organizers: "organizers" } },
      },
      stubs,
    },
  });
}

describe("RecipeQuickOrganizeDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.bulk.bulkOrganize.mockResolvedValue({ data: [recipe], error: null });
    api.recipes.patchOne.mockResolvedValue({ data: recipe, error: null });
    vi.stubGlobal("useNuxtApp", () => ({ $globals: { icons: { organizers: "organizers" } } }));
  });

  it("sends selected IDs and the add operation to the atomic bulk API", async () => {
    const wrapper = mountDialog({ modelValue: true, mode: "bulk", recipes: [recipe, { ...recipe, id: "recipe-2" }] });

    await wrapper.get("[data-selector=\"tags\"]").trigger("click");
    await wrapper.get("[data-selector=\"categories\"]").trigger("click");
    await wrapper.find("button[data-save]").trigger("click");
    await flushPromises();

    expect(api.bulk.bulkOrganize).toHaveBeenCalledWith({
      recipes: ["recipe-1", "recipe-2"],
      operation: "add",
      tags: [tag],
      categories: [category],
    });
    expect(wrapper.emitted("saved")).toHaveLength(1);
    expect(wrapper.emitted("update:modelValue")).toContainEqual([false]);
  });

  it("sends remove and keeps the dialog open when bulk organization fails", async () => {
    api.bulk.bulkOrganize.mockResolvedValue({ data: null, error: new Error("failed") });
    const wrapper = mountDialog({ modelValue: true, mode: "bulk", recipes: [recipe] });

    await wrapper.get("[data-selector=\"tags\"]").trigger("click");
    await wrapper.get("button[data-operation='remove']").trigger("click");
    await wrapper.find("button[data-save]").trigger("click");
    await flushPromises();

    expect(api.bulk.bulkOrganize).toHaveBeenCalledWith({
      recipes: ["recipe-1"],
      operation: "remove",
      tags: [tag],
      categories: [],
    });
    expect(wrapper.emitted("saved")).toBeUndefined();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(alert.error).toHaveBeenCalled();
  });

  it("disables bulk save until an organizer is selected", () => {
    const wrapper = mountDialog({ modelValue: true, mode: "bulk", recipes: [recipe] });

    expect(wrapper.find("button[data-save]").attributes("disabled")).toBeDefined();
  });
});
