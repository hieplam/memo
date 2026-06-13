import type { CollectionEntry } from "astro:content";
import { postFilter } from "./postFilter";

/**
 * Finds the sibling translation of a post by `multiLangKey`.
 *
 * - Returns the first non-draft post that shares the same `multiLangKey`
 *   but has a different `lang`
 * - Returns `null` when the post has no `multiLangKey`, or no sibling exists
 */
export function getTranslationSibling(
  post: CollectionEntry<"posts">,
  allPosts: CollectionEntry<"posts">[]
): CollectionEntry<"posts"> | null {
  const { multiLangKey, lang } = post.data;
  if (!multiLangKey) return null;

  return (
    allPosts.find(
      candidate =>
        postFilter(candidate) &&
        candidate.data.multiLangKey === multiLangKey &&
        candidate.data.lang !== lang
    ) ?? null
  );
}
