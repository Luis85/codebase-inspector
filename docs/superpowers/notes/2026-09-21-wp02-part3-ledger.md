---
project: codebase-inspector
title: WP-02 Part 3 — SDD ledger (rulings)
date: 2026-09-21
branch: feat/wp-02-part3
---

# WP-02 Part 3 — rulings

Every ruling made while planning and executing Part 3, with what it costs if it is wrong.
Spec: `docs/superpowers/specs/2026-09-21-inspector-ui-part3-design.md`. Plan:
`docs/superpowers/plans/2026-09-21-inspector-ui-part3.md`.

## Planning rulings

| # | Ruling | Cost if wrong |
|---|---|---|
| R1 | Part 3 strings live in `src/ui/audit-copy/<screen>.ts`, each re-exported by `inspector-copy.ts` with `export *`. That file is at 283/400, and six screens of copy would pass the cap. Screens still import only from `inspector-copy`. | Low. Folding the files back is mechanical. |
| R2 | Fixture *data* (package names, versions, licences, advisory text) lives in `fixtures/sample-packages.ts`, not copy, like the prototype's `data.js`. UI labels stay in copy. | Low. It could be moved if a copy contract ever scans fixtures. |
| R3 | Test results are sample runs seeded per **real** test file (category `test`). With none, the tab shows an empty state and the card is unknown. "Runtime evidence" in the brief is read as runtime exploitability and reachability, which stay unknown. | Medium. If test runs should also be unknown, one card and one tab change to the not-collected state. |
| R4 | Ownership "Show in city" uses the city's path-substring search (`<module>/`). It can also dim-match a nested folder with the same name. No new state is added. | Low. A precise module filter needs a city-store change. |
| R5 | The Finding review dialog stays open after acknowledge, reopen and dismiss, and shows the new state. On close, focus goes to the opener, or to the row now at the same index, the reset button, or the panel. | Low. UX preference only. |
| R6 | The security review checklist is screen-local and not persisted. It is labelled "Not saved". The durable action is the package review work item. | Low. Persisting it would need a new port shape. |
| R7 | `inert` gets its own task (14), apart from the screens, so it can be reviewed and rejected on its own. | None. |
| R8 | The Evolution provenance flag is `store.snapshot !== null`: activity and coupling are always sample. | None. |
| R9 | Finding "Add work item" creates the file's **refactor** item (`addWorkItemForFile`), so File detail, FileInspector and the dialog agree on "In refactor plan". | Low. |

## Execution rulings

(Appended per task.)
