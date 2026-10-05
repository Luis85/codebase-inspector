# fake-fallow and the real-CLI facts it stands in for

`fake-fallow.mjs` is run by `tests/contracts/fallow-runner.test.ts` and
`tests/integration/fallow-analysis.test.ts` as `node fake-fallow.mjs --mode=<mode> …`. The
mode is an argument because the runner passes on only an allow-listed environment (Part 7
Z16). `ok`, `findings-exit-1`, `truncated`, `streamed` and `stderr-flood` print
`../fallow/combined-3.27.0.json`, the committed fallow 3.27.0 recording.

Modes: `version`, `version-4`, `version-untested`, `ok`, `findings-exit-1`, `error-exit-2`,
`garbage`, `truncated`, `huge` (17 MB), `streamed` (the report plus 12 MB of trailing
whitespace, in 64 KB writes), `stderr-flood` (1 MB of stderr), `hang`, `trickle` (a space
every 50 ms, forever), `env-dump`, `cwd`, `argv`, `grandchild` (writes `grandchild.pid` in
its cwd, then hangs), `html-stderr` (markup on stderr, exit 3).

## What the real fallow 3.27.0 did (probed 2026-09-23, native `fallow.exe`, Windows)

On a temporary copy of `../fallow/project`:

| Invocation | Observed |
|---|---|
| `fallow --version` | stdout `fallow 3.27.0`, exit 0 |
| `--format json --no-cache --quiet --root <p>` | exit 0 with findings; 13,185 bytes of stdout, 0 of stderr; no file created or changed under the root |
| a root that does not exist | exit 2; stdout `{"error":true,"message":"invalid root path '…': … (os error 2)","exit_code":2}`; stderr empty |
| the same without `--no-cache` | writes `<root>/.fallow/.gitignore`, `.fallow/cache.bin`, `.fallow/graph-cache.bin` |
| `--fail-on-issues` | exit 1 when issues exist (never passed by the plugin) |

`FALLOW_*` variables change fallow's behaviour, so the runner never passes them. Config files
in the root (`.fallowrc.json` and others) are honoured; a remote `extends` needs
`--allow-remote-extends`, which is never passed. `npm run test:fallow` re-checks these
against the pinned binary (`tests/fallow-real/fallow-real.test.ts`).
