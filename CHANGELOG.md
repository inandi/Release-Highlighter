# Release v1.1.7 - 2026-08-05

## Acknowledgments
- Release failed, retry 1

---

# Release v1.1.6 - 2026-08-05

## New Features
- Pluggable persistence: bring your own `StorageAdapter` (cookie is the built-in default) to store "seen" progress wherever you like
- No fixed manifest step limit — seen state is split automatically into shards so tours of any size are supported

## Improvements
- Target elements by CSS class name via `targetClass` (auto-converted to a selector), standardizing how steps point at the page
- Persistence now tracks steps by numeric manifest index with shard-based cookie storage for better scale and performance
- Cookie persistence hardened with an internal mirror so progress survives rejected or evicted cookies, plus a shared journey-level expiry
- Storage adapters can now remove keys; expired and migrated keys are cleaned up automatically
- Introduced a `ManifestStep` type for clearer JSON manifest handling
- README rewritten with the easiest npm and CDN setup paths, manifest requirements, storage options, and edge cases

## Bug Fixes
- Prevent concurrent or re-entrant `start()` calls from mounting duplicate, orphaned UI
- Reset active steps and current index on teardown to release DOM references and allow clean instance reuse
- Guard cookie reads and writes against browsers that block cookie access

## Deprecated Features
- Built-in `localStorage` and `memory` storage options removed; use the default cookie store or provide a custom `StorageAdapter`

---

# Release v1.1.5 - 2026-07-29

## Improvements
- Update documents

---

# Release v1.1.4 - 2026-07-29

## Improvements
- Update release/publish process

---

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

