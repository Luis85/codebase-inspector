# Sources and verification boundaries

Primary sources checked on **17 September 2026**. Public documentation can change; pin actual tool and host versions during implementation and keep compatibility fixtures. These sources establish available mechanisms and constraints, not measurements of this unimplemented project.

- **S1 — Obsidian API / plugin structure:** https://github.com/obsidianmd/obsidian-api/blob/master/README.md — plugin entry/module contract, dependency bundling, commands, ribbon, settings, data persistence, lifecycle helpers.
- **S2 — Obsidian custom views:** https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Views.md — ItemView, registration, lifecycle, multiple factory instances.
- **S3 — Obsidian plugin submission requirements:** https://docs.obsidian.md/community-directory/submission-requirements-for-plugins — desktop-only Node/Electron use, command IDs, minimum supported app version.
- **S4 — Obsidian Vault API guide:** https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Vault.md — visible/indexed vault files, hidden-file adapter distinction, note read/write APIs.
- **S5 — Obsidian developer policies:** https://docs.obsidian.md/community-directory/developer-policies — external-file/network disclosures, no plugin-managed dependency installation/update, no client telemetry, licensing.
- **S6 — Obsidian pop-out window support:** https://docs.obsidian.md/plugins/guides/pop-out-windows — separate window/document globals, element ownership, migration hook.
- **S7 — Three.js InstancedMesh:** https://threejs.org/docs/pages/InstancedMesh.html — repeated geometry, per-instance data, bounds, resource disposal.
- **S8 — Fallow repository README:** https://github.com/fallow-rs/fallow — analyzer capabilities, JSON output, distinction between successful runs with findings and operational errors; retrieved in the preceding planning exchange.
- **S9 — Fallow global flags:** https://docs.fallow.tools/cli/global-flags — root, output format, quiet, no-cache, size limits, scope, and implicit snapshot/output considerations.
- **S10 — Node.js child processes:** https://nodejs.org/api/child_process.html — asynchronous execution, shell distinction, Windows batch launcher limitations; test against the runtime embedded in the supported Obsidian version.
- **S11 — Fallow visualization:** https://docs.fallow.tools/cli/viz — documented visualization outputs; referenced and checked in the preceding implementation-plan exchange; revalidate exact supported formats before adapter work.
- **S12 — Fallow runtime coverage:** https://docs.fallow.tools/analysis/runtime-coverage — observation and tracking limitations; referenced in the preceding implementation-plan exchange; revalidate licensing and version support before integration.

## Important interpretation limits

No user's current codebase-inspector repository was inspected. No plugin was built or executed for this document revision. Minimum host/runtime versions, package versions, benchmarks, analyzer output schemas, and release eligibility must be established during implementation.

The displayed types, note fields, package IDs, renderer interfaces, and proposed code-block syntax are product design proposals. Do not cite them as existing official platform features.
