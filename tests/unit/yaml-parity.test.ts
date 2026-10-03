// Gap closure GRD10: the native fact test (tests/e2e/obsidian-facts.e2e.ts) round-trips these values
// through Obsidian's own stringifyYaml/parseYaml. The mock's pair must agree on VALUES (never bytes,
// see tests/mocks/obsidian.ts), or a fast test could pass on a coercion the real host does not make.
import { describe, expect, it } from 'vitest';
import { parseYaml, stringifyYaml } from '../mocks/obsidian';
import { YAML_FACT_VALUES } from '../support/yaml-facts';

describe('the mock stringifyYaml/parseYaml agree with the native fact table (GRD10)', () => {
  it('round-trips the whole table to an equal value', () => {
    expect(parseYaml(stringifyYaml({ ...YAML_FACT_VALUES }))).toEqual(YAML_FACT_VALUES);
  });

  it.each(Object.entries(YAML_FACT_VALUES))('keeps %s = %j a string on its own', (key, value) => {
    const parsed = parseYaml(stringifyYaml({ [key]: value })) as Record<string, unknown>;
    expect(parsed[key]).toBe(value);
    expect(typeof parsed[key]).toBe('string');
  });

  it('every value stays a string, with none dropped, when round-tripped together', () => {
    const values = Object.values(parseYaml(stringifyYaml({ ...YAML_FACT_VALUES })) as Record<string, unknown>);
    expect(values).toHaveLength(Object.keys(YAML_FACT_VALUES).length);
    expect(values.every((value) => typeof value === 'string')).toBe(true);
  });
});
