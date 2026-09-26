# Visual encoding and evidence semantics

## Structural city: WP-01

City = selected codebase. District = configured directory grouping. Building = included file. Footprint = equal file lot. Height = physical text lines. Color = file category. Scope and exclusions are always inspectable.

For the reference fixture, use `height = 8 + 120 * sqrt(min(lines, 600) / 600)` in scene units. The 8-unit base keeps an empty measured file selectable. Label the display “physical lines · square-root scale.” The reference fixture uses only values below the 600-line cap. Production may choose another explicit scale, but it must preserve the metric definition, display cap, exact raw values, and legend. Do not silently apply a different scale in each district.

Physical line counting: empty file = 0; CRLF counts as one separator; final newline does not invent an additional phantom line; blank/comment lines count. Binary, invalid encoding, unreadable, or oversized content retains available metadata but its physical line count is unavailable. Do not use a 0-height building as a proxy for unknown. Use a neutral minimum-height shape with a question marker and expose the reason.

Top-down removes visible height cues; the inspector/list preserve all values. It is not a different metric. Changes to color lens preserve layout and camera. Changes to a snapshot may change layout in WP-01; stable cross-snapshot anchors are a WP-05 capability.

## Evidence lenses

| Lens | Data required | Encoding | Must not imply |
|---|---|---|---|
| Reported findings | Validated finding records and matching scope | Binned count / finding category, clear denominator | Files with no records are universally defect-free |
| Cognitive/cyclomatic complexity | Explicit function measurements or thresholded findings | Per-function or named aggregate with exact definition | Physical lines equal complexity; omitted function = 0 |
| Duplication | Clone groups and source spans | Linked members and unique grouped findings | Sum of per-file duplicated lines is unique duplicated code |
| Architecture | Typed directional dependency edges and rules | Focused arcs, edge list, boundary labels | Imports are call order or proven runtime impact |
| Coverage | Mapped covered/total observations by metric | Measured percentage, explicit zero, unknown hatch | Unknown means 0%; high coverage proves correct tests |
| Diagnostics/security | Original rule/advisory identities, target, severity | Source finding or package record, not indiscriminate heat | Dependency presence proves application exploitability |
| Bundle contribution | Exact build/chunk/module identities and units | Build treemap or city-linked contribution | Source size equals shipped size or runtime cost |
| Runtime observation | Build, source map, window, environment, sampling | Observed / not observed / not instrumented / unmapped | No observation means unused forever |

Fallow’s health command documents thresholded complexity findings and additional health/coverage sections [S11]. The adapter must inspect the actual report contract before claiming complete measurements. Do not repurpose a vendor grade as a composite product-health score.

## Aggregation rules

Count findings by stable canonical identity and distinguish groups, spans, files, symbols, and package advisories. The review fixture has 12 canonical findings across 11 files; its family breakdown is illustrative. Do not sum cards with different units as if they were a single defect count.

Coverage: sum covered and total observations of the same metric/scope before division. Never average file percentages. Show a zero denominator as not applicable/unavailable, not 0% or 100%. The same file must not be counted twice through overlapping source maps.

Complexity: a district aggregate must name `max function cognitive complexity`, `median measured function complexity`, or another defined statistic. Do not label an average of a thresholded subset “average codebase complexity.” Prefer counts of reported findings when the complete measurement universe is unknown.

Dependency graph: default to outgoing imports and one hop. Define importer → imported module. Distinguish import, type-only import, co-change, and runtime-call edges. Show edge caps and hidden counts. Expand only after explicit action; use a list for dense relationships.

Comparisons: require compatible definitions, scope, identity mapping, and provider configuration or show a mismatch. A failed provider cannot resolve earlier findings. Deleted, excluded, renamed, and unavailable files are different. Keep visual scales shared between before/after views.

## Always-visible evidence language

Prefer “No finding reported in this scope,” “Not measured,” “Measured zero,” “Not instrumented,” “Imported report,” “Source mismatch,” “Retained snapshot,” and “Not observed during this window.” Do not use “Safe to delete,” “Tests will pass,” “Healthy code,” or “No risk” without evidence supporting that precise claim.

An action recommendation is a next investigation step, not a correctness guarantee. Its explanation names contributing facts and missing evidence. An opaque confidence ring is excluded.
