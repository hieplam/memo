---
id: rule-prettier-format
c3-seal: 189d32d1105e2b9674d5ff4fe6a155825f76df87ba29fea4cfaf0306e5afe7d8
title: prettier-format
type: rule
goal: Enforce consistent code formatting across all TypeScript, Astro, and CSS files using the project's Prettier configuration so that diffs contain only semantic changes and not whitespace noise.
---

## Goal

Enforce consistent code formatting across all TypeScript, Astro, and CSS files using the project's Prettier configuration so that diffs contain only semantic changes and not whitespace noise.

## Rule

All source files must be formatted according to the project .prettierrc before committing (double quotes, 2-space indent, 80-character line width, LF line endings, trailing commas ES5).

## Golden Example

```ts
// src/utils/slugify.ts — REQUIRED formatting pattern
import slugify from "slugify"; // REQUIRED: double quotes

export const slugifyStr = (str: string) =>
  slugify(str, { // REQUIRED: 2-space indent
    lower: true,
    strict: false,
    trim: true,
  }); // REQUIRED: trailing comma after last property (ES5)
```

## Not This

| Anti-Pattern | Correct | Why Wrong Here |
| --- | --- | --- |
| import slugify from 'slugify' (single quotes) | import slugify from "slugify" (double quotes) | .prettierrc sets singleQuote: false |
| 4-space or tab indentation | 2-space indentation | .prettierrc sets tabWidth: 2 |
| Windows CRLF line endings | LF line endings | .prettierrc sets endOfLine: "lf" |

## Scope

Applies to all .ts, .tsx, .astro, .css, .json, and .md files processed by Prettier. Prettier-plugin-astro handles .astro files. Prettier-plugin-tailwindcss sorts Tailwind classes automatically. The dist/ and public/pagefind/ directories are excluded (generated output).

## Override

Auto-generated or vendor files checked into the repo may use // prettier-ignore on a block or add the file to .prettierignore. All hand-authored source files must pass prettier --check without ignore comments.
