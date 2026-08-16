import { shallowMount } from "@vue/test-utils";
import RecipeCard from "../RecipeCard.vue";
import RecipeCardMobile from "../RecipeCardMobile.vue";

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
    template: "<a href=\"/recipe\"><slot /></a>",
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
  it("prevents recipe navigation when the organize button is clicked", () => {
    vi.stubGlobal("useMealieAuth", () => ({ user: { value: { groupSlug: "group" } } }));
    vi.stubGlobal("useRoute", () => ({ params: { groupSlug: "group" } }));

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
  });
});
