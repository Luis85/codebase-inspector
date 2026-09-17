# Codebase Inspector — WP-01 interaction reference and handoff

Version **1.1** · 17 September 2026 · English UI · Obsidian desktop target.

Open **index.html** for the self-contained interactive review. Open **gallery.html** for the current-run captured states. Read **docs/01-behavior-baseline.md** before implementation.

This extends the earlier complete UI/UX package; it does not replace the twelve-package implementation roadmap. It concentrates on the first structural city. The production stack remains **Obsidian + TypeScript + Vue 3 + Pinia + Three.js**.

## What is usable here

The offline reference supports pointer orbit/pan/zoom, file selection and explicit focus, top/3D camera restoration, path search, preserved selected nonmatches, exact fixture measurements, panel/drawer behavior, equivalent HTML inventory, modal focus, clipboard recovery, and simulated refresh/cancel/fail flows. A sibling-note fixture checks keyboard ownership. It uses 144 synthetic files and performs no filesystem access, analyzer execution, vault writes, or runtime network requests.

The city is drawn by a **dependency-free Canvas 2D projection simulator**, not by Three.js. The Three.js dependency could not be downloaded in the authoring environment. Do not ship this simulator as the product renderer. The production renderer boundary is specified in `integration/renderer-port.ts` and its bridge document. This archive is not an installable Obsidian plugin.

## Read order

1. `docs/01-behavior-baseline.md` — first-release decisions and interaction rules.
2. `docs/02-state-and-command-contract.md` — ownership, events, publication guards.
3. `docs/03-threejs-and-obsidian-bridge.md` — component/renderer/host integration.
4. `docs/04-first-release-build-order.md` — eight implementation packets inside WP-01.
5. `docs/05-review-script-and-host-gates.md` — walkthrough and remaining validation.
6. `docs/06-decisions-and-traceability.md` — refinement decisions and test linkage.
7. `docs/07-sources-and-limits.md` — primary sources and evidence boundaries.
8. `docs/08-implementation-agent-prompt.md` — bounded implementation-session prompt.

## Validation results

**31 state tests passed. 28 browser checks passed.** The recorded browser run had no script errors or network requests. These are tests of the reference only, not Obsidian, Three.js, source safety, screen-reader accessibility, or real-codebase performance. Outstanding production gates are explicit in the validation document. Twelve accepted screenshots were captured from the current reference.

The browser environment used Playwright `set_content` with the bundled HTML because local `file:` navigation is blocked by its policy. A user-controlled browser can open the self-contained file normally where local-file policy permits. No server is part of the plugin design.

## Editable sources and rerunning checks

`src/` contains the page template, styles, fixture, state model, simulator, and application wiring. Rebuild the single HTML file using the Python standard library:

```sh
python build.py
node --test validation/model.test.cjs
```

Browser checks require Playwright and an installed Chromium. Set `CHROMIUM_PATH` when it is not `/usr/bin/chromium`, then run:

```sh
python validation/browser-tests.py
```

Run the TypeScript declaration check with your project's TypeScript compiler:

```sh
tsc --noEmit --strict --target ES2020 --lib ES2020,DOM integration/renderer-port.ts
```

The development checks are not commands that the Obsidian plugin should install or run on a user's machine. The review fixture's no-dependency package manifest is not the production plugin's package manifest.

## Do not carry into production

Do not copy the artificial host shell, preview theme picker, failure simulator, static scan consent, fake note, Canvas 2D renderer, or `__CI_REVIEW__` debug hook into the plugin. Use the behavioral invariants and reconcile the proposed type contracts with the actual repository before implementing them.
