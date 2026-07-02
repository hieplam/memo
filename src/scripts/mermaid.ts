// Client-side Mermaid renderer for blog posts.
//
// Shiki emits a ```mermaid fence as `<pre data-language="mermaid">` whose source
// is split into one `<span class="line">` per line (joined by literal newlines).
// This script reconstructs that source, swaps each block for a
// `<div class="mermaid">`, and renders it with Mermaid — lazily (the library only
// loads on pages that actually contain a diagram) and theme-aware (re-rendering
// when the reader toggles light/dark). It re-runs after every ClientRouter view
// transition via the `astro:page-load` event.

type MermaidApi = (typeof import("mermaid"))["default"];

const SOURCE_ATTR = "data-mermaid-source";
const FONT_FAMILY =
  "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif";

let mermaidPromise: Promise<MermaidApi> | null = null;
let themeObserver: MutationObserver | null = null;

// Load Mermaid on demand and reuse the same module instance across renders.
function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then(module => module.default);
  }
  return mermaidPromise;
}

function currentTheme(): "dark" | "default" {
  return document.documentElement.classList.contains("dark")
    ? "dark"
    : "default";
}

// Reconstruct the raw diagram source from Shiki's highlighted markup and replace
// each `<pre>` with a mermaid container, stashing the source for later re-renders.
function adoptBlocks(): HTMLElement[] {
  const blocks = document.querySelectorAll<HTMLElement>(
    'pre[data-language="mermaid"]'
  );
  const containers: HTMLElement[] = [];
  blocks.forEach(block => {
    const code = block.querySelector("code");
    const source = (code?.textContent ?? block.textContent ?? "").replace(
      /\n+$/,
      ""
    );
    if (!source.trim()) return;
    const container = document.createElement("div");
    container.className = "mermaid";
    container.setAttribute(SOURCE_ATTR, source);
    container.textContent = source;
    // The copy-button pass skips mermaid `<pre>`, so there is no wrapper to unwind.
    block.replaceWith(container);
    containers.push(container);
  });
  return containers;
}

function existingContainers(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`.mermaid[${SOURCE_ATTR}]`)
  );
}

// Render (or re-render) the given containers with the current theme. Resetting
// each node back to its stored source lets a theme toggle re-run cleanly instead
// of leaving stale SVG in place.
async function renderAll(nodes: HTMLElement[]): Promise<void> {
  if (nodes.length === 0) return;
  const mermaid = await loadMermaid();
  mermaid.initialize({
    startOnLoad: false,
    theme: currentTheme(),
    // Diagrams are authored in-repo by the site owner, so `loose` is safe here
    // and lets `<br/>` line breaks and HTML labels render.
    securityLevel: "loose",
    fontFamily: FONT_FAMILY,
  });
  // Render one node at a time so a single invalid diagram cannot block the rest.
  for (const node of nodes) {
    node.removeAttribute("data-processed");
    node.innerHTML = node.getAttribute(SOURCE_ATTR) ?? node.textContent ?? "";
    try {
      await mermaid.run({ nodes: [node] });
    } catch {
      // Invalid diagram syntax: leave the source text visible rather than
      // emitting a console error into the production build.
    }
  }
}

// Re-render diagrams when the reader switches light/dark. Re-established on each
// diagram page-load so a view transition that swaps `<html>` keeps a live observer.
function watchThemeChanges(): void {
  themeObserver?.disconnect();
  let previous = currentTheme();
  themeObserver = new MutationObserver(() => {
    const next = currentTheme();
    if (next === previous) return;
    previous = next;
    void renderAll(existingContainers());
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });
}

async function renderDiagrams(): Promise<void> {
  const containers = adoptBlocks();
  if (containers.length === 0) return;
  watchThemeChanges();
  await renderAll(containers);
}

document.addEventListener("astro:page-load", () => {
  void renderDiagrams();
});
