// GRC5 (GCO13): axe-core over a mounted component tree, failing on serious and critical
// violations. A devDependency only: nothing under src imports this, so axe never reaches
// dist (scripts/assert-bundle.mjs).
import axe from 'axe-core';

/** The WCAG 2.0/2.1 A and AA rules. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Off for every case, never per screen:
 *  - color-contrast: jsdom has no layout or computed colours; GRC3's token test covers it.
 *  - region, landmark-one-main, page-has-heading-one: page-level rules, and we render
 *    inside an Obsidian leaf, never a page of our own. */
const GLOBALLY_OFF = ['color-contrast', 'region', 'landmark-one-main', 'page-has-heading-one'];

export interface AxeCaseOptions {
  /** Per-case rule disables, each with its recorded reason (GCN4: never global). Only a
   *  jsdom false positive may be disabled, and the case's comment names the ruling. */
  disable?: Readonly<Record<string, string>>;
}

export async function expectNoSeriousViolations(root: Element, options: AxeCaseOptions = {}): Promise<void> {
  if (!root.isConnected) throw new Error('axe: mount the tree into the document (attachTo) before checking it');
  const rules: Record<string, { enabled: boolean }> = {};
  for (const id of GLOBALLY_OFF) rules[id] = { enabled: false };
  for (const [id, reason] of Object.entries(options.disable ?? {})) {
    if (reason.trim() === '') throw new Error(`axe: a per-case disable of ${id} needs its reason`);
    rules[id] = { enabled: false };
  }
  const results = await axe.run(root, { runOnly: { type: 'tag', values: TAGS }, rules, resultTypes: ['violations'] });
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length === 0) return;
  const lines = serious.map((v) => {
    const targets = v.nodes.map((n) => `    ${n.target.join(' ')}  ${n.html.slice(0, 160)}`).join('\n');
    return `  ${v.id} (${v.impact ?? 'unknown'}): ${v.help}\n${targets}`;
  });
  throw new Error(`axe: ${serious.length} serious or critical violation(s)\n${lines.join('\n')}`);
}
