// The harness is deliberately OUTSIDE `npm run verify` — it draws, it asserts no
// appearance, and there is no baseline to diff against. This file is what keeps it
// alive anyway: it runs under the ordinary suite, so a refactor that breaks the
// harness fails a test instead of being discovered the next time somebody wants a
// picture.
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { runningLifecycle, seedDemoItems } from './seed';
import { harnessLayout, harnessSnapshot } from './fixture';
import { applyScheme } from './theme';

const indexHtml = readFileSync('tests/harness/index.html', 'utf8');

describe('harness page', () => {
  it('loads the three stylesheets in the order that makes the page real', () => {
    const hrefs = [...indexHtml.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    // Obsidian's own defaults FIRST, so our resets strip what they strip in a vault;
    // then the harness chrome; then the plugin sheet, which must win over both.
    expect(hrefs).toEqual(['./obsidian.css', './harness.css', '/styles.css']);
  });

  it('serves the plugin stylesheet from source, not from a build', () => {
    // `/styles.css` is answered by the config's own middleware from src/ui/styles.css
    // on disk. If this ever became `../../dist/styles.css`, the page would silently
    // show whatever was last built rather than what is being edited.
    const config = readFileSync('vite.harness.config.ts', 'utf8');
    expect(config).toContain('src/ui/styles.css');
    expect(config).not.toContain('dist/styles.css');
  });
});

describe('harness fixture', () => {
  it('is big enough to look like a codebase and small enough to stay deterministic', () => {
    const snapshot = harnessSnapshot();
    const layout = harnessLayout();
    const files = snapshot.entities.filter((e) => e.kind === 'file');
    expect(files.length).toBeGreaterThanOrEqual(140);
    expect(layout.lots).toHaveLength(files.length);
    expect(layout.districts.length).toBeGreaterThanOrEqual(6);
  });

  it('is deterministic — two builds produce identical layouts', () => {
    expect(JSON.stringify(harnessLayout())).toEqual(JSON.stringify(harnessLayout()));
  });

  it('carries at least one unavailable-metric file, so S05 shows the unknown encoding', () => {
    // interactions/03: "Do not use a 0-height building as a proxy for unknown." A
    // fixture with no unavailable file cannot photograph that rule being kept.
    expect(harnessLayout().lots.some((lot) => lot.metricState === 'unavailable')).toBe(true);
  });

  it('is partial, with the warning a real scan writes when line counts are unavailable (Part 5 V30, Part 4 E17)', () => {
    const snapshot = harnessSnapshot();
    expect(snapshot.completeness).toBe('partial');
    expect(snapshot.warnings).toEqual(['binary content: physical lines are not defined']);
  });
});

describe('harness theme', () => {
  it('puts the host scheme classes on the body and nothing else', () => {
    applyScheme('light');
    expect(document.body.classList.contains('theme-light')).toBe(true);
    expect(document.body.classList.contains('theme-dark')).toBe(false);
    applyScheme('dark');
    expect(document.body.classList.contains('theme-dark')).toBe(true);
    expect(document.body.classList.contains('theme-light')).toBe(false);
  });
});

// oxlint(unicorn/consistent-function-scoping): captures nothing from the describe below.
const fileIds = () => harnessSnapshot().entities.filter((e) => e.kind === 'file').map((e) => e.id);

describe('harness seeding (Part 5 V30)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('seeds three work items, one per status column the prototype shows', async () => {
    await seedDemoItems(fileIds().slice(0, 3));
    expect(useReviewStore().workItems.map((w) => w.status)).toEqual(['planned', 'in-progress', 'verified']);
  });
  it('throws when fewer than three were created, so the page error fails the capture', async () => {
    await expect(seedDemoItems(fileIds().slice(0, 2))).rejects.toThrow('harness: items=demo seeded 2 of 3 work items');
  });
  it('counts a refused add (null) as missing, never as seeded', async () => {
    const ids = fileIds().slice(0, 3);
    await useReviewStore().addWorkItem({ kind: 'file', entityId: ids[0]! }, 'refactor', 'Already planned', new Date('2026-09-17T12:00:00Z'));
    await expect(seedDemoItems(ids)).rejects.toThrow('harness: items=demo seeded 2 of 3 work items');
  });
  it('seeds a running scan for ?run=running', () => {
    expect(runningLifecycle().run).toMatchObject({ status: 'running', processedFiles: 57 });
  });
});
