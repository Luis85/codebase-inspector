# Concept-to-demo visual changes

## Design target

Use the earlier dark, illuminated dependency-city concept and the later Obsidian Codebase Inspector board as visual direction. Preserve the working demo, its offline bundle, and its deliberate distinction between selection and camera navigation.

This is an interpretation of those concept boards in a functioning demo, not a pixel-identical recreation. The source boards contain illustrative dashboards, fictional metrics, and features belonging to later implementation packages. Those should not become fabricated evidence in the current UI.

| Concept characteristic | Implemented treatment | Meaning retained |
|---|---|---|
| Isolated city districts | Beveled platform geometry, restrained perimeter lighting, explicit directory labels | One directory group per platform |
| Legible, detailed towers | Instanced standard-material buildings; GPU facade windows; roof caps, beacons, and shared outlines | Building height continues to represent physical lines |
| Luminous architectural routes | Curved Three.js tubes with direction arrows; softer outer tubes as halos | Only the 30 explicit synthetic edges are drawn; no inferred source analysis |
| Contextual code-inspection panel | Constant-width right panel; computed overview or selected-file details and relationships | Selection does not resize the desktop city canvas or move its camera |
| Mini-map | Data-backed top-down canvas map with click-to-focus | Real district positions and selected file; keyboard alternative in district list |
| Dark technical interface | Navy/slate surfaces, subtle borders, blue/violet accents, compact system typography | No duplicate account system or fallow product branding |
| Light theme | Pale surfaces, darker architectural colors, reduced facade illumination | Same snapshot and interactions |
| Evidence-aware investigation | Exact file measurements, directional relationship lists, provenance note | No fake risk, health, trend, or deletion-safety grades |

## Interaction refinements

- The overview stays in the same desktop region as the selected inspector. Selecting a building does not reflow the city.
- File selection, explicit focus, query, theme, details, and connection visibility are independent operations.
- Incoming and outgoing selected-file relationships have a legend and selectable endpoints.
- Query changes dim nonmatches in place. They do not change layout, file identity, or selection.
- Scene lighting and facade detail are decorative. Tooltips, inspector explanations, and the dataset badge make that distinction explicit.
- The renderer invalidates on actual changes and does not run an endless idle animation loop.
- Simulated scans never become real filesystem or process operations.
- Real graphics-context loss routes to the HTML inventory, retaining the current snapshot and selection.

## Rendering choices

No bloom or post-processing addon is required. Architectural glow is represented with emissive facade contributions, lit edges, translucent platform halos, and small outer route tubes. This preserves the local bundle and avoids a mandatory continuous animation pass.

Building facade detail is computed in a material shader over instanced box geometry. It does not allocate one geometry per window. Roofs, lots, and lights are also instanced; shared line geometry outlines tower edges. Route rebuilds dispose the superseded geometry and materials.

## Explicitly not carried over

The prototype does not display a fabricated universal health score, security verdicts, recent trend graphs, runtime traffic, arbitrary fictional authors, or a percent “safe to delete.” It does not claim the synthetic imports were emitted by fallow.

The demo does not duplicate a full secondary application navigation hierarchy inside Obsidian. Only usable controls are shown. The small host-like ribbon is demo framing, not an additional sidebar to ship in the plugin.
