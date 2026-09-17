---
type: Deliverable
order: 110
id: WP-07
title: Diagnostics and security evidence
status: planned
dependsOn: [WP-02]
---
# Package 07 — Diagnostics and security evidence

## Outcome

“I can inspect lint and security findings in source context while preserving their original meaning.”

## Scope

Add providers one at a time: the actual linter's JSON format, a deliberately supported SARIF subset, and a selected dependency-advisory report. Import first; executing tool configuration is a separate trust boundary. Record the supported format versions and maintain raw fixture tests for each adapter.

## Tasks

Implement per-format validation, normalized locations/fingerprints, native severity/rule display, package/version entities for dependency findings, duplicate detection, provider diagnostics, filters, and links into the existing investigation workflow.

## Safety and semantics

An advisory for package/version is attached to that dependency, not indiscriminately to every source building. A source-security rule is different from a dependency advisory. Applicability, reachability, exploitability, and remediation status are not interchangeable.

Do not merge all severities into a new universal risk percentage. Preserve native rule IDs, evidence, limitations, and direct report provenance. Treat HTML/Markdown/SARIF content and URLs as untrusted; do not execute scripts, download attachments, follow arbitrary local paths, or open an external site automatically.

No secret values should be retained in notes/logs when a provider reports a secret-like match. Use redacted locations and rule evidence where possible; exclude raw secret-bearing payloads from portable exports.

## Acceptance

Correct fixtures cover file diagnostics, dependency/version resolution, duplicate advisories, malformed locations, remote URIs, and malicious text. Missing providers do not break the city or imply clean security. Import causes no tool execution or network request.
