// IN51 (b), gap closure GRD10: the frontmatter value shapes the native fact test round-trips through
// the real Obsidian stringifyYaml/parseYaml. tests/unit/yaml-parity.test.ts round-trips the same
// table through the mock's pair, so a value the mock would type-coerce fails in a fast run too.
export const YAML_FACT_VALUES: Readonly<Record<string, string>> = {
  a: 'yes', b: 'null', c: '0012', d: 'a: b', e: 'true', f: '~', g: '#x', h: '[[x]]',
  i: 'snapshot:p1:2026-09-25T10:00:00.000Z', j: 'src/a.ts#UN-00000001', k: 'file:src/a.ts',
};
