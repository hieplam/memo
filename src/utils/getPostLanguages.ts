import type { CollectionEntry } from "astro:content";
import { postFilter } from "./postFilter";

type PostLanguage = {
  lang: "vi" | "en";
  label: string;
};

const LANG_META: PostLanguage[] = [
  { lang: "vi", label: "Tiếng Việt" },
  { lang: "en", label: "English" },
];

/**
 * Returns the distinct set of languages that have at least one non-draft post,
 * in a fixed order (vi first, then en).
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
