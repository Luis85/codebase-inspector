// WP-04 IN33 (IP13): the host's note index. Nothing is read until the first list or
// subscribe (onload registers only, spec 4.4). 'changed', 'rename' and 'delete' update one
// entry; the first 'resolved' after start rebuilds from the whole cache (WP-04 E14).
// Listeners hear only real changes.
import { TFile } from 'obsidian';
import type { App, EventRef } from 'obsidian';
import { applyNoteEvent, noteIndexFor } from '../application/investigation/note-index';
import type { NoteEvent, NoteIndex, NoteRecords } from '../application/investigation/note-index';

export interface NoteIndexSource { list(codebaseId: string): NoteIndex; subscribe(listener: () => void): () => void }

export function createNoteIndexSource(app: App, registerEvent: (ref: EventRef) => void): NoteIndexSource {
  let records: NoteRecords = new Map();
  let started = false;
  const listeners = new Set<() => void>();
  const frontmatterOf = (file: TFile): unknown => app.metadataCache.getFileCache(file)?.frontmatter;
  const everyFile = (): NoteEvent => ({ kind: 'reset', files: app.vault.getMarkdownFiles().map((f) => ({ path: f.path, frontmatter: frontmatterOf(f) })) });
  const apply = (event: NoteEvent): void => {
    const next = applyNoteEvent(records, event);
    if (next === records) return;
    records = next;
    for (const listener of Array.from(listeners)) {
      // One throwing listener must not stop the rest, nor reach Obsidian's event dispatch.
      try { listener(); } catch { /* swallowed: the listener's own failure, not the index's */ }
    }
  };
  function start(): void {
    if (started) return;
    started = true;
    records = applyNoteEvent(records, everyFile());
    // Markdown only, the same universe as the getMarkdownFiles rebuild.
    registerEvent(app.metadataCache.on('changed', (file, _data, cache) => {
      if (file.extension === 'md') apply({ kind: 'changed', path: file.path, frontmatter: cache.frontmatter });
    }));
    // WP-04 E14: `resolved` fires after every modification (obsidian.d.ts:4468), so only the
    // first one after start rebuilds (the repair after the initial load); later changes
    // arrive through changed/rename/delete (IPF18), which keeps IP13's incremental cost.
    let repaired = false;
    registerEvent(app.metadataCache.on('resolved', () => {
      if (repaired) return;
      repaired = true;
      apply(everyFile());
    }));
    registerEvent(app.vault.on('rename', (file, oldPath) => {
      apply(file instanceof TFile && file.extension === 'md'
        ? { kind: 'renamed', oldPath, path: file.path, frontmatter: frontmatterOf(file) }
        : { kind: 'deleted', path: oldPath });
    }));
    registerEvent(app.vault.on('delete', (file) => { apply({ kind: 'deleted', path: file.path }); }));
  }
  let memo: { records: NoteRecords; codebaseId: string; index: NoteIndex } | null = null;
  return {
    list: (codebaseId) => {
      start();
      if (memo === null || memo.records !== records || memo.codebaseId !== codebaseId) memo = { records, codebaseId, index: noteIndexFor(records, codebaseId) };
      return memo.index;
    },
    subscribe: (listener) => { start(); listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
