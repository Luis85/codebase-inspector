# codebase-inspector

Explore any local codebase as an interactive 3D city inside an Obsidian tab.

**Desktop only.** Requires Obsidian 1.13.0 or later (`minAppVersion`). WP-01 is the
structural increment: it selects a source directory, reads a read-only inventory of it,
and renders that inventory as a city you can search and inspect. It performs no
analysis of any kind.

## What this plugin reads, and what it never does

Codebase Inspector reads source files and file metadata from a directory you
explicitly select and approve — including directories **outside your vault**.
That is the point of the plugin: it builds a structural map of a local codebase.

- It reads **file text and file metadata only**. It never writes, moves, renames
  or deletes anything in the directory you select, with one exception you confirm
  each time: an investigation note you create in a folder inside that directory.
- It runs **no project scripts** and installs **no dependencies**.
- It makes **no network requests of any kind** and collects **no telemetry**.
- Reading begins only after you approve a specific directory and scope. Changing
  the directory or the scope invalidates that approval.

Two claims appear in the interface — "Read-only source access" and "Source remains
unchanged." — and the evidence they rest on is recorded in
[`docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`](docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md),
section G2.

## Installing

Not in the community directory. Install by hand:

1. Create `<your vault>/.obsidian/plugins/codebase-inspector/`. The folder name must be
   exactly `codebase-inspector`.
2. Copy in `main.js`, `styles.css` and `manifest.json` — those three files and nothing
   else.
3. Enable *Codebase Inspector* in Settings → Community plugins.

To build them yourself: `npm ci && npm run build`, which writes exactly those three
files to `dist/`.

## What it does not do yet

Snapshots are **in memory only**: reopening a view shows the retained state with its
age, and an Obsidian restart clears it. Findings and dependency relations come from a
fallow report you run or import; that report is **session-only** too, held in memory and
gone on restart the same as the snapshot. Coverage is still sample data, never a real
measurement. Investigation notes are the one write this plugin makes: a Markdown note is
written into your vault only when you confirm the create or refresh dialog for it (see
above), and there is still no external-editor action. Symbolic links and junctions are
never followed; they are reported as skipped.

The full record, including what has and has not been verified — **the perceptual half of
accessibility has not been checked by anybody, and the performance figures are not GPU
measurements** — is in
[`docs/superpowers/notes/2026-09-17-wp01-limitations.md`](docs/superpowers/notes/2026-09-17-wp01-limitations.md)
and
[`docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`](docs/superpowers/notes/2026-09-17-wp01-implementation-report.md).

## License

MIT — see [`LICENSE`](LICENSE). Bundled dependencies: three, vue, pinia and zod, all MIT.
