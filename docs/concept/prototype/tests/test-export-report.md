# Codebase quality & architecture review

**ILLUSTRATIVE DEMO REPORT — NOT A REAL REPOSITORY AUDIT**

Source: sample-workspace
Source type: Vault directory
Path label: projects/sample-codebase
Snapshot: Latest · 17 Sep 2026
Revision: a8f31c2

## Executive summary

144 files; 77,527 source lines; 101 open quality findings; 7 change hotspots. Branch coverage: 68% (9377/13853 branches). These independent signals are not a composite quality score.

## Architecture

One cyclic component: Domain ↔ Storage. Three Domain → Storage imports conflict with intended rule AR-001. Confirm architectural intent, characterize behavior, and consider a domain-owned persistence port.

Evidence: CostEngine.ts, BudgetService.ts, PriceResolver.ts.

## Quality hotspots

| File | Max cognitive complexity | Commits / 90d | Branch coverage | Review priority |
|---|---:|---:|---:|---:|
| src/assets/AssetStore.ts | 36 | 42 | 41% | 78 |
| src/editor/SelectionManager.ts | 38 | 39 | 52% | 75 |
| src/domain/CostEngine.ts | 42 | 31 | 46% | 74 |
| src/editor/ToolRegistry.ts | 43 | 37 | 88% | 70 |
| src/assets/AssetImporter.ts | 37 | 35 | 59% | 70 |
| src/storage/PathResolver.ts | 31 | 42 | 68% | 68 |
| src/storage/ReadModel.ts | 30 | 37 | 58% | 65 |
| src/assets/AssetPicker.ts | 25 | 36 | 41% | 64 |

Priority = min(100, round(100 × (0.42 × complexity/48 + 0.35 × commits/44 + 0.23 × coverage gap))). Weights and reference values are prototype assumptions, not an industry standard.

## Refactoring plan

- **RF-001: Separate cost calculation from persistence** — Planned; Core systems; src/domain/CostEngine.ts
- **RF-002: Add regression tests for selection changes** — Planned; Experience; src/editor/SelectionManager.ts
- **RF-003: Retire unused legacy helpers** — In progress; Core systems; src/shared/LegacyHelpers.ts
- **RF-004: Document the vault persistence boundary** — Verified; Platform; src/storage/VaultRepository.ts
- **RF-005: QA test: protect the cost boundary** — Verified; Experience; src/editor/PlanEditor.ts

## Reviewer note

QA note: review the persistence boundary.

## Scope and limitations

All measurements are synthetic, including static signals, history, coverage and security data. No real source files, packages, credentials or runtime traffic were analyzed. Coverage is not correctness; dependency graphs do not establish intended architecture; contribution history does not measure individual productivity. Missing evidence is unknown, not passing.

No source changes were made.
