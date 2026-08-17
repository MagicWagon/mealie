import { shallowMount } from "@vue/test-utils";
import RecipeCard from "../RecipeCard.vue";
import RecipeCardMobile from "../RecipeCardMobile.vue";

const routerPush = vi.fn();

vi.mock("~/composables/use-logged-in-state", () => ({
  useLoggedInState: () => ({ isOwnGroup: { value: true } }),
}));

const commonStubs = {
  VHover: {
    template: "<div><slot :is-hovering=\"false\" :props=\"{}\" /></div>",
  },
  VTooltip: {
    template: "<div><slot name=\"activator\" :props=\"{}\" /></div>",
  },
  VCard: {
    template: "<div class=\"recipe-card-stub\"><slot /></div>",
  },
  VBtn: {
    inheritAttrs: false,
    template: "<button v-bind=\"$attrs\"><slot /></button>",
  },
};

describe.each([
  ["desktop", RecipeCard, { name: "Recipe", slug: "recipe", recipeId: "1" }],
  ["mobile", RecipeCardMobile, { name: "Recipe", description: "", slug: "recipe", recipeId: "1" }],
])("%s recipe card", (_name, component, props) => {
  it("keeps organize clicks in the dialog while preserving card navigation", async () => {
    vi.stubGlobal("useMealieAuth", () => ({ user: { value: { groupSlug: "group" } } }));
    vi.stubGlobal("useRoute", () => ({ params: { groupSlug: "group" } }));
    vi.stubGlobal("useRouter", () => ({ push: routerPush }));
    routerPush.mockClear();

    const wrapper = shallowMount(component, {
      props: {
        ...props,
        showOrganizer: true,
      },
      global: {
        mocks: {
          $globals: {
            icons: {
              organizers: "organizers",
              checkboxBlankCircleOutline: "empty-circle",
              checkboxMarkedCircle: "selected-circle",
            },
          },
        },
        stubs: commonStubs,
      },
    });

    const organizeButton = wrapper.get("button[aria-label=\"Organize\"]");
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });

    organizeButton.element.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(wrapper.emitted("organize")).toHaveLength(1);
    expect(routerPush).not.toHaveBeenCalled();
    expect(wrapper.getComponent(commonStubs.VCard).attributes("to")).toBeUndefined();

    await wrapper.get(".recipe-card-stub").trigger("click");
    expect(routerPush).toHaveBeenCalledWith("/g/group/r/recipe");
  });

  it("uses an empty circle for an unselected recipe", () => {
    vi.stubGlobal("useMealieAuth", () => ({ user: { value: { groupSlug: "group" } } }));
    vi.stubGlobal("useRoute", () => ({ params: { groupSlug: "group" } }));
    vi.stubGlobal("useRouter", () => ({ push: routerPush }));

    const wrapper = shallowMount(component, {
      props: {
        ...props,
        selectMode: true,
        selected: false,
      },
      global: {
        mocks: {
          $globals: {
            icons: {
              checkboxBlankCircleOutline: "empty-circle",
              checkboxMarkedCircle: "selected-circle",
            },
          },
        },
        stubs: commonStubs,
      },
    });

    expect(wrapper.text()).toContain("empty-circle");
    expect(wrapper.text()).not.toContain("selected-circle");
  });
});
