// WP-04 Task 10 (IP41): the investigation doubles for `dataPortDeps` and the component tests —
// an inert notes port and a scripted source preview. Harness-safe: no `vitest`, no `node:*`
// (Task 17's browser harness bundles this file directly, the same requirement fake-vault.ts
// documents at its own head).
import { EMPTY_NOTE_INDEX } from '../../src/application/investigation/note-index';
import { defaultNoteFolder } from '../../src/application/investigation/note-path';
import type { PreviewRequest, PreviewResult, SourcePreview } from '../../src/application/investigation/source-preview';
import type { InvestigationNotesPort } from '../../src/application/ports/investigation-notes-port';

// Module scope (oxlint consistent-function-scoping): captures nothing.
const unsubscribeNothing = (): void => {};

/** Lists nothing, writes nothing, opens nothing; the destination is the unnamed default. */
export function inertInvestigationNotes(): InvestigationNotesPort {
  return {
    destination: () => Promise.resolve({ folder: defaultNoteFolder(''), isDefault: true }),
    plan: () => ({ status: 'invalid-folder', problem: 'empty' }),
    list: () => EMPTY_NOTE_INDEX,
    create: () => Promise.resolve({ status: 'refused', reason: 'write-failed' }),
    refresh: () => Promise.resolve('write-failed'),
    open: () => Promise.resolve(false),
    sourceNotePath: () => null,
    subscribe: () => unsubscribeNothing,
  };
}

interface PendingRead { readonly request: PreviewRequest; readonly resolve: (result: PreviewResult) => void }

export interface ScriptedSourcePreview extends SourcePreview {
  /** Every request `read` received, in order. */
  readonly requests: PreviewRequest[];
  /** Resolves the oldest read still waiting, or — given `request` — the read for that request. */
  resolveNext(result: PreviewResult, request?: PreviewRequest): void;
}

/** Every read waits until the test resolves it, so a test decides the order results arrive in. */
export function scriptedSourcePreview(): ScriptedSourcePreview {
  const requests: PreviewRequest[] = [];
  const pending: PendingRead[] = [];
  return {
    requests,
    read: (request) => new Promise<PreviewResult>((resolve) => {
      requests.push(request);
      pending.push({ request, resolve });
    }),
    resolveNext: (result, request) => {
      const at = request === undefined ? 0 : pending.findIndex((p) => p.request === request);
      const read = at < 0 ? undefined : pending[at];
      if (read === undefined) throw new Error('scriptedSourcePreview: no read is waiting');
      pending.splice(at, 1);
      read.resolve(result);
    },
  };
}
