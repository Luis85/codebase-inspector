// C04: the consent artefact itself. Ruling M31 -- this modal reads NOTHING from the
// filesystem. It displays the resolved root, exclusions and limits it was HANDED
// (via SourceSelection, produced by source-modal.ts), and its own dependency surface
// carries no SourceFileSystemPort at all -- there is nothing here that could read a
// file even by accident.
import { Modal } from 'obsidian';
import type { App } from 'obsidian';
import { approve } from '../../application/approval';
import type { Clock } from '../../application/ports/clock';
import type { AnalysisScope, ApprovedInventoryRun } from '../../domain/model';
import type { SourceSelection } from './source-modal';

/** Task 8 extension: the modal's own editable AnalysisScope (exclusions/max bytes can be
 *  edited live -- see updateScope below) is never persisted anywhere, so the resolved
 *  ApprovedInventoryRun alone is not enough for a caller to actually DRIVE a scan --
 *  ApprovedInventoryRun (a frozen §4.1 contract) carries only opaque fingerprints, not
 *  the scope values themselves. Bundling the exact AnalysisScope that was fingerprinted
 *  alongside the approval is the smallest change that closes this gap without touching
 *  ApprovedInventoryRun's own frozen shape. */
export interface ScopeApproval {
  approval: ApprovedInventoryRun;
  scope: AnalysisScope;
}

// COPY-04..07, docs/concept/design/interactions/04-microcopy.md, character for
// character (task-7-context.md section 3; adopted by spec 5.2).
const COPY_04 = 'Review scope and read access';
const COPY_05 = 'Source text and file metadata are read. No project scripts, dependency '
  + 'installation, or source writes are performed.';
const COPY_06 = 'I approve read access to this directory for this scan.';
const COPY_07 = 'Scan codebase';

/** Host-boundary default: openScopeModal's own signature is exactly (app, selection),
 *  as the brief specifies, so there is no third parameter for a caller to inject a
 *  clock through. This is the wiring that SUPPLIES approve() its Clock dependency, not
 *  a violation of "approve() never calls Date.now()/new Date() directly" -- that
 *  constraint is about approve()'s OWN body (src/application/approval.ts), which takes
 *  the clock as a parameter and never reads the wall clock itself. */
const SYSTEM_CLOCK: Clock = { now: () => new Date(), nowIso: () => new Date().toISOString() };

function parseExclusions(rawLines: string): string[] {
  return rawLines.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
}

class ScopeModal extends Modal {
  private analysisScope: AnalysisScope;
  private ackEl!: HTMLInputElement;
  private scanBtn!: HTMLButtonElement;
  private settled = false;

  constructor(
    app: App,
    private readonly selection: SourceSelection,
    private readonly settle: (result: ScopeApproval | null) => void,
    private readonly opener: HTMLElement | null,
  ) {
    super(app);
    this.analysisScope = {
      rootPath: selection.resolvedRoot,
      exclusions: selection.profile.exclusions,
      maxFileBytes: selection.profile.maxFileBytes,
      followSymlinks: false,
    };
  }

  override onOpen(): void {
    this.setTitle(COPY_04);
    this.contentEl.createEl('p', { text: COPY_05 });
    this.contentEl.createEl('p', { text: `Source: ${this.analysisScope.rootPath}`, cls: 'scope-modal-root' });

    this.contentEl.createEl('label', { text: 'Excluded paths' });
    const exclusions = this.contentEl.createEl('textarea', {
      text: this.analysisScope.exclusions.join('\n'), attr: { 'data-field': 'exclusions' },
    });
    exclusions.addEventListener('input', () => {
      this.updateScope({ exclusions: parseExclusions(exclusions.value) });
    });

    this.contentEl.createEl('label', { text: 'Maximum file size to read (bytes)' });
    const maxBytes = this.contentEl.createEl('input', {
      attr: { type: 'number', value: String(this.analysisScope.maxFileBytes), 'data-field': 'max-file-bytes' },
    });
    maxBytes.addEventListener('input', () => {
      this.updateScope({ maxFileBytes: Number(maxBytes.value) });
    });

    const ackLabel = this.contentEl.createEl('label', { cls: 'scope-modal-ack' });
    this.ackEl = ackLabel.createEl('input', { attr: { type: 'checkbox', 'data-field': 'acknowledge' } });
    ackLabel.createSpan({ text: COPY_06 });
    this.ackEl.addEventListener('change', () => {
      this.scanBtn.disabled = !this.ackEl.checked;
    });

    const buttons = this.contentEl.createDiv({ cls: 'modal-button-container' });
    const cancel = buttons.createEl('button', { text: 'Cancel', attr: { type: 'button', 'data-action': 'cancel' } });
    cancel.addEventListener('click', () => { this.finish(null); this.close(); });
    this.scanBtn = buttons.createEl('button', {
      text: COPY_07, attr: { type: 'button', 'data-action': 'confirm-scan' },
    });
    this.scanBtn.disabled = true;
    this.scanBtn.addEventListener('click', () => {
      const approval = approve(this.selection.profile.profileId, this.analysisScope.rootPath, this.analysisScope, SYSTEM_CLOCK);
      this.finish({ approval, scope: this.analysisScope });
      this.close();
    });

    // See source-modal.ts's identical comment: this double gets no free focus trap,
    // so the modal moves focus onto itself explicitly.
    this.modalEl.setAttribute('tabindex', '-1');
    this.modalEl.focus();
  }

  override onClose(): void {
    this.finish(null);
    this.contentEl.empty();
    this.opener?.focus();
  }

  private finish(result: ScopeApproval | null): void {
    if (this.settled) return;
    this.settled = true;
    this.settle(result);
  }

  /** Editing the scope re-disables Scan and clears the acknowledgement (acceptance
   *  criterion 5) -- a changed scope invalidates prior intent to approve, exactly as
   *  isApprovalValid invalidates a changed scope for an ALREADY-granted approval. */
  private updateScope(patch: Partial<AnalysisScope>): void {
    this.analysisScope = { ...this.analysisScope, ...patch };
    this.ackEl.checked = false;
    this.scanBtn.disabled = true;
  }
}

export function openScopeModal(app: App, selection: SourceSelection): Promise<ScopeApproval | null> {
  return new Promise((resolve) => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = new ScopeModal(app, selection, resolve, opener);
    modal.open();
  });
}
