// Task 3 (FM10): pins the 'node-serial' project so fallow-no-freeze.test.ts (Z38,
// task 6) keeps running alone, after every other project. A silent edit to
// vitest.config.ts — a stray groupOrder, a dropped exclude — would otherwise let the
// no-freeze case run alongside other test files' child processes and timers again,
// which is exactly the flake the Z38 guard (fallow-no-freeze.test.ts) exists to catch.
import { describe, expect, it } from 'vitest';
import config from '../../vitest.config';

const NO_FREEZE_FILE = 'tests/integration/fallow-no-freeze.test.ts';

interface InlineProject {
  test?: { name?: string; include?: string[]; exclude?: string[]; sequence?: { groupOrder?: number } };
}

// vitest.config.ts's `test.projects` entries are typed as an inline object, a glob
// string, a Promise or a config function; this repo's config only ever uses plain
// inline objects, so this narrows out the other three possibilities the type allows.
function isInlineProject(project: unknown): project is InlineProject {
  return typeof project === 'object' && project !== null && !(project instanceof Promise) && 'test' in project;
}

const projects = (config.test?.projects ?? []).filter(isInlineProject);
// oxlint(unicorn/consistent-function-scoping): captures nothing from the it()s below.
const named = (name: string): InlineProject => {
  const found = projects.find((project) => project.test?.name === name);
  if (!found) throw new Error(`unreachable: no '${name}' project in vitest.config.ts`);
  return found;
};

describe('vitest project pin (FM10)', () => {
  it('gives node-serial exactly one project, including only the no-freeze test file', () => {
    const nodeSerialProjects = projects.filter((project) => project.test?.name === 'node-serial');
    expect(nodeSerialProjects).toHaveLength(1);
    expect(named('node-serial').test?.include).toEqual([NO_FREEZE_FILE]);
  });

  it("schedules node-serial's groupOrder after every other project's", () => {
    const nodeSerialOrder = named('node-serial').test?.sequence?.groupOrder;
    if (nodeSerialOrder === undefined) throw new Error('unreachable: node-serial always sets sequence.groupOrder');
    const others = projects.filter((project) => project.test?.name !== 'node-serial');
    expect(others.length).toBeGreaterThan(0);
    for (const project of others) {
      expect(project.test?.sequence?.groupOrder, project.test?.name).toBeLessThan(nodeSerialOrder);
    }
  });

  it("excludes the no-freeze file from the 'node' project", () => {
    expect(named('node').test?.exclude).toContain(NO_FREEZE_FILE);
  });
});
