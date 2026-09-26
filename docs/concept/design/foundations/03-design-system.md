# Visual system, layout, and theme contract

## Layout tokens

Use a 4 px spacing grid: 4, 8, 12, 16, 20, 24, 32. Default component radius 6 px; modal 10 px; compact status badge 4 px. Prefer borders and spacing over layered shadows. Shadows belong primarily to popovers and temporary drawers.

At a sufficiently wide **leaf**, use: compact toolbar → optional shipped-mode strip → optional status/filter strip → file list + canvas + inspector → snapshot footer. The host sidebar width is not part of the plugin’s responsive calculation.

| Element | Default | Constraint |
|---|---|---|
| Toolbar | 52–60 px high | Wrap to two rows if required; never overlap source/search |
| File list | 192–224 px | Collapsible; optional resize 168–320 px |
| Inspector | 278–320 px | Wrap long paths; collapse into drawer before canvas is squeezed |
| Canvas | Remaining space | Minimum useful width around 420 px before compact mode |
| Footer | About 30 px | Can wrap; never the only place an important failure is reported |
| Icon button | 32 × 32 px | Larger 36/40 px where practical; visible focus |
| Normal input/button | 32–36 px | Preserve accessible target area at increased text size |
| Modal | About 590 px | `max-width: calc(100% - 32px)`; internal scrolling |
| Composer | About 740 px | Two columns only when enough space is available |

These are design defaults, not fixed pixel promises under every host theme or font scale. Use container queries or observed leaf dimensions; do not use the desktop-window width as a proxy for leaf width.

## Typography

Use Obsidian’s interface font and font-size variables. Normal body/control target 13–14 px, readable secondary text 12 px, section label 11–12 px, page title 22–26 px. Source paths use the host monospace font. Avoid all-caps except short low-frequency category labels. Secondary copy must remain readable; do not use faint text as a shortcut for de-emphasis.

The screen mockups are a fixed-size review composition. Their small captions and host chrome are not an instruction to make important product copy 9 px. At host zoom/text scaling, content reflows and panel widths adapt.

## Obsidian theme mapping

Production values resolve from host semantic CSS variables. The color documentation distinguishes semantic surfaces/text from theme-owned base colors and documents the user’s configurable accent [S2]. Do not overwrite Obsidian’s base palette or `body` selectors.

| Inspector token | Host semantic source |
|---|---|
| `--ci-surface` | `--background-primary` |
| `--ci-panel` | `--background-secondary` |
| `--ci-raised` | `--background-primary-alt` |
| `--ci-border` | `--background-modifier-border` |
| `--ci-text` | `--text-normal` |
| `--ci-text-muted` | `--text-muted` |
| `--ci-action` | `--interactive-accent` |
| `--ci-on-action` | `--text-on-accent` with actual host contrast validation |
| `--ci-focus` | `--background-modifier-border-focus`, falling back to accent |
| `--ci-error` | `--text-error` |
| `--ci-warning` | `--text-warning` |

See [token CSS](../components/design-tokens.css) and [token JSON](../components/design-tokens.json). The theme reference palettes in the prototype are illustrative only. Production must not import the prototype’s global CSS.

## City styling

Ground/district surfaces derive from host neutral surfaces. Category colors are moderately saturated: TypeScript blue, Vue teal, test code purple; production categories are extensible through a category registry. Category is not severity. Categorical colors never imply health.

A selected building receives a high-contrast outline plus a locator marker. A changed building in comparison uses a dashed outline and change badge; it must not look identical to selection. Unknown evidence uses a hatch/mark plus explicit text in the HTML equivalent. Do not rely on red versus green alone.

Lighting should support shape, not change metric interpretation. Disable costly shadows/postprocessing by default. Height is a visual mapping; exact numbers are always in the inspector. Limit labels to districts, a bounded visible subset, and the active selection. Never create a DOM tooltip or label for every file regardless of visibility.

Theme changes must recolor materials and labels without discarding file selection, changing layout, or restarting the scan. Resolve styles in the view’s owning window. GPU color parsing must accept the actual resolved CSS color representation; do not assume every host variable is a hex literal. The current Obsidian palette documentation includes OKLCH/color-mix guidance [S2].

## Iconography and motion

Use the host’s supported icons in production. Pair icons with labels for uncommon actions. Tooltip text explains an icon; accessible names must exist independently of hover.

Do not auto-orbit. Suggested focus transition: 160–220 ms with reduced-motion mode making it immediate. Hover should not move geometry. Scan activity is indeterminate until a real denominator exists. A user should be able to stop camera motion and cancel active work.

References: [S2], [S3], [S5–S9] in the [source register](../sources/sources.md).
