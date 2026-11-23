import type { CollectionEntry } from "astro:content";
import { postFilter } from "./postFilter";

type PostLanguage = {
  lang: "vi" | "en";
  label: string;
};

/** The site's default post language, shown on the home page and at /posts. */
export const DEFAULT_POST_LANG = "en" as const;

const LANG_META: PostLanguage[] = [
  { lang: "en", label: "English" },
  { lang: "vi", label: "Tiếng Việt" },
];

/**
 * Returns the distinct set of languages that have at least one non-draft post,
 * in a fixed order (en first - the site default - then vi).
 *
 * - Drafts and scheduled posts are excluded via `postFilter()`
 * - Only languages actually represented in the post set are returned
 */
export function getPostLanguages(
  posts: CollectionEntry<"posts">[]
): PostLanguage[] {
  const presentLangs = new Set(
    posts.filter(postFilter).map(post => post.data.lang)
  );
  return LANG_META.filter(entry => presentLangs.has(entry.lang));
}
