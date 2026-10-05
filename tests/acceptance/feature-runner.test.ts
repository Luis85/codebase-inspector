// runFeature's per-scenario timeouts (WP-04.2 follow-up E3). A scenario named in
// `timeouts` is registered with that budget, every other scenario keeps Vitest's
// default, and a budget naming no scenario refuses to register at all: a reworded
// scenario must not quietly fall back to the default it was given a budget to escape.
import { expect, it } from 'vitest';
import { parseFeature, runFeature } from './feature-runner';

const feature = parseFeature([
  'Feature: timeout probe',
  'Scenario: Slow one',
  'Given a step',
  'Scenario: Fast one',
  'Given a step',
].join('\n'));
const steps = { 'a step': () => {} };

runFeature({ feature, steps, makeWorld: () => ({}), timeouts: { 'Slow one': 12_345 } });

it('registers the named scenario with its budget and leaves the others on the default', ({ task }) => {
  const suite = task.file.tasks.find((t) => t.name === 'timeout probe');
  if (suite?.type !== 'suite') throw new Error('runFeature registered no "timeout probe" suite');
  const budgets = Object.fromEntries(
    suite.tasks.map((t) => [t.name, t.type === 'test' ? t.timeout : undefined]),
  );
  // This test itself runs on the default, which is what 'Fast one' must still have.
  expect(task.timeout).not.toBe(12_345);
  expect(budgets).toEqual({ 'Slow one': 12_345, 'Fast one': task.timeout });
});

it('refuses a timeout that names no scenario, before registering anything', () => {
  expect(() => runFeature({ feature, steps, makeWorld: () => ({}), timeouts: { 'Slow 1': 1 } }))
    .toThrow('timeouts name no scenario: Slow 1');
});
