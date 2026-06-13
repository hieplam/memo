import config from "@/config";

/**
 * Resolves the UI-chrome language for the current page render.
 *
 * Astro routing configures a single URL locale (`en`), so `Astro.currentLocale`
 * alone can never select the Vietnamese UI strings. Content-language-aware pages
 * (a VI post, the VI listing route) set `Astro.locals.uiLang` in their
 * frontmatter; this helper prefers that, then the routing locale, then the site
 * default. Shared components call it instead of reading `Astro.currentLocale`
 * directly so the whole page chrome localizes consistently.
 */
export function getUiLocale(astro: {
  locals: App.Locals;
  currentLocale?: string | undefined;
}): string {
  return astro.locals.uiLang ?? astro.currentLocale ?? config.site.lang;
}
