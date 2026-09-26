---
type: Deliverable
order: 9.375
id: WP-04
title: Investigation workbench and Markdown notes
status: planned
dependsOn:
  - WP-02
parent: "[[Plugin MVP]]"
---
# Package 04 — Investigation workbench and Markdown notes

## Outcome

“I can investigate a finding, record the evidence and uncertainties in my vault, and turn the result into a concrete engineering task or decision.”

## Scope

Add a prioritized/filterable finding list, evidence inspector, bounded read-only source preview, clone-group inspection, optional supported symbol tracing, and explicit note creation. WP-03 enriches relationships but is not a prerequisite for note creation.

## Work

| Task | Deliverable |
|---|---|
| 04.1 | Finding list, native categories/rules, stable selection |
| 04.2 | Safe bounded source preview and stale-location checks |
| 04.3 | Evidence bundle and uncertainty/verification panel |
| 04.4 | Vault note destination/settings and escaped note templates |
| 04.5 | Create/open investigation; collision-safe filenames |
| 04.6 | Human-section-preserving refresh and note-link reconciliation |
| 04.7 | End-to-end finding → note → evidence tests |

## Note model

Proposed frontmatter:

```yaml
---
type: codebase-investigation
codebase_id: "project-uuid"
entity_id: "stable-file-id"
source_path: "src/domain/example.ts"
snapshot_id: "snapshot-uuid"
finding_fingerprint: "provider-fingerprint"
provider: "fallow"
status: "open"
---
```

These are application-defined fields, not a fallow or Obsidian standard. Use an actual YAML serializer/escaping policy for arbitrary strings. Frontmatter stores portable identifiers and relative paths, never a machine root or shell command.

The note body separates generated evidence from human content: context, observed finding, source/scope/time, uncertainties, investigation notes, proposed change, verification checklist, and decision. A re-analysis may update a clearly delimited generated evidence block after confirmation; it must not overwrite the human narrative. A changed analysis is not automatic completion of the engineering task.

## Source actions

For a supported indexed vault file, open it with the host's workspace capabilities. For code not natively editable in Obsidian, use the plugin's read-only preview or a separately configured explicit external-editor action. Do not present every `.ts` file as a writable Markdown document. External IDE URI creation must escape path components and cannot be sourced from arbitrary report-provided commands.

## Write safety

Use the Vault API for note creation/update [S4]. The user chooses the destination and invokes creation; scans do not create notes. Prevent path traversal and accidental overwrite. Where vault and codebase overlap, exclude generated note destinations from future scans/watch triggers by default.

## Acceptance

A city finding opens the same evidence in the workbench. Creating an investigation writes one well-formed note to the chosen folder, with no source-project edit. Existing notes are not overwritten, arbitrary filenames/messages cannot inject unsafe markup, and human sections survive evidence refresh. When source changes invalidate a line number, show stale evidence instead of a misleading exact highlight.

## Non-goals

Automatic deletion, fabricated “safe to delete” percentages, source auto-fix, ticket-system synchronization, and replacement of the team's existing backlog plugin.

## Delivery record

Built on branch `feat/wp-04-part1` (fast-forwarded onto `feat/wp-01-codebase-city`, so it
lands on PR #1); design in
`docs/superpowers/specs/2026-09-25-wp04-part1-investigation-design.md` (IN1–IN51, owner
decisions O1–O8).

**Scope: the whole task table, 04.1–04.7, plus the native acceptance harness (O8).** Part 1
delivers a new **Investigate** screen: the same evidence Quality reads, a bounded
read-only source preview with a stale-location rule, an evidence bundle and uncertainty
panel, and explicit Markdown-note creation and refresh in the user's own vault (O3, O4).
Notes are the record — no link table — read back through Obsidian's own metadata cache.

| Task | Deliverable | Decisions |
|---|---|---|
| 04.1 | Finding list, native categories/rules, stable selection | IN1–IN6 |
| 04.2 | Safe bounded source preview and stale-location checks | IN7–IN13 |
| 04.3 | Evidence bundle and uncertainty/verification panel | IN14–IN17 |
| 04.4 | Vault note destination/settings and escaped note templates | IN18–IN25 |
| 04.5 | Create/open investigation; collision-safe filenames | IN26–IN30 |
| 04.6 | Human-section-preserving refresh and note-link reconciliation | IN31–IN36 |
| 04.7 | End-to-end finding → note → evidence tests | IN37–IN40 |
| Task 0 | Native Obsidian acceptance harness, ported from `Luis85/describe` (O8) | IN42–IN51 |

**Out of Part 1** (O1): clone-group inspection and symbol tracing (the deliverable's
optional items); an external-editor action (O5) — Source actions stay the read-only
preview and, for a Markdown file inside the vault, Open in Obsidian; automatic status
sync (O6) — a note's `status` is the user's own and nothing writes it but creation; and
every deliverable non-goal above. **Notes may be written inside the codebase root** (O7),
but only after you confirm the create dialog, which names the overlap and offers,
checked, to exclude the folder — the checkbox also adds the folder to the codebase's scan
exclusions (IN29) — the one exception to "no writes in the directory you select", stated
in the README and the two settings disclosures (IN41).

Acceptance, item by item, is recorded in
`docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`'s **WP-04 Part 1** section,
added by task 18: the spec §5 acceptance table (in-memory and native test citations), the
Task 16 mutation runs, the five spec §6 pre-flight probe results with their IPF rulings,
the `wp04-*` harness captures, and a **native acceptance** subsection — the stack and its
origin, `npm run test:e2e` at the baseline Obsidian version (1.13.4) and at
`OBSIDIAN_VERSION=latest` (resolved to 1.13.7 on this run), the ten required scenarios,
the fail-closed gate's output line, and the platform and commit from the environment
evidence. The limitations this part carries — stale detection by size/lines/time rather
than content, a refresh's re-serialised frontmatter, the per-codebase metadata-cache
index, a notes folder equal to the root being scanned, the deferred items above, the test
YAML serialiser, Obsidian's own escape handling, the desktop-only `no-filesystem` state,
and native acceptance being local-only — are in
`docs/superpowers/notes/2026-09-17-wp01-limitations.md`'s **WP-04 Part 1** section.
