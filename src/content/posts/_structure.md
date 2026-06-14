# Post structure contract

This file describes how a post in this blog is shaped. It is the authoritative
reference for importing/authoring posts. The leading underscore keeps it out of
the published collection (Astro glob: `**/[^_]*.{md,mdx}`).

Keep this in sync with `src/content.config.ts`. If the schema drifts, update this.

## Frontmatter (from `src/content.config.ts` → `posts` collection)

| Field          | Type             | Required | Default              | Notes                                                                                                            |
| -------------- | ---------------- | -------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `title`        | string           | yes      | —                    | Quote it; may contain `:` and inner quotes.                                                                      |
| `description`  | string           | yes      | —                    | One–two sentences that actually summarize the piece.                                                             |
| `pubDatetime`  | date             | yes      | —                    | ISO with timezone, e.g. `2026-06-14T00:00:00Z`.                                                                  |
| `tags`         | string[]         | no       | `["others"]`         | Topical kebab-case tags. Vietnamese posts include a `vietnamese` tag.                                            |
| `author`       | string           | no       | `config.site.author` | Omit unless overriding.                                                                                          |
| `lang`         | `"vi"` \| `"en"` | no       | `"vi"`               | Set explicitly for clarity.                                                                                      |
| `modDatetime`  | date \| null     | no       | —                    | Only when updating an existing post.                                                                             |
| `featured`     | boolean          | no       | —                    | Pin to featured section.                                                                                         |
| `draft`        | boolean          | no       | —                    | Hide from build when true.                                                                                       |
| `ogImage`      | image \| string  | no       | —                    | Custom social card.                                                                                              |
| `canonicalURL` | string           | no       | —                    | When syndicated from elsewhere.                                                                                  |
| `hideEditPost` | boolean          | no       | —                    | Hide the "edit this post" link.                                                                                  |
| `timezone`     | string           | no       | —                    | IANA tz override for display.                                                                                    |
| `multiLangKey` | string           | no       | —                    | Shared key linking translations of the same post. Not currently used by any post, but available for en/vi pairs. |

## Filename & naming convention

- Kebab-case slug of the title, `.md` extension, placed directly in
  `src/content/posts/`.
- Language is encoded by the `lang` frontmatter field. Some older posts also use a
  language suffix in the filename (`-vi` / `-en`); a clean kebab slug without a
  suffix is also acceptable.
- For a translated pair, give both files the same `multiLangKey` and set each
  file's `lang`.

## Body conventions (from existing posts)

- Open with a **TL;DR** right after the frontmatter, as either:
  - a blockquote provenance/summary note (e.g. research-process note + `Ngày: <date>`), or
  - a `## Tóm tắt nhanh (TL;DR)` heading with bullet points.
- Follow the opening with a horizontal rule (`---`).
- Use **numbered `##` section headings** (`## 1. …`, `## 2. …`).
- Bilingual glossing in Vietnamese posts: introduce an English technical term and
  immediately gloss it in Vietnamese in parentheses, e.g. `context engineering (kỹ thuật ngữ cảnh)`.
- Mermaid diagrams, tables, code fences, and callouts are all supported and used.
- Keep the substance, tables, diagrams, and citations of the source intact — shape
  the opening and headings to match the blog, don't strip meaning.
