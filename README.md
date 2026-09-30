# WebMCP Field Guide

A Korean, static field guide to WebMCP, built from the supplied clipping and diagrams.

Open `index.html` directly for a quick preview, or serve this directory over HTTP to test clipboard support. GitHub Pages can publish the repository root from `main`.

The guide reflects the WebMCP Community Group draft published on 2026-09-28. Browser and agent support can vary.

## Diagrams and checks

The 21 diagrams use Archify JSON sources in `diagrams/`, with `meta.animation: "trace"`. WebP posters load first, followed by lazy animated embeds with theme and export controls. The default Archify attribution footer is omitted from generated diagrams.

- `python scripts/check_site.py` checks links, WebP assets, removed video CTA copy, omitted Archify attribution and animation markers.
- `node --check app.js` checks JavaScript syntax.
- `python scripts/check_browser.py` checks desktop/mobile navigation, image decoding and Archify controls using installed Chrome, Pillow and websocket-client on Windows.
- `python scripts/check_browser.py --export-webp` also refreshes WebP posters from rendered diagrams.
- `npm install` installs the Ink terminal UI dependencies; `npm test` runs the checks above in a live dashboard with the registered guide tools, test log, and local todo-tool demo. The todo flow runs only in the browser test shim and does not change remote data. Requires Node.js 22 or newer.
