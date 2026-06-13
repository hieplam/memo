---
id: rule-no-console
c3-seal: 11bcc17ebce717ea953d97ee9cdfba8312d1fbb701e1df812c477a93b8891e49
title: no-console
type: rule
goal: Enforce that no console.log, console.error, console.warn, or other console methods appear in production TypeScript or Astro source files so that accidental debug output never reaches the built site.
---

## Goal

Enforce that no console.log, console.error, console.warn, or other console methods appear in production TypeScript or Astro source files so that accidental debug output never reaches the built site.

## Rule

All TypeScript and Astro files must never call console.* methods.

## Golden Example

```ts
// src/utils/getSortedPosts.ts — REQUIRED pattern: use typed return, no console
import type { CollectionEntry } from "astro:content";

export const getSortedPosts = (posts: CollectionEntry<"posts">[]) => {
  return posts
    .filter(({ data }) => !data.draft) // REQUIRED: typed filter
    .sort(
      (a, b) =>
        Math.floor(
          new Date(b.data.modDatetime ?? b.data.pubDatetime).getTime() / 1000
        ) -
        Math.floor(
          new Date(a.data.modDatetime ?? a.data.pubDatetime).getTime() / 1000
        )
    );
  // REQUIRED: no console.log("sorted posts:", result) here
};
```

## Not This

| Anti-Pattern | Correct | Why Wrong Here |
| --- | --- | --- |
| console.log("debug:", value) in a util function | Remove the log; use a typed return or throw a typed Error | ESLint rule no-console: error fails the lint step in CI |
| console.error("build failed") in an API route | Throw new Error("build failed") with a descriptive message | Console output leaks debug information into Cloudflare Pages build logs |

## Scope

Applies to all .ts, .tsx, and .astro files in src/. Does not apply to config files outside src/ (e.g. eslint.config.js itself, astro.config.ts build utilities) where console use is acceptable.

## Override

If a temporary debug log is needed during local development, use a // eslint-disable-next-line no-console comment and remove it before committing.
