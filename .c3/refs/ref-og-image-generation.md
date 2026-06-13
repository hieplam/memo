---
id: ref-og-image-generation
c3-seal: f9af246d55d5c77eb5f518e25fe64721fe77eaa1e22ff323324aecc47833d944
title: og-image-generation
type: ref
goal: Standardize how Open Graph images are generated at build time so that both the site-level default and per-post OG images are produced by the same pipeline with consistent dimensions and font rendering.
---

## Goal

Standardize how Open Graph images are generated at build time so that both the site-level default and per-post OG images are produced by the same pipeline with consistent dimensions and font rendering.

## Choice

Satori (JSX object tree to SVG) plus Sharp (SVG buffer to PNG) pipeline in Astro API route endpoints, with Google Sans Code font loaded from Astro fontData via experimental_getFontFileURL, producing 1200x630 PNG images with embedFont enabled.

## Why

Satori runs in Node.js (and serverless edge) without a browser dependency, making it suitable for Astro's static build pipeline. Sharp converts Satori's SVG output to a real PNG at high quality without requiring a canvas or Puppeteer. Using Astro's built-in font API (astro:assets fontData) ensures the same font file that is loaded for the page CSS is also used for OG images, keeping visual consistency. The alternative — pre-generating OG images as static assets — was rejected because it would not support dynamic per-post title rendering without a separate script outside the Astro build. The alternative — using a cloud service like Vercel OG — was rejected because the site deploys to Cloudflare Pages and the build runs locally with bun.

## How

The OG generation pattern used in src/pages/og.png.ts:

```ts
// REQUIRED pattern for all OG image endpoints
import satori from "satori";
import sharp from "sharp";
import { fontData, experimental_getFontFileURL } from "astro:assets";
import { getFontPathByWeight } from "@/utils/getFontPathByWeight";

// 1. Resolve font paths from Astro fontData
const fonts = fontData["--font-google-sans-code"];
const regularFontPath = getFontPathByWeight(fonts, 400);
const boldFontPath = getFontPathByWeight(fonts, 700);

// 2. Fetch font ArrayBuffers
const [regularData, boldData] = await Promise.all([...]);

// 3. Render SVG via Satori — dimensions MUST be 1200x630
const svg = await satori(jsxObjectTree, {
  width: 1200, height: 630,
  embedFont: true, // REQUIRED
  fonts: [{ name: "Google Sans Code", data: regularData, weight: 400, style: "normal" }, ...],
});

// 4. Convert to PNG via Sharp
const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
return new Response(new Uint8Array(pngBuffer), { headers: { "Content-Type": "image/png" } });
```

REQUIRED: 1200x630 dimensions, embedFont:true, Content-Type: image/png. OPTIONAL: design of the JSX object tree.
