# WebMCP Field Guide

A Korean, static field guide to WebMCP, built from the supplied clipping and diagrams.

Open `index.html` directly for a quick preview, or serve this directory over HTTP to test clipboard support. GitHub Pages can publish the repository root from `main`.

The guide reflects the WebMCP Community Group draft published on 2026-09-28. Browser and agent support can vary.

## Diagrams and checks

The 20 diagrams use Archify JSON sources in `diagrams/`, with `meta.animation: "trace"`. Regenerate their HTML with the Archify renderer; do not edit generated HTML. WebP posters load first, followed by lazy animated embeds with theme and export controls.

- `python scripts/check_site.py` checks links, WebP assets and animation markers.
- `node --check app.js` checks JavaScript syntax.
- `python scripts/check_browser.py` checks desktop/mobile navigation, image decoding and Archify controls using installed Chrome, Pillow and websocket-client on Windows.
- `python scripts/check_browser.py --export-webp` also refreshes WebP posters from rendered diagrams.
