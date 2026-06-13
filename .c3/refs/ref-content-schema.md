---
id: ref-content-schema
c3-seal: 3ea5ebe9eb32401ef24fff5a29d0f82c79edbb29ec106a079d9e0dc18c57f305
title: content-schema
type: ref
goal: Standardize the frontmatter schema contract for blog posts so every content file has consistent, type-safe, Zod-validated fields that all pages and utilities can rely on without defensive null checks.
---

## Goal

Standardize the frontmatter schema contract for blog posts so every content file has consistent, type-safe, Zod-validated fields that all pages and utilities can rely on without defensive null checks.

## Choice

Astro Content Collections with a single Zod object schema in src/content.config.ts — required fields (title, pubDatetime, description) plus optional fields (author, modDatetime, featured, draft, tags, ogImage, canonicalURL, hideEditPost, timezone) with explicit defaults where safe.

## Why

Astro's glob-based content loader runs Zod validation at build time, converting runtime field-access errors into build-time type errors. This eliminates an entire class of missing-frontmatter bugs that only surface when a post is rendered. The alternative — TypeScript interfaces without Zod — would allow frontmatter to pass type-check but fail at runtime when a required field is absent. The second alternative — no schema at all — was the AstroPaper default before this project added explicit type safety, and caused subtle display bugs when posts were missing description or pubDatetime.

## How

The schema is defined in src/content.config.ts and referenced by all collection queries:

```ts
// src/content.config.ts
const posts = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z.object({
      author: z.string().default(config.site.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      ogImage: image().or(z.string()).optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
      lang: z.enum(["vi", "en"]).default("vi"),
      multiLangKey: z.string().optional(),
    }),
});
```

REQUIRED: author, pubDatetime, title, description. OPTIONAL with defaults: tags defaults to ["others"]; lang defaults to "vi" (so language-unmarked posts are Vietnamese with no edits). OPTIONAL nullable: modDatetime. OPTIONAL: multiLangKey — posts sharing the same multiLangKey but a different lang are treated as a translation pair (powers the language switch button and per-language filter pages). The image() helper enables Astro's image optimization for local assets.
