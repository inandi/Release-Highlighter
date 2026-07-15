# release-highlighter

Simple, highly customizable **release-journey / product-tour** plugin for the web.
Point it at elements on your page and it walks users through what's new with an
overlay, spotlight, and tooltip. JS-first config, full theming, lifecycle hooks,
and an optional JSON manifest. Zero runtime dependencies.

- JS/TS config as the primary API (define steps in code)
- Theme via CSS variables (colors, radius, fonts, dark mode) or ship your own CSS
- Rich content: plain text, trusted HTML, or a fully custom render function
- Lifecycle hooks (`start`, `step`, `next`, `prev`, `skip`, `finish`) and per-step conditions
- Placement control (`auto`/`top`/`bottom`/`left`/`right`), spotlight padding, scroll-into-view
- Pluggable persistence (cookie / localStorage / memory / custom) to show once per release
- Ships ESM, CJS, and a browser IIFE global; TypeScript types included

## Install

```bash
npm install @inandi/release-highlighter
```

Or via CDN (browser global `ReleaseHighlighter`):

```html
<script src="https://unpkg.com/@inandi/release-highlighter"></script>
```

## Quick start (JS-first)

```ts
import { ReleaseHighlighter } from "@inandi/release-highlighter";

const rh = new ReleaseHighlighter({
  version: "2.1.0", // shown once per version (persisted)
  theme: { accent: "#4f80ff", radius: "10px", darkMode: "auto" },
  labels: { next: "Got it", done: "Finish" },
  steps: [
    { target: ".cart-summary", title: "New cart", body: "Totals are clearer.", placement: "bottom" },
    { target: "#avatar", body: "Upload <b>SVG avatars</b>.", html: true },
    { target: () => document.querySelector(".sidebar a"), body: "Jump around faster." },
  ],
  on: {
    finish: () => console.log("done"),
  },
});

rh.start();
```

The default styles are injected automatically. If you prefer to manage CSS
yourself, set `injectStyles: false` and import the stylesheet (or copy it):

```ts
import "@inandi/release-highlighter/styles.css";
```

## Load steps from a JSON manifest

Steps can come from a remote JSON manifest instead of inline config.

```ts
const rh = await ReleaseHighlighter.fromJson("/releases/2.1.0.json");
rh.start();
```

Manifest shape (a bare `Step[]` array is also accepted):

```json
{
  "version": "2.1.0",
  "expires": "2026-12-31T23:59:59Z",
  "steps": [
    { "target": ".cart-summary", "title": "New cart", "body": "Totals are clearer." },
    { "target": "#avatar", "body": "Upload SVG avatars." }
  ]
}
```

`expires` is optional (UTC / ISO date). On or after that moment the journey is
never shown. Only a single `version` is supported per manifest.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `steps` | `Step[]` | `[]` | Steps to run. Optional when loading from a manifest. |
| `version` / `id` | `string` | – | Identity used for "show once" persistence. |
| `theme` | `Theme` | – | Colors, radius, font, `darkMode`, `zIndex` (mapped to CSS variables). |
| `labels` | `Partial<Labels>` | `Next/Back/Skip/Done` | Global control labels. |
| `storage` | `'cookie' \| 'localStorage' \| 'memory' \| StorageAdapter` | `'cookie'` | Persistence backend. |
| `storageKey` | `string` | `release_highlighter` | Storage key. |
| `cookieDays` | `number` | `180` | Cookie lifetime (cookie adapter only). |
| `force` | `boolean` | `false` | Always show, ignore stored state. |
| `expiresAt` | `string \| number \| Date` | – | Never show on/after this UTC time (overrides `force`). |
| `placement` | `Placement` | `'auto'` | Default tooltip placement. |
| `padding` | `number` | `8` | Spotlight gap (px) around targets. |
| `scrollIntoView` | `boolean` | `true` | Scroll target into view before showing. |
| `autoAdvanceOnHidden` | `boolean` | `true` | Advance if the target scrolls out of view. |
| `closeOnOverlayClick` | `boolean` | `true` | Advance when the dimmed overlay is clicked. |
| `keyboard` | `boolean` | `true` | Arrow / Enter / Escape controls. |
| `skipHiddenTargets` | `boolean` | `true` | Skip steps whose target is not visible. |
| `injectStyles` | `boolean` | `true` | Inject default CSS (set false to use your own). |
| `on` | `Hooks` | – | Lifecycle callbacks. |

### Step shape

```ts
type Step = {
  target: string | Element | (() => Element | null);
  title?: string;
  body?: string;
  html?: boolean;                 // treat title/body as trusted HTML
  placement?: "auto" | "top" | "bottom" | "left" | "right";
  padding?: number;
  labels?: Partial<Labels>;
  scrollIntoView?: boolean;
  when?: () => boolean;           // skip when false
  beforeShow?: (step, api) => void;
  afterShow?: (step, api) => void;
  render?: (step, api) => string | HTMLElement; // custom tooltip content
  data?: Record<string, unknown>;
};
```

The `api` passed to hooks and `render` exposes `next()`, `prev()`, `goTo(i)`,
`skip()`, `finish()`, and read-only `index` / `total`.

## Theming

All visuals key off CSS variables on the `.rh-root` container, so you can theme
via the `theme` option or from your own stylesheet:

```css
.rh-root {
  --rh-accent: #10b981;
  --rh-radius: 14px;
  --rh-bg: #0b1220;
  --rh-text: #f5f7fa;
}
```

Set `theme.darkMode` to `"auto"` (follows `prefers-color-scheme`), `true`, or
`false`.

## Public API

```ts
const rh = new ReleaseHighlighter(options);
await rh.start();
rh.next();
rh.prev();
rh.goTo(0);
rh.skip();     // marks as seen
rh.finish();   // marks as seen
rh.destroy();  // tear down without marking as seen
```

## Demo (run locally)

```bash
npm install
npm run build
npm run dev
# open http://localhost:5174/demo/
```

The dev server serves the repo root at `http://localhost:5174/`. Open the `/demo/` page to try it out.
The demo runs a journey from a JSON manifest. Serve it over HTTP (not `file://`)
because the manifest is fetched with `fetch()`.

## License

MIT
