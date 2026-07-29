# Release v1.1.3 - 2026-07-29

## New Features

- JSON-manifest driven product tour — define steps in a `.json` file with CSS selectors, titles, body text, and placement
- Automatic "show once" persistence via cookie, localStorage, or memory storage adapters
- Configurable tooltip placement (`auto`, `top`, `bottom`, `left`, `right`) with 20px viewport safe margin on all sides
- Theming via CSS variables or the `theme` option (accent, radius, font, dark mode)
- Keyboard navigation (Arrow keys, Enter, Escape)
- Overlay click to advance, scroll-into-view, and auto-advance when target hides
- Optional `classPrefix` for namespaced CSS classes on all UI elements
- Ships ESM, CJS, and browser IIFE (`ReleaseHighlighter` global); TypeScript types included
- Published as `@inandi/release-highlighter` on npm

## Improvements

- Simplified public API: single entry point via `ReleaseHighlighter.fromJson(url, options?)`
- Steps are fully JSON-serializable (CSS selector targets only; no JS functions)
- Manifest validation: rejects bare arrays, enforces non-empty string `target` on every step
- Tooltip width constrained to viewport minus safe margins; position clamped to prevent overflow
- Increased gap between the spotlighted target and the tooltip for clearer separation
- More accurate rendered-element detection (display, visibility, opacity, and layout box)
- Stylesheet package export standardized as `style.css`
- Lifecycle hooks (`start`, `step`, `next`, `prev`, `skip`, `finish`) for analytics and custom behavior
- Comprehensive JSDoc with `@file`, `@license`, `@public`/`@internal`, `@default`, and `@example` tags
- README updated with clearer JSON-only quick start, status badges, and a demo GIF

---

