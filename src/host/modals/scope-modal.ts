// C04: the consent artefact itself. Ruling M31 -- this modal reads NOTHING from the
// filesystem. It displays the resolved root, exclusions and limits it was HANDED
// (via SourceSelection, produced by source-modal.ts), and its own dependency surface
// carries no SourceFileSystemPort at all -- there is nothing here that could read a
// file even by accident.
import { Modal } from 'obsidian';
import type { App } from 'obsidian';
import { approve } from '../../application/approval';
import { scopeValidationReasons } from '../../domain/validator';
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
  // Fix wave item 1 (C1, Critical). `./dist` and `dist/` -- the two most natural ways to
  // type a directory exclusion -- are both REJECTED by validateCodebaseProfile, as are a
  // cleared or non-numeric size limit and (M1) any glob, which walker.ts's exact
  // segment/prefix matching cannot honour. Before this field existed the modal accepted
  // all of them, runInitialScan's profileStore.update threw, and the rejection reached
  // NOTHING: the user ticked approve, clicked Scan codebase, and nothing happened at all.
  // Held as state (rather than recomputed in the ack handler) so both inputs that can
  // invalidate the scope and the acknowledgement that enables Scan read one answer.
  private errorEl!: HTMLElement;
  private scopeReasons: string[] = [];
  private settled = false;
  // Fix round 2, Item 1 (Critical): NOT a field named `selection`, and not merely
  // renamed either -- this is the confirm-scan CLICK HANDLER ITSELF, created here in
  // the constructor so it closes over `profileId` as a true lexical local that never
  // lives on `this` at all. Confirmed against the shipped 1.12.4 obsidian.asar:
  // `Modal`'s own constructor sets `this.selection = null`, and `Modal.prototype.open`
  // OVERWRITES `this.selection` again with a captured DOM-selection descriptor
  // immediately before calling `this.onOpen()` -- every time the modal opens, every
  // time, regardless of subclass. A `private readonly selection: SourceSelection`
  // field on THIS class (the shipped code, before this fix) was silently clobbered
  // between construction and the moment onOpen() wires up its own handlers, so
  // `this.selection.profile.profileId` inside the click handler read `undefined.profileId`
  // off Obsidian's own selection-descriptor object -- exactly the checkpoint #2 crash.
  // A same-day rename to some other field name only defends against TODAY's exact
  // collision; capturing the value in true closure scope, never as a `this.<name>` at
  // all, defends against ANY future Obsidian version adding some other internal field
  // under some other name too, which is why this is a handler-as-closure, not a
  // second differently-spelled field.
  private readonly handleConfirmScan: () => void;

  constructor(
    app: App,
    sourceSelection: SourceSelection,
    private readonly settle: (result: ScopeApproval | null) => void,
    private readonly opener: HTMLElement | null,
  ) {
    super(app);
    this.analysisScope = {
      rootPath: sourceSelection.resolvedRoot,
      exclusions: sourceSelection.profile.exclusions,
      maxFileBytes: sourceSelection.profile.maxFileBytes,
      followSymlinks: false,
    };
    const profileId = sourceSelection.profile.profileId;   // a true lexical local, not `this.*`
    this.handleConfirmScan = () => {
      const approval = approve(profileId, this.analysisScope.rootPath, this.analysisScope, SYSTEM_CLOCK);
      this.finish({ approval, scope: this.analysisScope });
      this.close();
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

    // The sibling SourceModal's own errorEl / role="alert" pattern, reused rather than a
    // second one invented: one visible, announced place where a reason appears (spec 7).
    this.errorEl = this.contentEl.createDiv({ cls: 'scope-modal-error', attr: { role: 'alert' } });

    const ackLabel = this.contentEl.createEl('label', { cls: 'scope-modal-ack' });
    this.ackEl = ackLabel.createEl('input', { attr: { type: 'checkbox', 'data-field': 'acknowledge' } });
    ackLabel.createSpan({ text: COPY_06 });
    this.ackEl.addEventListener('change', () => {
      // Acknowledging an INVALID scope must not enable Scan: approval of a scope the
      // store will refuse is not approval of anything that can be scanned.
      this.scanBtn.disabled = !this.ackEl.checked || this.scopeReasons.length > 0;
    });

    const buttons = this.contentEl.createDiv({ cls: 'modal-button-container' });
    const cancel = buttons.createEl('button', { text: 'Cancel', attr: { type: 'button', 'data-action': 'cancel' } });
    cancel.addEventListener('click', () => { this.finish(null); this.close(); });
    this.scanBtn = buttons.createEl('button', {
      text: COPY_07, attr: { type: 'button', 'data-action': 'confirm-scan' },
    });
    this.scanBtn.disabled = true;
    this.scanBtn.addEventListener('click', this.handleConfirmScan);

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
    // The SAME function ProfileStore.update's own validator runs (validator.ts), not a
    // second, parallel set of rules -- so what this screen says is acceptable and what
    // the store will actually accept cannot drift apart. Its messages are already
    // specific ("...no empty segments and no . or .. segments (exclusion "./dist")");
    // they are surfaced verbatim rather than rewritten.
    this.scopeReasons = scopeValidationReasons(this.analysisScope.exclusions, this.analysisScope.maxFileBytes);
    this.errorEl.textContent = this.scopeReasons.join(' ');
  }
}

export function openScopeModal(app: App, selection: SourceSelection): Promise<ScopeApproval | null> {
  return new Promise((resolve) => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = new ScopeModal(app, selection, resolve, opener);
    modal.open();
  });
}
