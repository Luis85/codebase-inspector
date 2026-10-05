// Gap closure GRB17b (GCN12): a chosen folder whose lstat fails for a reason other than "not
// there" is named as unreadable, with its code, in the approved copy — never as missing or
// as "not a directory". Still the modal's one stat (ruling M31): nothing is listed or read.
// Routed to jsdom by vitest.config.ts's JSDOM_HOST_TESTS.
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemAdapter } from '../mocks/obsidian';
import type { App } from 'obsidian';
import { openSourceModal } from '../../src/host/modals/source-modal';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { CodebaseProfile } from '../../src/domain/model';

const profile: CodebaseProfile = { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 };
const app = { vault: { adapter: new FileSystemAdapter('/fake-root'), configDir: '.obsidian' } } as unknown as App;

afterEach(() => {
  document.querySelectorAll('.modal-container').forEach((m) => { m.remove(); });
});

function modalRoot(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.modal-container');
  if (!el) throw new Error('no modal is open');
  return el;
}

async function continueWithExternal(path: string): Promise<void> {
  const radio = modalRoot().querySelector<HTMLInputElement>('input[type="radio"][value="external"]')!;
  radio.checked = true;
  radio.dispatchEvent(new Event('change'));
  const input = modalRoot().querySelector<HTMLInputElement>('[data-field="external-path"]')!;
  input.value = path;
  input.dispatchEvent(new Event('input'));
  modalRoot().querySelector<HTMLButtonElement>('[data-action="continue"]')!.click();
  await Promise.resolve();
  await Promise.resolve();
}

function alertText(): string | undefined {
  return modalRoot().querySelector('[role="alert"]')?.textContent;
}

function cancel(): void {
  modalRoot().querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
}

describe('the source modal and an unreadable folder (GRB17b)', () => {
  it('names the code: "The folder cannot be read (EACCES)." and stays open', async () => {
    const { port } = createFakeSourceFileSystem({ locked: { statError: 'EACCES' } });
    const promise = openSourceModal(app, { profile, filesystem: port });
    await continueWithExternal('/fake-root/locked');
    expect(alertText()).toBe('The folder cannot be read (EACCES).');
    expect(port.readLog()).toEqual(['/fake-root/locked']);   // the one stat, nothing listed or read
    cancel();
    expect(await promise).toBeNull();
  });

  it('control: a folder that is not there keeps the not-a-directory message', async () => {
    const { port } = createFakeSourceFileSystem({});
    const promise = openSourceModal(app, { profile, filesystem: port });
    await continueWithExternal('/fake-root/gone');
    expect(alertText()).toBe('"/fake-root/gone" is not a directory that can be read.');
    cancel();
    expect(await promise).toBeNull();
  });
});
