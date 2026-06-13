import type { CollectionEntry } from "astro:content";
import { postFilter } from "./postFilter";

/**
 * Returns up to `limit` posts to suggest after reading `post` — the "keep
 * reading" wayfinding that points a reader toward a second worthwhile post.
 *
 * Ranking:
 *  - only non-draft, published posts in the SAME language as `post`
 *  - excludes the post itself and its translation sibling (shared `multiLangKey`)
 *  - ranked by number of shared tags (desc), then by recency (desc)
 *  - posts that share no tag are still eligible, sorted by recency, so the
 *    section is never sparse on a post with only unique tags
 */
export function getRelatedPosts(
  post: CollectionEntry<"posts">,
  allPosts: CollectionEntry<"posts">[],
  limit = 3
): CollectionEntry<"posts">[] {
  const { lang, multiLangKey, tags } = post.data;
  const tagSet = new Set(tags);

  const recency = (p: CollectionEntry<"posts">) =>
    new Date(p.data.modDatetime ?? p.data.pubDatetime).getTime();

  return allPosts
    .filter(
      p =>
        postFilter(p) &&
        p.id !== post.id &&
        p.data.lang === lang &&
        !(multiLangKey != null && p.data.multiLangKey === multiLangKey)
    )
    .map(p => ({
      post: p,
      shared: p.data.tags.filter(tag => tagSet.has(tag)).length,
    }))
    .sort((a, b) => b.shared - a.shared || recency(b.post) - recency(a.post))
    .slice(0, limit)
    .map(entry => entry.post);
}
