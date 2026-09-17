# Snapshot import contract

This is a small **demo interchange format**, not the complete production evidence schema and not fallow's native output contract. All data is loaded into memory after explicit file selection. The app does not resolve these paths on disk.

```json
{
  "schemaVersion": 1,
  "name": "Example repository",
  "files": [
    {"id":"file-main", "path":"src/main.ts", "lines":120, "bytes":4096},
    {"id":"file-view", "path":"src/ui/CityView.vue", "lines":280, "bytes":9200},
    {"path":"tests/city.test.ts", "lines":96, "bytes":2500},
    {"path":"assets/banner.bin", "lines":null, "bytes":16384}
  ]
}
```

`schemaVersion` must be the number 1. `files` may be empty and must contain at most 10,000 entries. The file chooser limits source JSON to 10 MiB. `name` is optional and displayed as text, limited to 120 characters. Imported `source` labels are not authenticity attestations; origin/provenance validation must be added to the production evidence model.

Paths are repository-relative, case-preserved, maximum 1,024 characters. Backslashes are normalized to slashes. Absolute paths, drive prefixes, traversal segments, empty segments, and control characters are rejected. Paths and IDs must each be unique. If `id` is omitted, the normalized path acts as the ID. Prefer stable explicit IDs in integrations that need rename continuity. This demo does not reconcile file moves.

`lines` and `bytes` are nonnegative safe integers no larger than 10^12, or null. Omitted metrics become null. **Null means unavailable; zero is a measured value.** Physical lines include comments and blank lines; the collector supplying the snapshot must define and measure its counting convention. Source text is not included or executed.

`category` is optional. Supported values are TypeScript, JavaScript, Vue, Tests, Styles, JSON, Markdown, Other. The implementation infers a category from path when an unknown category is supplied; test-file patterns take precedence over language extensions. `fixtures/snapshot.schema.json` documents the recommended stricter authoring format.

## Visual encoding

| Channel | Definition |
|---|---|
| District | First directory; `src`, `apps`, and `packages` group one level deeper |
| Lot | One file, equal 1×1 building footprint |
| Height for lines | `min(18, 0.28 + sqrt(lines) * 0.235)` |
| Height for bytes | `min(18, 0.28 + sqrt(bytes / 40) * 0.235)` |
| Height unavailable | Base 0.28; inspector states unavailable |
| Color | File category |
| Highlight | Selected file, independent of filter |
| Dim | Outside the current search/category predicate |

The square-root scale and height cap are deliberately disclosed: height is a compressed structural visualization, not a linear precision chart. Zero and unavailable may share a minimum-height lot but are distinguished in the inspector and HTML table. Summary metrics report unavailable-count context; missing values must not be presented as fully measured totals.

Files are sorted before deterministic district/lot allocation. Identical input gives identical geometry. Filtering does not modify geometry. Adding or removing files can change the layout; stable historical anchoring belongs to a later package.

## Import failures

Validate the complete candidate before replacing the current snapshot. Reject malformed JSON, incompatible schemas, duplicate identity, oversized reports, illegal paths, or invalid measurements. Keep the previous valid view and offer a readable error. Do not try to turn a raw analyzer finding array into a complete file inventory.
