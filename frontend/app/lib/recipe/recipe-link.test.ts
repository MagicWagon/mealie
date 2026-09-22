import { describe, expect, test } from "vitest";
import { resolveAbsoluteAppUrl } from "./recipe-link";

function createTestRouter(base: string) {
  const pathPrefix = base === "/" ? "" : base.replace(/\/$/, "");
  return {
    resolve(path: string) {
      return { href: `${pathPrefix}${path}` };
    },
  };
}

describe("resolveAbsoluteAppUrl", () => {
  test("resolves a recipe route at the site root", () => {
    const router = createTestRouter("/");

    expect(resolveAbsoluteAppUrl(router, "/g/default/r/carnitas", "https://example.com"))
      .toBe("https://example.com/g/default/r/carnitas");
  });

  test("preserves the router base path for subpath deployments", () => {
    const router = createTestRouter("/mealie/");

    expect(resolveAbsoluteAppUrl(router, "/g/default/shared/r/share-token", "https://example.com"))
      .toBe("https://example.com/mealie/g/default/shared/r/share-token");
  });
});
