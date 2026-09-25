import { describe, expect } from 'vitest';
import { PROBE_ESCAPED, PROBE_HOSTILE } from '../support/probe-strings';
import { writeEvidence } from './diagnostics';
import { test } from './fixture';
import type { NativeBrowser } from './session';

// IN51 (b): the spec §6 pre-flight row (a)–(e). Each test records what the real host did (probe.json in its
// case directory) before it asserts; the outcomes become IPF rulings and the tests stay as regression tests.

// IPF15: the probe URLs' host must contain a dot (x.io) for Obsidian to autolink them at all.
const READING_SELECTORS = ['a.internal-link', '.internal-embed', 'a.tag', 'mark', '.math', 'a.external-link', 'b'];
/** Live-preview syntax categories, matched as substrings of the class names found under `.cm-content`. */
const LIVE_PREVIEW_TOKENS: Record<string, string> = {
  links: 'internal-link', embeds: 'embed', tags: 'hashtag', highlights: 'highlight', math: 'math', comments: 'comment',
};

function renderReading(browser: NativeBrowser, markdown: string) {
  return browser.executeObsidian(async ({ app, obsidian }, md, selectors) => {
    const el = createDiv();
    const component = new obsidian.Component();
    component.load();
    try {
      await obsidian.MarkdownRenderer.render(app, md, el, 'probe.md', component);
      const counts: Record<string, number> = {};
      for (const selector of selectors) counts[selector] = el.querySelectorAll(selector).length;
      const text = el.textContent ?? '';
      // "block" contains a c, so the comment's text counts only as a c standing alone or between %% markers.
      return { counts, text, commentTextVisible: /(?:^|[^a-z])c(?:[^a-z]|$)/iu.test(text), html: el.innerHTML };
    } finally {
      component.unload();
    }
  }, markdown, READING_SELECTORS);
}

async function renderLivePreview(browser: NativeBrowser, path: string, markdown: string) {
  await browser.executeObsidian(async ({ app }, target, md) => {
    const file = await app.vault.create(target, `Probe.\n\n${md}\n`);
    await app.workspace.getLeaf(true).openFile(file, { state: { mode: 'source', source: false } });
  }, path, markdown);
  const read = () => browser.executeObsidian(({ app, obsidian }, target) => {
    const view = app.workspace.getLeavesOfType('markdown').map((leaf) => leaf.view)
      .find((candidate) => candidate instanceof obsidian.MarkdownView && candidate.file?.path === target);
    if (!(view instanceof obsidian.MarkdownView)) return null;
    const content = view.containerEl.querySelector('.cm-content');
    if (!content || !(content.textContent ?? '').includes('block')) return null;
    const classes = new Set<string>();
    for (const node of Array.from(content.querySelectorAll('*'))) for (const name of Array.from(node.classList)) classes.add(name);
    return {
      mode: view.getMode(), source: view.getState().source, livePreview: view.containerEl.querySelector('.is-live-preview') !== null,
      classes: Array.from(classes).sort(), text: content.textContent,
    };
  }, path);
  await expect.poll(read).not.toBeNull();
  const observed = await read();
  if (!observed) throw new Error(`Live preview of ${path} vanished.`);
  const tokens = Object.fromEntries(Object.entries(LIVE_PREVIEW_TOKENS)
    .map(([category, fragment]) => [category, observed.classes.filter((name) => name.includes(fragment))]));
  return { ...observed, tokens };
}

describe('Obsidian facts the investigation notes rely on', () => {
  test('vault.create rejects a path that already exists', async ({ native: { browser, directory } }) => {
    const observed = await browser.executeObsidian(async ({ app }) => {
      // Serialised into the app window, so nothing here may be hoisted to (or reach) module scope.
      const read = async (path: string) => { const file = app.vault.getFileByPath(path); return file ? app.vault.read(file) : null; };
      await app.vault.create('probe-a.md', 'first');
      let duplicate: string | null = null;
      try { await app.vault.create('probe-a.md', 'second'); } catch (error) { duplicate = error instanceof Error ? error.message : String(error); }
      const textAfterDuplicate = await read('probe-a.md');
      let caseOnly: string | null = null;
      try { await app.vault.create('PROBE-A.md', 'third'); } catch (error) { caseOnly = error instanceof Error ? error.message : String(error); }
      return {
        duplicateRejected: duplicate !== null, duplicate, textAfterDuplicate,
        caseOnlyRejected: caseOnly !== null, caseOnly,
        caseOnlyAfter: { lower: await read('probe-a.md'), upper: await read('PROBE-A.md'),
          files: app.vault.getFiles().map((file) => file.path).filter((path) => path.toLowerCase() === 'probe-a.md') },
      };
    });
    await writeEvidence(directory, 'probe', observed);
    expect(observed.duplicateRejected).toBe(true);
    expect(observed.textAfterDuplicate).toBe('first');
  });

  test('backslash escapes keep Obsidian syntax inert in reading and live-preview views', async ({ native: { browser, directory } }) => {
    const reading = { control: await renderReading(browser, PROBE_HOSTILE), escaped: await renderReading(browser, PROBE_ESCAPED) };
    const livePreview = {
      control: await renderLivePreview(browser, 'probe-hostile.md', PROBE_HOSTILE),
      escaped: await renderLivePreview(browser, 'probe-escaped.md', PROBE_ESCAPED),
    };
    await writeEvidence(directory, 'probe', { reading, livePreview });
    expect(Object.values(reading.control.counts).length).toBe(READING_SELECTORS.length);
    for (const selector of READING_SELECTORS) {
      expect.soft(reading.control.counts[selector], `control ${selector}`).toBeGreaterThan(0);
      expect.soft(reading.escaped.counts[selector], `escaped ${selector}`).toBe(0);
    }
    expect(reading.control.commentTextVisible).toBe(false);
    expect(reading.escaped.commentTextVisible).toBe(true);
    expect(livePreview.control.livePreview && livePreview.escaped.livePreview).toBe(true);
    for (const category of Object.keys(LIVE_PREVIEW_TOKENS)) {
      expect.soft(livePreview.control.tokens[category], `control ${category}`).not.toEqual([]);
      expect.soft(livePreview.escaped.tokens[category], `escaped ${category}`).toEqual([]);
    }
  });

  test('the metadata cache reports notes changed by process and processFrontMatter', async ({ native: { browser, directory } }) => {
    const observed = await browser.executeObsidian(async ({ app }) => {
      // An event-or-timeout RECORD, not a sleep (PF-C13): it resolves on the first `changed` for the path, and the
      // 5 s timer only bounds how long a missing event is waited for, so the probe can report "timeout". The timer
      // is `window`'s (obsidianmd/prefer-window-timers): this script runs in the main window, the active one here.
      const next = (path: string) => new Promise<'changed' | 'timeout'>((resolve) => {
        const ref = app.metadataCache.on('changed', (file) => {
          if (file.path !== path) return;
          app.metadataCache.offref(ref);
          window.clearTimeout(timer);
          resolve('changed');
        });
        const timer = window.setTimeout(() => { app.metadataCache.offref(ref); resolve('timeout'); }, 5_000);
      });
      const path = 'probe-c.md';
      const created = next(path);
      const file = await app.vault.create(path, '---\nstate: one\n---\nBody.\n');
      const create = await created;
      const processed = next(path);
      await app.vault.process(file, (text) => text.replace('state: one', 'state: two'));
      const process = await processed;
      const stateAfterProcess: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.state;
      const matter = next(path);
      await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => { frontmatter.state = 'three'; });
      const processFrontMatter = await matter;
      const stateAfterProcessFrontMatter: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.state;
      return { create, process, stateAfterProcess, processFrontMatter, stateAfterProcessFrontMatter, text: await app.vault.read(file) };
    });
    await writeEvidence(directory, 'probe', observed);
    await expect.poll(() => browser.executeObsidian(({ app }): unknown => {
      const file = app.vault.getFileByPath('probe-c.md');
      return file ? app.metadataCache.getFileCache(file)?.frontmatter?.state : undefined;
    })).toBe('three');
  });

  test('stringifyYaml round-trips the frontmatter value shapes as strings', async ({ native: { browser, directory } }) => {
    const input: Record<string, string> = {
      a: 'yes', b: 'null', c: '0012', d: 'a: b', e: 'true', f: '~', g: '#x', h: '[[x]]',
      i: 'snapshot:p1:2026-09-25T10:00:00.000Z', j: 'src/a.ts#UN-00000001', k: 'file:src/a.ts',
    };
    const observed = await browser.executeObsidian(({ obsidian }, value): { yaml: string; parsed: unknown } => {
      const yaml = obsidian.stringifyYaml(value);
      return { yaml, parsed: obsidian.parseYaml(yaml) };
    }, input);
    await writeEvidence(directory, 'probe', observed);
    expect(observed.parsed).toEqual(input);
    const values = Object.values(observed.parsed as Record<string, unknown>);
    expect(values.length).toBe(Object.keys(input).length);
    expect(values.every((value) => typeof value === 'string')).toBe(true);
  });

  test('folders can be created one segment at a time', async ({ native: { browser, directory } }) => {
    const observed = await browser.executeObsidian(async ({ app, obsidian }) => {
      const folder = async (path: string) => ({
        indexed: app.vault.getAbstractFileByPath(path) instanceof obsidian.TFolder, onDisk: await app.vault.adapter.exists(path),
      });
      let nestedError: string | null = null;
      try { await app.vault.createFolder('p1/q1'); } catch (error) { nestedError = error instanceof Error ? error.message : String(error); }
      const nested = { rejected: nestedError !== null, error: nestedError, parent: await folder('p1'), child: await folder('p1/q1') };
      await app.vault.createFolder('p2');
      await app.vault.createFolder('p2/q2');
      return { nested, stepwise: { parent: await folder('p2'), child: await folder('p2/q2') } };
    });
    await writeEvidence(directory, 'probe', observed);
    expect(observed.stepwise).toEqual({ parent: { indexed: true, onDisk: true }, child: { indexed: true, onDisk: true } });
  });
});
