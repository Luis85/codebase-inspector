// A Gherkin runner small enough to read in one sitting, because the alternative was a
// Cucumber dependency for one feature file. It parses the subset wp01.feature actually
// uses (Feature, Scenario, Given/When/Then/And/But, # comments, @tags) and runs each
// scenario as a vitest `it`, in file order, one step at a time.
//
// Two properties make this a real gate rather than documentation:
//
//   1. A step with NO implementation fails its scenario, naming the step. A feature
//      file that quietly outruns its steps is the failure mode a hand-written
//      "acceptance" suite always has.
//   2. `assertNoUnusedSteps` fails when the step table carries an entry no scenario
//      names. That is task-12-context.md §0's own defect class -- a capability with no
//      caller -- applied to this suite's own code, and it is checked here because a
//      step definition is exactly the kind of thing that survives a reworded scenario.
//
// Steps are keyed by their EXACT text, with the keyword stripped, so two scenarios that
// say the same sentence share one implementation by construction. That is deliberate:
// if two sentences must mean different things, they must be worded differently.
import { describe, expect, it } from 'vitest';

export type StepKeyword = 'Given' | 'When' | 'Then' | 'And' | 'But';

export interface FeatureStep {
  keyword: StepKeyword;
  text: string;
}

export interface FeatureScenario {
  name: string;
  steps: readonly FeatureStep[];
}

export interface ParsedFeature {
  name: string;
  scenarios: readonly FeatureScenario[];
}

const KEYWORDS: readonly StepKeyword[] = ['Given', 'When', 'Then', 'And', 'But'];

/** Parses the Gherkin subset wp01.feature uses. Anything else (Background, Examples,
 *  doc strings, data tables) is deliberately unsupported: an unrecognised construct
 *  throws here rather than being silently skipped, so the file cannot grow a section
 *  this runner ignores. */
export function parseFeature(source: string): ParsedFeature {
  let featureName = '';
  const scenarios: FeatureScenario[] = [];
  let current: { name: string; steps: FeatureStep[] } | null = null;

  const lines = source.split(/\r?\n/);
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#') || line.startsWith('@')) continue;
    if (line.startsWith('Feature:')) {
      featureName = line.slice('Feature:'.length).trim();
      continue;
    }
    if (line.startsWith('Scenario:')) {
      if (current) scenarios.push(current);
      current = { name: line.slice('Scenario:'.length).trim(), steps: [] };
      continue;
    }
    const keyword = KEYWORDS.find((k) => line.startsWith(`${k} `));
    if (!keyword) {
      throw new Error(`wp01.feature line ${index + 1}: unsupported Gherkin construct: ${line}`);
    }
    if (!current) {
      throw new Error(`wp01.feature line ${index + 1}: step outside any scenario: ${line}`);
    }
    current.steps.push({ keyword, text: line.slice(keyword.length + 1).trim() });
  }
  if (current) scenarios.push(current);
  return { name: featureName, scenarios };
}

/** A step body. `world` is the per-scenario mutable state; steps within one scenario
 *  share it and nothing crosses a scenario boundary. */
export type StepFn<W> = (world: W) => void | Promise<void>;
export type StepTable<W> = Readonly<Record<string, StepFn<W>>>;

export function mergeSteps<W>(...tables: readonly StepTable<W>[]): StepTable<W> {
  const merged: Record<string, StepFn<W>> = {};
  for (const table of tables) {
    for (const [text, fn] of Object.entries(table)) {
      if (text in merged) throw new Error(`duplicate step definition: ${text}`);
      merged[text] = fn;
    }
  }
  return merged;
}

/** Property 2 above: every defined step is named by at least one scenario. */
export function assertNoUnusedSteps<W>(feature: ParsedFeature, steps: StepTable<W>): void {
  const used = new Set<string>();
  for (const scenario of feature.scenarios) {
    for (const step of scenario.steps) used.add(step.text);
  }
  const unused = Object.keys(steps).filter((text) => !used.has(text)).sort();
  expect(unused, 'step definitions no scenario names').toEqual([]);
}

export interface RunFeatureOptions<W> {
  feature: ParsedFeature;
  steps: StepTable<W>;
  makeWorld: () => W;
  /** Runs after every scenario, pass or fail, so a scenario that opened a modal, a
   *  temp tree or a mounted view cannot leak into the next one. */
  teardown?: (world: W) => void | Promise<void>;
}

export function runFeature<W>(options: RunFeatureOptions<W>): void {
  const { feature, steps, makeWorld, teardown } = options;
  describe(feature.name, () => {
    for (const scenario of feature.scenarios) {
      it(scenario.name, async () => {
        const world = makeWorld();
        try {
          for (const step of scenario.steps) {
            const fn = steps[step.text];
            if (!fn) throw new Error(`no step definition for: ${step.keyword} ${step.text}`);
            await fn(world);
          }
        } finally {
          await teardown?.(world);
        }
      });
    }
  });
}
