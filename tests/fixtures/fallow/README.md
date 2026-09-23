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
