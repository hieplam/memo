---
id: ref-i18n-strategy
c3-seal: 88bfbb277b8ce0d9a8d23fbb91e522e089a43718df23f2f7ab263b7dff98f0bd
title: i18n-strategy
type: ref
goal: Standardize how user-visible UI strings are managed across page templates and components so that adding a new locale does not require modifying individual component files.
---

## Goal

Standardize how user-visible UI strings are managed across page templates and components so that adding a new locale does not require modifying individual component files.

## Choice

Locale files as typed TypeScript modules (src/i18n/lang/xx.ts) that implement the UIStrings interface, discovered at build time via import.meta.glob, and accessed through a single useTranslations(locale) function that falls back to English.

## Why

The TypeScript module approach makes every locale file a compile-time contract: if a new key is added to UIStrings, every lang/*.ts file that does not implement it fails astro check immediately rather than silently serving a missing string at runtime. The alternative — a JSON-based i18n library like i18next — was not chosen because the blog's i18n scope is limited (no dynamic locale switching, only build-time string substitution) and adding an external library would increase bundle size and complexity for marginal gain. The Astro native i18n routing (prefixDefaultLocale: false) is used for URL routing consistency, but string translation is handled separately to keep the two concerns decoupled.

## How

UI strings are accessed via the useTranslations helper in src/i18n/index.ts:

```ts
// Pattern used in page templates — REQUIRED
import { useTranslations } from "@/i18n";
const t = useTranslations(Astro.currentLocale);
// Use: t("nav.home"), t("post.readMore"), etc.
```

New locales: create src/i18n/lang/xx.ts implementing UIStrings. New strings: add key to src/i18n/types.ts UIStrings interface, then implement in all lang/*.ts files. Template strings with variables: use tplStr(t("key.with.{var}"), { var: value }).
