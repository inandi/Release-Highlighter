Release Highlighter (v1.0)
====================

Lightweight TypeScript/JS plugin that highlights what's new in your latest release using a simple XML manifest. It overlays your app, points to updated UI sections by class name, and guides users with Next/Skip. Shown once per user via a browser cookie.

Features
- Highlights elements by CSS class when visible on the current page
- Overlay + focus box + tooltip with message and step counter
- Next and Skip controls; auto-advances if an element scrolls out of view
- Reads version from XML; stores that version in a cookie to show only once
- Zero-dependency, ~small single file bundle

Install
```bash
npm install
npm run build
```

Usage
Include the bundled script in your page and point it to your release XML.
```html
<script src="/path/to/ReleaseHighlighter.min.js"></script>
<script>
  // Show highlights once per release version defined in the XML
  var rh = new window.ReleaseHighlighter({ xmlUrl: '/releases/1.2.3.xml' });
  rh.start();
</script>
```

XML Format
```xml
<?xml version="1.0" encoding="UTF-8"?>
<release version="1.2.3">
  <item class="release-highlighter--cart-summary">
    <message>We revamped the cart summary panel. Totals are now clearer.</message>
  </item>
  <item class="release-highlighter--profile-avatar">
    <message>You can now upload SVG profile avatars from the Profile menu.</message>
  </item>
</release>
```

- version: required. Used to persist a cookie so each user sees the tour once per release.
- item@class: required. A CSS class used to find target elements on the page.
- message: required. The text shown in the tooltip while highlighting the element.

Behavior
- Only items whose class is present and visible on the current page are shown.
- The tooltip is positioned near the target, with an arrow and step counter.
- Users can click Next to continue or Skip to dismiss. Hitting the end finishes automatically.
- When finished, a cookie like `release_highlighter_version=1.2.3` is set for 180 days (configurable).

API
```ts
type Options = {
  xmlUrl: string;          // Required: URL of the XML manifest for this release
  cookieName?: string;     // Optional: cookie key (default: 'release_highlighter_version')
  cookieDays?: number;     // Optional: cookie lifetime in days (default: 180)
}

const rh = new ReleaseHighlighter({ xmlUrl: '/releases/1.2.3.xml' });
await rh.start();
```

Demo
- Build the project: `npm run build`
- Open `demo/index.html` in a browser. It loads `demo/release.xml` and highlights elements by class.

Notes
- If no items are visible on the current page, the plugin sets the cookie and does nothing (so users on other pages won’t see a partial tour).
- Images/videos in messages are planned for a future version; for now the `<message>` is text-only.

License
MIT
