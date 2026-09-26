# Review prototype

Open `index.html` after extracting the full package. All styling, script, fixtures, and city illustrations are local; no dependency installation, account, external library request, or application server is required by the prototype. Some browser environments may restrict local-file scripts; this environment verified the authored page by injecting its contents into headless Chromium rather than by navigating a local file.

Use the design-harness scenario selector to open any of the 28 states. The **Preview host theme** control belongs to that harness, not to the product. Captured PNG mockups hide the harness and include a synthetic-data caption.

## Demonstrated interactions

Source-mode selection and scope review; unchecked approval gate; simulated inventory/cancel; file-list selection; path search and city emphasis; SVG pan/zoom/top view; inspector close; simulated report connection; note composer and a simulated note preview; scenario and palette switching.

## Deliberate limitations

This is a UX review artifact, not a plugin or implementation scaffold. The city is SVG, not Three.js. It does not access a filesystem, execute fallow, validate real report schemas, run in Obsidian, persist notes, start a watcher, implement complete source-binding validation, or implement all production focus/permission/lifecycle behavior. Some tables and queues show a representative subset. The note preview is a fixture rather than a complete Markdown editor. The list/search and camera interactions are simplified; exact production behavior is defined in the screen and interaction specifications.

The mock Windows directory is illustrative. Choosing a source mode does not actually resolve any path. Do not use this prototype to assess permission safety, actual codebase performance, or host conformance. None of its file counts or metric values describe the user’s repository.

## Editing

`fixtures.js`: synthetic file inventory, SVG city geometry, and screen metadata. `app.js`: scenario composition and simulated transitions. `styles.css`: review-only theme and layout styles. `../components/design-tokens.css`: separate proposed host-token bridge.

Do not copy `styles.css` globally into Obsidian. It contains body-level styles for the standalone review harness. Implement the production ItemView with scoped Vue components and Three.js from the provided contracts.
