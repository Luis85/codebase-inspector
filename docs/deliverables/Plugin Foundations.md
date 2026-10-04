---
pbl-id: 7
type: Deliverable
order: 1
id: WP-00
title: Plugin foundations
status: delivered
parent: "[[Plugin MVP]]"
---
## Techstack

- TypeScript
- Vue
- Vue Pinia
- Vite
- Vitest
- Oxlint
- fallow
- eslint
- eslint-obsidian-plugin
- Obsidian 1.13
- Three.js

## Constraints

- src file max lines of code 400
- test file max lines of code 450
- typecheck on src and test

## Delivery record

Delivered in PR #1, on branch `feat/wp-01-codebase-city`: the repository is built on this
stack (see `package.json`), the 400-line source and 450-line test caps are `max-lines` errors in
`eslint.config.mjs`, and `npm run typecheck` checks `src`, the tests and the native
tests. `npm run verify` runs typecheck, lint, test and build together.
