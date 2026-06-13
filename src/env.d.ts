/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /**
     * UI chrome language for the current page, derived from the page's content
     * language. Lets shared components (header, footer, post chrome) localize
     * even though Astro routing only configures a single URL locale.
     */
    uiLang?: string;
  }
}
