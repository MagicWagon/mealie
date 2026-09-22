import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import RecipeDialogPublicShare from "./RecipeDialogPublicShare.vue";

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
  clipboardSupported: true,
  copied: true,
  alertError: vi.fn(),
  alertSuccess: vi.fn(),
}));

vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    useClipboard: () => ({
      copy: mocks.copy,
      copied: ref(mocks.copied),
      isSupported: ref(mocks.clipboardSupported),
    }),
  };
});

vi.mock("~/composables/use-toast", () => ({
  alert: {
    error: mocks.alertError,
    success: mocks.alertSuccess,
  },
}));

function mountDialog(link = "https://example.com/g/default/r/carnitas", name = "Carnitas") {
  return mount(RecipeDialogPublicShare, {
    props: { modelValue: true, link, name },
    global: {
      mocks: {
        $globals: { icons: { link: "link" } },
      },
      stubs: {
        BaseDialog: {
          props: ["modelValue"],
          template: "<div v-if=\"modelValue\"><slot /></div>",
        },
        BaseButton: {
          emits: ["click"],
          template: "<button type=\"button\" @click=\"$emit('click')\"><slot /></button>",
        },
        VCardText: { template: "<div><slot /></div>" },
        VCardActions: { template: "<div><slot /></div>" },
        VTextField: {
          props: ["modelValue", "label"],
          template: "<input :value=\"modelValue\" :aria-label=\"label\" @focus=\"$emit('focus', $event)\">",
        },
      },
    },
  });
}

describe("RecipeDialogPublicShare", () => {
  beforeEach(() => {
    mocks.copy.mockReset().mockResolvedValue(undefined);
    mocks.alertError.mockReset();
    mocks.alertSuccess.mockReset();
    mocks.clipboardSupported = true;
    mocks.copied = true;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("keeps the public link available and reports native share failure", async () => {
    const nativeShare = vi.fn().mockRejectedValue(new Error("Share failed"));
    vi.stubGlobal("navigator", { share: nativeShare });
    const link = "https://example.com/g/default/r/carnitas";
    const wrapper = mountDialog(link);

    await wrapper.findAll("button").find(button => button.text() === "Share")!.trigger("click");

    expect(nativeShare).toHaveBeenCalledWith({ title: "Carnitas", url: link });
    expect(mocks.alertError).toHaveBeenCalledOnce();
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe(link);

    await wrapper.findAll("button").find(button => button.text() === "Copy")!.trigger("click");
    expect(mocks.copy).toHaveBeenCalledWith(link);
    expect(mocks.alertSuccess).toHaveBeenCalledOnce();
  });

  test("copies from Share when native sharing is unavailable", async () => {
    const link = "https://example.com/g/default/r/carnitas";
    const wrapper = mountDialog(link);

    expect(wrapper.findAll("button").map(button => button.text())).toEqual(["Copy", "Share"]);
    await wrapper.findAll("button").find(button => button.text() === "Share")!.trigger("click");

    expect(mocks.copy).toHaveBeenCalledWith(link);
    expect(mocks.alertSuccess).toHaveBeenCalledOnce();
  });
});
