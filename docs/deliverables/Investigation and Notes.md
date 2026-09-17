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
