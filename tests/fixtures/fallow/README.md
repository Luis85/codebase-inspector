# fallow fixtures (WP-02 Part 6, Y21)

Raw fallow JSON reports of the fixture project in `project/`, recorded once and committed
verbatim, `fragment` and `actions` included: the tests prove those fields are dropped.
Never edit a recording by hand. Re-record with the commands below and review every test
that changes.

## The fixture project

`project/` is a package.json and five small TypeScript files (`.ts`, because
`unused_types` needs TypeScript). A dry run with fallow 3.27.0 found exactly:

- one unused export, `unusedHelper` in `src/text/format.ts`;
- one unused type, `LabelOptions` in `src/text/format.ts`;
- one clone group across `src/text/sum-a.ts` and `src/text/sum-b.ts` (lines 1–15);
- one complexity finding above the default thresholds, `partitionDistrict` in
  `src/layout/partition.ts` (cognitive 32 against 15).

It is excluded from `tsconfig.test.json`, eslint and oxlint. The repository's own
`npm run analyze` scans `src` only.

## Recordings

Recorded on 2026-09-23 from the repository root, in Git Bash, with the fallow binaries
already in the npx cache (`npx --offline`, no download). Nothing under `src/` or in
`package.json` runs fallow.

| File | fallow | kind, schema | Command |
|---|---|---|---|
| `combined-3.27.0.json` | 3.27.0 | combined, 12 | `fallow --format json --no-cache --quiet --root tests/fixtures/fallow/project` |
| `dead-code-3.27.0.json` | 3.27.0 | dead-code, 9 | `fallow dead-code --format json --no-cache --quiet --root tests/fixtures/fallow/project` |
| `health-3.27.0.json` | 3.27.0 | health, 11 | `fallow health --format json --no-cache --quiet --root tests/fixtures/fallow/project` |
| `dupes-3.27.0.json` | 3.27.0 | dupes, 10 | `fallow dupes --format json --no-cache --quiet --root tests/fixtures/fallow/project` |
| `combined-3.21.0.json` | 3.21.0 | combined, 11 | `fallow --format json --no-cache --quiet --root tests/fixtures/fallow/project` |

Each command was run as `npx --offline --yes fallow@<version> <arguments> > <file>`.

## Values that change on every recording

`elapsed_ms` (at every level) and `_meta.telemetry.analysis_run_id` differ on every run,
and `workspace_diagnostics` depends on the machine (for example, whether `node_modules`
exists). The parser drops the first two; no test asserts on them, and the tests compare
warnings with each recording's own `workspace_diagnostics` messages.

## Relations project (WP-03 Part 1, N34)

`relations-project/` is a package.json, a `.fallowrc.json` with a three-zone boundary
config (`ui` may reach `core` and, type-only, `data`; `core` and `data` may reach
nothing), and eleven small TypeScript files under `src/`, each contributing exactly one
relation kind so every later task's fixtures come from a real fallow run, never a guess:

- `src/core/a.ts` → `b.ts` → `c.ts` → `a.ts`: a 3-file import cycle.
- `src/barrel/index.ts` ↔ `src/barrel/x.ts` (`src/barrel/y.ts` re-exported through
  `index.ts`): a 2-file re-export cycle (`export * from`).
- `src/ui/view.ts` imports `src/data/db.ts`: the one boundary violation (`ui` → `data`,
  not type-only).
- `src/index.ts` imports `./does-not-exist` on line 4: the one unresolved import.
- `src/orphan.ts`: disconnected, imported by nothing.

It is excluded from `tsconfig.test.json`, eslint and oxlint the same way `project/` is.

### Recordings

Recorded on 2026-09-24 from the repository root, in Git Bash, with the fallow binaries
already in the npx cache (`npx --offline`, no download; both versions resolved without
falling back to the cached `fallow.exe` directly).

| File | fallow | kind, schema | Command |
|---|---|---|---|
| `relations-combined-3.27.0.json` | 3.27.0 | combined, 12 | `npx --offline --yes fallow@3.27.0 --format json --no-cache --quiet --root tests/fixtures/fallow/relations-project > tests/fixtures/fallow/relations-combined-3.27.0.json` |
| `relations-combined-3.21.0.json` | 3.21.0 | combined, 11 | `npx --offline --yes fallow@3.21.0 --format json --no-cache --quiet --root tests/fixtures/fallow/relations-project > tests/fixtures/fallow/relations-combined-3.21.0.json` |
| `relations-no-boundaries-3.27.0.json` | 3.27.0 | combined, 12 | `.fallowrc.json` moved to a scratch path, then `npx --offline --yes fallow@3.27.0 --format json --no-cache --quiet --root tests/fixtures/fallow/relations-project > tests/fixtures/fallow/relations-no-boundaries-3.27.0.json`, then `.fallowrc.json` moved back |

`git status --short tests/fixtures/fallow/relations-project` was empty after every
recording (checked by comparing `find tests/fixtures/fallow/relations-project -type f |
sort` before and after, since the project is new and untracked): fallow wrote nothing
into the project.

### Observed facts (Step 4, ruling JF2)

| Fact | `relations-combined-3.27.0.json` | `relations-combined-3.21.0.json` | `relations-no-boundaries-3.27.0.json` |
|---|---|---|---|
| `schema_version` | 12 | 11 | 12 |
| `workspace_diagnostics` key present | yes | **no** (key absent entirely, not `[]`) | yes |
| `workspace_diagnostics[].kind` | `node-modules-missing`, `rule-packs-not-configured` | — (key absent) | `node-modules-missing`, `boundaries-not-configured`, `rule-packs-not-configured` |
| `circular_dependencies` count | 2 | 2 | 2 |
| `circular_dependencies` entries carry `edges` | yes | yes | yes |
| `circular_dependencies` files | `[src/barrel/index.ts, src/barrel/x.ts]` (length 2, line 1, col 0); `[src/core/a.ts, src/core/b.ts, src/core/c.ts]` (length 3, line 1, col 9) | identical to 3.27.0 | identical to 3.27.0 |
| barrel pair also in `circular_dependencies` | yes (both the cycle and the re-export cycle report it) | yes | yes |
| `re_export_cycles` count | 1 | 1 | 1 |
| `re_export_cycles` entry | `kind: "multi-node"`, `files: [src/barrel/index.ts, src/barrel/x.ts]` | identical | identical |
| `boundary_violations` count | 1 | 1 | **0** (`[]`) |
| `boundary_violations` entry | `src/ui/view.ts` → `src/data/db.ts` (`from_zone: ui`, `to_zone: data`, line 3, col 9) | identical | — |
| `unresolved_imports` count | 1 | 1 | 1 |
| `unresolved_imports` entry | `src/index.ts`, specifier `./does-not-exist`, line 4, col 0 | identical | identical |
| `health.file_scores` is an array | yes (6 entries) | yes (6 entries) | yes (6 entries) |
| `health.file_scores` lists `src/orphan.ts` | **no** | no | no |

`health.file_scores` only lists files fallow scored (`core/a.ts`, `core/b.ts`,
`core/c.ts`, `ui/view.ts`, `index.ts`, `barrel/y.ts`); it omits `src/orphan.ts`,
`src/barrel/index.ts`, `src/barrel/x.ts`, `src/data/types.ts` and `src/data/db.ts`. This
matches the brief's Step 4 expectations exactly, with no divergence to flag: on
3.27.0-with-boundaries there is no `boundaries-not-configured` diagnostic and exactly one
boundary violation; on 3.21.0 `workspace_diagnostics` is entirely absent (JF2); on the
no-boundaries recording `boundary_violations` is empty and `boundaries-not-configured` is
present.
