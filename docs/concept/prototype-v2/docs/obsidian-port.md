# Obsidian integration boundary

The delivered artifact is a styled browser demo. The following boundaries should remain explicit when moving it into Codebase Inspector's real plugin implementation.

1. **Native view:** Mount Vue in an `ItemView` content element. Do not place this entire HTML document, duplicate host ribbon, or fake title bar inside the plugin.
2. **CSS:** Use scoped component styles and Obsidian's semantic tokens. The standalone `body` styles seed a demonstration theme and should not override the real application's body.
3. **Lifecycle:** Own one canvas/renderer per leaf. On close/unload, unmount UI and dispose the renderer. Use the element's owning document/window; verify pop-out migration independently.
4. **State:** Share immutable snapshots and scan services where appropriate. Selection, camera, tab, and drawer state belong to each leaf.
5. **Data:** Replace the trusted fixture only through a normalized, validated inventory adapter. Do not infer a repository's file population from fallow's findings arrays.
6. **Evidence:** Treat imported findings and graph relationships as provider contributions with identity, version, scope, and provenance. Remove the demo badge only when the records are backed by real evidence, and use an appropriate real-source label instead.
7. **Permissions:** The source chooser here is illustrative. Real source approval, exclusion handling, path containment, analyzer execution, and cache destinations require separate implementation.
8. **Accessibility:** Keep an equivalent searchable file list and explicit focus actions. A canvas is not the sole source of file information.
9. **Themes and graphics:** Call `setTheme` from a host-aware theme bridge. Evaluate GPU/context lifecycle, reduced motion, zoom, high-DPI behavior, and large repositories in Obsidian rather than assuming browser-demo results cover them.
10. **Build:** Import and bundle dependencies with the actual plugin toolchain. The classic-script demo bundle is a reusable reference; it is not `main.js` or an installable plugin release.

The `window.__CI_REVIEW__` hook, fake source scenarios, sibling editor, and diagnostic controls are review infrastructure. Do not expose them as production plugin commands by accident.
