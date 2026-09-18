// C03: three source modes with validation. Ruling M31 -- this modal STATS a directory
// to validate it and does NOTHING else: no readdir of the tree, no file open, no
// content read. Every filesystem touch goes through the injected SourceFileSystemPort
// (task 5), never a second path to Node (no-nodejs-modules stays 'error' for src/**).
import { FileSystemAdapter, Modal } from 'obsidian';
import type { App } from 'obsidian';
import type { CodebaseProfile } from '../../domain/model';
import type { SourceFileSystemPort } from '../../application/ports/source-filesystem-port';

export type SourceMode = 'vault' | 'vault-folder' | 'external';

/** Not a §4 frozen contract -- an implementation-scoped intermediate result, produced
 *  here and consumed only by openScopeModal (task 7's own two-step handoff). Carries
 *  the profile through so the scope modal can read its exclusions/maxFileBytes without
 *  a second store lookup. */
export interface SourceSelection {
  profile: CodebaseProfile;
  mode: SourceMode;
  resolvedRoot: string;
}

export interface SourceModalOptions {
  profile: CodebaseProfile;
  filesystem: SourceFileSystemPort;
}

const COPY_03 = 'Read a local codebase outside this vault.';
const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|\/)/;

function joinVaultPath(base: string, relative: string): string {
  const trimmedBase = base.replace(/[\\/]+$/, '');
  const trimmedRelative = relative.replace(/^[\\/]+/, '');
  return `${trimmedBase}/${trimmedRelative}`;
}

class SourceModal extends Modal {
  private mode: SourceMode = 'vault';
  private detailEl!: HTMLElement;
  private errorEl!: HTMLElement;
  private continueBtn!: HTMLButtonElement;
  private settled = false;

  constructor(
    app: App,
    private readonly opts: SourceModalOptions,
    private readonly settle: (result: SourceSelection | null) => void,
    private readonly opener: HTMLElement | null,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle('Select a codebase');
    this.renderModeRow('vault', 'This vault', 'Scan every file in this vault.', true);
    this.renderModeRow('vault-folder', 'A folder inside this vault', 'Scan one folder inside this vault.', false);
    this.renderModeRow('external', 'An external directory', COPY_03, false);

    this.detailEl = this.contentEl.createDiv({ cls: 'source-modal-detail' });
    this.errorEl = this.contentEl.createDiv({ cls: 'source-modal-error', attr: { role: 'alert' } });
    this.renderDetail();

    const buttons = this.contentEl.createDiv({ cls: 'modal-button-container' });
    const cancel = buttons.createEl('button', { text: 'Cancel', attr: { type: 'button', 'data-action': 'cancel' } });
    cancel.addEventListener('click', () => { this.finish(null); this.close(); });
    this.continueBtn = buttons.createEl('button', {
      text: 'Continue', attr: { type: 'button', 'data-action': 'continue' },
    });
    this.continueBtn.addEventListener('click', () => { void this.handleContinue(); });

    // A native modal takes the focus trap for free (spec 5.2); this double does not,
    // so this modal moves focus onto itself explicitly -- otherwise "focus returns to
    // the opener on dismissal" would be trivially true (focus never having left it).
    this.modalEl.setAttribute('tabindex', '-1');
    this.modalEl.focus();
  }

  override onClose(): void {
    this.finish(null);   // no-op via `settled` if already resolved
    this.contentEl.empty();
    this.opener?.focus();
  }

  private finish(result: SourceSelection | null): void {
    if (this.settled) return;
    this.settled = true;
    this.settle(result);
  }

  private renderModeRow(mode: SourceMode, label: string, description: string, checked: boolean): void {
    const row = this.contentEl.createDiv({ cls: 'source-mode-row' });
    const radio = row.createEl('input', {
      attr: { type: 'radio', name: 'source-mode', value: mode, ...(checked ? { checked: true } : {}) },
    });
    row.createEl('label', { text: label });
    row.createEl('p', { text: description });
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      this.mode = mode;
      this.setError('');
      this.renderDetail();
    });
  }

  private renderDetail(): void {
    this.detailEl.empty();
    if (this.mode === 'vault-folder') {
      this.detailEl.createEl('label', { text: 'Folder path inside this vault' });
      this.detailEl.createEl('input', {
        attr: { type: 'text', placeholder: 'Folder name inside this vault, for example src', 'data-field': 'vault-folder-path' },
      });
    } else if (this.mode === 'external') {
      this.detailEl.createEl('label', { text: 'Absolute path to the folder' });
      this.detailEl.createEl('input', {
        attr: { type: 'text', placeholder: 'For example, /home/user/project', 'data-field': 'external-path' },
      });
    }
  }

  private setError(message: string): void {
    this.errorEl.textContent = message;
  }

  private resolveVaultBase(): string | null {
    const adapter = this.app.vault.adapter;
    // instanceof, never a cast (obsidianmd/prefer-instanceof; spec 4.4): mobile
    // supplies a CapacitorAdapter, which has no usable getBasePath().
    if (!(adapter instanceof FileSystemAdapter)) return null;
    return adapter.getBasePath();
  }

  private computeResolvedRoot(): string | null {
    if (this.mode === 'vault' || this.mode === 'vault-folder') {
      const base = this.resolveVaultBase();
      if (base === null) {
        this.setError('This vault’s folder location is not available on this platform.');
        return null;
      }
      if (this.mode === 'vault') return base;
      const relative = this.detailEl.querySelector<HTMLInputElement>('[data-field="vault-folder-path"]')!.value.trim();
      if (relative.length === 0) {
        this.setError('Enter a folder path inside this vault.');
        return null;
      }
      return joinVaultPath(base, relative);
    }
    const external = this.detailEl.querySelector<HTMLInputElement>('[data-field="external-path"]')!.value.trim();
    if (!ABSOLUTE_PATH.test(external)) {
      this.setError('Enter an absolute path — a path relative to something else cannot be read reliably.');
      return null;
    }
    return external;
  }

  /** The ONLY filesystem call this modal ever makes (ruling M31): one stat() to
   *  validate the chosen directory exists and is a directory. Never readText, never
   *  walk -- both would be a read of the very thing this modal only asks permission
   *  to read. */
  private async handleContinue(): Promise<void> {
    this.setError('');
    const resolvedRoot = this.computeResolvedRoot();
    if (resolvedRoot === null) return;   // computeResolvedRoot already set a visible reason
    const stat = await this.opts.filesystem.stat(resolvedRoot);
    if (!stat.exists || !stat.isDirectory) {
      this.setError(`"${resolvedRoot}" is not a directory that can be read.`);
      return;
    }
    this.finish({ profile: this.opts.profile, mode: this.mode, resolvedRoot });
    this.close();
  }
}

export function openSourceModal(app: App, opts: SourceModalOptions): Promise<SourceSelection | null> {
  return new Promise((resolve) => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = new SourceModal(app, opts, resolve, opener);
    modal.open();
  });
}
