---
id: ref-content-schema
c3-seal: 56bd6dbd7dba730257d54315e305533b33a0f46bd19cdd8271e4de4afc502932
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
    }),
});
```

REQUIRED: author, pubDatetime, title, description. OPTIONAL with defaults: tags defaults to ["others"]. OPTIONAL nullable: modDatetime. The image() helper enables Astro's image optimization for local assets.
