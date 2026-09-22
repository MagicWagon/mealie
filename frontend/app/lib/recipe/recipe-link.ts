interface RouterResolver {
  resolve(path: string): { href: string };
}

/** Resolve an app-relative route to an absolute URL, honoring the router's base path. */
export function resolveAbsoluteAppUrl(router: RouterResolver, path: string, origin: string): string {
  return new URL(router.resolve(path).href, origin).href;
}
