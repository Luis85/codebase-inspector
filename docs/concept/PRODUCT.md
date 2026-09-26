# Product brief

## Product definition

**Codebase Inspector helps developers and delivery teams understand the structure and evidence-backed condition of a codebase from within their Obsidian knowledge workspace.**

The workflow is: select a codebase, explore its city, inspect evidence, record an investigation or decision, and revisit it against a later snapshot. It connects code evidence to the notes where the team documents architecture, technical debt, and delivery decisions.

## First user outcome

“I can enable the plugin, choose a codebase inside or outside my vault, scan its files, and inspect an interactive Three.js city without installing anything in or modifying the source project.”

## Source modes

| Mode | Meaning | First availability |
|---|---|---|
| Current vault | The vault itself is the source root | WP-01 |
| Vault subdirectory | A chosen directory below the vault is the root | WP-01 |
| External directory | The vault is the documentation hub; code lives elsewhere | WP-01 |
| Imported evidence | A selected report is attached to a profile, or a portable snapshot is opened | WP-02 |

An external directory must be explicitly selected and authorized. Do not copy it into the vault or require a symlink. Multiple saved profiles may exist, but the first release needs only one active profile per city view.

## Scope and permission separation

Reading a source tree, running an analyzer, writing an investigation note, and exporting a report are four different actions. Opening a view or restoring a workspace must not silently perform all four. Source scans are read-only. Later note creation is an explicit, separate write to a chosen vault destination.

## Host choice

Use a native `ItemView` in a normal workspace tab, registered by the plugin. Mount the UI and WebGL canvas directly in the view. Obsidian provides commands, ribbon entry, settings, workspace management, and note storage [S1–S2]. Do not reproduce its global sidebar or add a second account system.

The initial plugin is desktop-only because direct filesystem access and native analysis execution use Node.js facilities; Obsidian requires the desktop-only manifest flag for that use [S3]. This is a scope recommendation, not a limitation of Three.js itself.

## City semantics

Repository = city; directory = district; file = building. Initial building height = measured physical text lines, footprint = equal lot, color = file category. No quality provider means “not analyzed,” not “healthy.” Dependency arcs require actual relationship evidence.

## Initial non-goals

Editing source, automatically deleting code, automatically installing fallow, security sandboxing, general-purpose code execution, remote repository cloning, cloud services, mobile analysis, a CLI, and a custom graphical IDE are not part of WP-01.

## Success evidence

The plugin can inspect a real external project and a vault-based project; searching and selection remain usable without WebGL; source values match fixtures; Obsidian remains responsive; disabling the plugin releases resources; source scans do not write project files. Do not measure success by city decoration or an unexplained universal quality score.
