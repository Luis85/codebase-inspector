// C03: three source modes with validation. Ruling M31 -- this modal STATS a directory
// to validate it and does NOTHING else: no readdir of the tree, no file open, no
// content read. Every filesystem touch goes through the injected SourceFileSystemPort
// (task 5), never a second path to Node (no-nodejs-modules stays 'error' for src/**).
import { FileSystemAdapter, Modal, Platform } from 'obsidian';
import type { App } from 'obsidian';
import type { CodebaseProfile } from '../../domain/model';
import type { SourceFileSystemPort } from '../../application/ports/source-filesystem-port';
import { isContained, normalizeRelativePath } from '../../domain/path-safety';

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

/** `relativeNormalized` has already passed through normalizeRelativePath (task 2),
 *  which rejects `.`/`..` segments, absolute-looking input and control characters --
 *  so this is a plain join, never a second place that could re-admit an escape.
 *
 *  Fix round 6 (Item 2, folded Minor): `base` carries whatever separator the host's
 *  own `adapter.getBasePath()` returns (backslash on Windows), while
 *  `relativeNormalized` is always POSIX-style. Joining with a literal `/` regardless
 *  produced a persisted, user-visible `rootPath` with MIXED separators (observed in a
 *  real `data.json`: `"C:\\Projects\\renovation-planner/src"`). Harmless today --
 *  `isContained`/`fingerprintSource` already normalise separators before comparing --
 *  but wrong to write into a durable record, and exactly the shape that bites a later
 *  string comparison someone forgets to normalise. Detects `base`'s OWN separator
 *  (never assumes Windows: this same code runs on POSIX, where `base` has no
 *  backslash at all) and joins consistently to it, rather than loosening any
 *  comparison. */
function joinVaultPath(base: string, relativeNormalized: string): string {
  const trimmedBase = base.replace(/[\\/]+$/, '');
  const sep = trimmedBase.includes('\\') ? '\\' : '/';
  const relativeInSep = sep === '/' ? relativeNormalized : relativeNormalized.replace(/\//g, sep);
  return `${trimmedBase}${sep}${relativeInSep}`;
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
      const raw = this.detailEl.querySelector<HTMLInputElement>('[data-field="vault-folder-path"]')!.value.trim();
      if (raw.length === 0) {
        this.setError('Enter a folder path inside this vault.');
        return null;
      }
      // Fix round 1, Important 1: a `..`-carrying relative segment (e.g.
      // "..\..\Users\Public") used to be string-concatenated onto the base with no
      // validation, escaping the vault entirely while this mode's own label says
      // "inside this vault" -- exactly the mislabelling a consent screen must never
      // produce. normalizeRelativePath (task 2) rejects `.`/`..` segments and
      // absolute-looking input outright; isContained (task 2, also named in this
      // task's brief) is a second, independent check on the JOINED result, so even a
      // future bug in this function's own join logic cannot silently re-admit an
      // escape without also breaking that check.
      let relativeNormalized: string;
      try {
        relativeNormalized = normalizeRelativePath(raw);
      } catch (e) {
        this.setError(e instanceof Error ? e.message : 'That folder path is not valid.');
        return null;
      }
      const resolvedRoot = joinVaultPath(base, relativeNormalized);
      // Deferred minor #17 (fix wave item 3): the `caseSensitive` option ruling M20 made
      // the adapter/host layer's responsibility was omitted here, so this call silently
      // took the default -- contrast walker.ts:190's explicit
      // `{ caseSensitive: deps.caseSensitive }`. Inert today (normalizeRelativePath
      // fully gates escapes before this runs) but it was the defaulted branch that was
      // both wrong and slow, and a defaulted platform decision in host code is exactly
      // what M20 exists to stop. `Platform.isWin`, matching
      // node-source-filesystem.ts's own derivation (`path.sep !== '\\'`) so the two
      // layers cannot disagree about the filesystem they are both looking at.
      if (!isContained(base, resolvedRoot, { caseSensitive: !Platform.isWin })) {
        this.setError('That folder is not inside this vault.');
        return null;
      }
      return resolvedRoot;
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
    // `activeDocument`, never a bare `document`, and `.instanceOf()`, never a plain
    // `instanceof` -- see the identical comment in scope-modal.ts for the failure both
    // halves of this line used to produce in a popped-out leaf (fix wave item 5, I4).
    const active = activeDocument.activeElement;
    const opener = active?.instanceOf(HTMLElement) ? active : null;
    const modal = new SourceModal(app, opts, resolve, opener);
    modal.open();
  });
}
