# Migration from the standalone plan

This is a host change and product rename, not a rewrite of the analysis model.

| Previous proposal | Revised proposal |
|---|---|
| `codebase-city` working product/command | `codebase-inspector` project and plugin ID; Codebase Inspector display name |
| One published npm application | One Obsidian plugin distribution |
| CLI accepts a root path | Settings/source selector saves a codebase profile and local binding |
| Loopback server opens a browser | Registered `ItemView` renders directly in a workspace leaf |
| Server/HTTP session lifecycle | Plugin, workspace leaf, scan job, and renderer lifecycles |
| Standalone theme preference | Inherit Obsidian theme and CSS variables |
| Global application navigation | Compact in-view toolbar and contextual panels |
| Local standalone app settings | Small plugin preferences plus separate device-local bindings/cache |
| Markdown export file | Explicit creation/update of a vault investigation note |
| CLI-first watch/CI stage | Plugin watch mode and user-supplied CI artifact import; CLI optional later |
| General embedding API stage | Note embeds/deep links first; public headless API only when justified |

## Retain

Keep the normalized snapshot, provider adapters, metric definitions, deterministic layout, Three.js renderer boundary, provenance, explicit missing-data handling, read-only source inspection, and twelve-stage incremental delivery strategy.

## Remove from Package 01

Remove HTTP routes, port negotiation, API bearer/session credentials, browser auto-open, `--no-open`, a mandatory npm CLI binary, and standalone login/profile chrome. There is no localhost service to wrap with a Webviewer or iframe.

Retain root containment, safe source decoding, path validation, and input validation: those protect the filesystem and renderer, independently of HTTP.

## Do not simply rename artifacts

Replace standalone acceptance tests with real Obsidian host tests. Verify tab open/close, split views, plugin disable/re-enable, workspace restoration, pop-out migration, and theme changes. Keep a browser fixture harness for UI testing, but do not treat it as proof of Obsidian integration.

## Existing code reconciliation

Before implementation, inventory the actual repository. Preserve working Vue, Three.js, test, and data-model code where it fits. If a CLI already exists, leave it isolated rather than destructively deleting it; do not make the plugin depend on running it. If no implementation exists, start with the native plugin slice.

Existing mockup numbers, user accounts, “by fallow” branding, safe-delete percentages, and unauthenticated confidence claims are not functional requirements. Name the plugin Codebase Inspector and label providers factually.
