# memo 📄

![memo](public/default-og.jpg)
![Typescript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![GitHub](https://img.shields.io/github/license/hieplam/memo?color=%232F3741&style=for-the-badge)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white&style=for-the-badge)](https://conventionalcommits.org)

**memo** is [Hiep Lam](https://github.com/hieplam)'s personal blog and notebook —
long-form deep dives and explainers on software architecture, terminals and
low-level systems, and other things worth researching, often in both English
and Vietnamese.

Read [the blog posts](https://hieplam.github.io/memo/posts/) or browse the
sections below for more info.

## 🔥 Features

- [x] type-safe markdown
- [x] super fast performance
- [x] accessible (Keyboard/VoiceOver)
- [x] responsive (mobile ~ desktops)
- [x] SEO-friendly
- [x] light & dark mode
- [x] static search ([Pagefind](https://pagefind.app/))
- [x] draft posts & pagination
- [x] sitemap & rss feed
- [x] MDX support
- [x] collapsible table of contents
- [x] dynamic OG image generation for blog posts
- [x] i18n ready (English & Vietnamese)

## 🚀 Project Structure

```bash
/
├── public/
│   ├── pagefind/          # auto-generated on build
│   ├── favicon.svg
│   └── default-og.jpg
├── src/
│   ├── assets/
│   │   ├── icons/
│   │   └── images/
│   ├── components/
│   ├── content/
│   │   ├── pages/
│   │   │   └── about.md
│   │   └── posts/
│   │       └── some-blog-posts.md
│   ├── i18n/
│   ├── layouts/
│   ├── pages/
│   ├── scripts/
│   ├── styles/
│   ├── types/
│   ├── utils/
│   ├── config.ts
│   └── content.config.ts
├── astro-paper.config.ts  # user-defined configurations
└── astro.config.ts
```

All blog posts are stored in the `src/content/posts/` directory. You can organise posts into subdirectories — the subdirectory name becomes part of the post URL.

## 💻 Tech Stack

**Main Framework** - [Astro](https://astro.build/)  
**Type Checking** - [TypeScript](https://www.typescriptlang.org/)  
**Styling** - [TailwindCSS](https://tailwindcss.com/)  
**Static Search** - [Pagefind](https://pagefind.app/)  
**Icons** - [Tablers](https://tabler-icons.io/)  
**Code Formatting** - [Prettier](https://prettier.io/)  
**Deployment** - [GitHub Pages](https://pages.github.com/)  
**Dynamic OG images** - [Satori](https://github.com/vercel/satori) + [Sharp](https://sharp.pixelplumbing.com/) + [Astro Fonts](https://docs.astro.build/en/guides/fonts/)

## 👨🏻‍💻 Running Locally

Clone the repository and start the dev server:

```bash
git clone https://github.com/hieplam/memo.git
cd memo

# install dependencies
bun install

# start running the project
bun dev
```

## Google Site Verification (optional)

You can add your [Google Site Verification HTML tag](https://support.google.com/webmasters/answer/9008080#meta_tag_verification&zippy=%2Chtml-tag) by setting `site.googleVerification` in `astro-paper.config.ts`:

```ts file="astro-paper.config.ts"
export default defineAstroPaperConfig({
  site: {
    // ...
    googleVerification: "your-google-site-verification-value",
  },
  // ...
});
```

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command           | Action                                                                                                                           |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| `bun install`     | Installs dependencies                                                                                                            |
| `bun dev`         | Starts local dev server at `localhost:4321`                                                                                      |
| `bun run build`   | Type-checks, builds the site, runs Pagefind indexing, and copies the index to `public/pagefind/`                                 |
| `bun run preview` | Preview your build locally, before deploying                                                                                     |
| `bun run sync`    | Generates TypeScript types for all Astro modules. [Learn more](https://docs.astro.build/en/reference/cli-reference/#astro-sync). |
| `bunx astro ...`  | Run CLI commands like `astro add`, `astro check`                                                                                 |

## ✨ Feedback & Suggestions

If you have any suggestions/feedback, feel free to [open an issue](https://github.com/hieplam/memo/issues) or reach me via [email](mailto:lamhiep16@gmail.com).

## 📜 License

Licensed under the MIT License, Copyright © 2026 Hiep Lam.

---

Built on the [AstroPaper](https://github.com/satnaing/astro-paper) theme by [Sat Naing](https://satnaing.dev) and [contributors](https://github.com/satnaing/astro-paper/graphs/contributors).
