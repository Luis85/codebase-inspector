// The declarative half of the hybrid the open question resolved as unnecessary — see
// docs/superpowers/notes/2026-09-17-setting-definitions-verification.md: the verified
// branch is FULL DECLARATIVE, so this file builds the plugin's ENTIRE settings surface
// as a SettingDefinitionItem[] tree, not just the scalar settings spec 4.4 originally
// scoped to it. Pure and side-effect-free except through the callbacks it is given —
// every mutation (save, remove, reconnect, clear) is the caller's (settings-tab.ts's)
// responsibility, which is what keeps this file unit-testable without any DOM at all.
import type { Setting, SettingDefinitionItem, SettingDefinitionPage } from 'obsidian';
import type { CodebaseProfile, LocalBinding } from '../domain/model';

/** A profile paired with its resolved binding. `binding` is null both when the profile
 *  has no bindingId yet AND when LocalBindingStore.get() reports the binding
 *  unavailable on this machine (COPY-28) — buildBindingStatusRow tells the two cases
 *  apart using `profile.bindingId` itself, which is present in the first case. */
export interface ProfileEntry {
  profile: CodebaseProfile;
  binding: LocalBinding | null;
}

export interface SettingDefinitionsCallbacks {
  onAddProfile: () => void;
  onDeleteProfile: (profileId: string) => void;
  onRenameProfile: (profileId: string, name: string) => void;
  onExclusionsChange: (profileId: string, rawLines: string) => void;
  onMaxFileBytesChange: (profileId: string, rawValue: string) => void;
  onReconnect: (profileId: string) => void;
  onClearBinding: (profileId: string) => void;
}

// COPY-28, spec 5.2, verbatim — character for character, including both full stops.
export const BINDING_MISSING_TEXT =
  'The saved source directory is unavailable on this machine. The stored snapshot can still be inspected.';

// Neither "Read-only source access" nor "Source remains unchanged" appears here —
// ruling M25: those two strings ship only after task 12 records the G2 evidence.
export const STORAGE_DISCLOSURE_TEXT =
  'Codebase profiles and local folder bindings are stored in this vault, in this ' +
  'plugin’s own data file. Nothing about them is sent anywhere else.';

export const SYMLINK_POLICY_TEXT =
  'Symbolic links and junctions are never followed. They are reported as skipped, with a reason.';

function renderNameRow(setting: Setting, profile: CodebaseProfile, onChange: (name: string) => void): void {
  setting.setName('Name').setDesc('Shown in the profile list.');
  const input = setting.controlEl.createEl('input', { attr: { type: 'text', value: profile.name } });
  input.addEventListener('change', () => { onChange(input.value); });
}

function renderExclusionsRow(setting: Setting, profile: CodebaseProfile, onChange: (rawLines: string) => void): void {
  setting.setName('Excluded paths').setDesc('One relative path or pattern per line.');
  const textarea = setting.controlEl.createEl('textarea', { text: profile.exclusions.join('\n') });
  textarea.addEventListener('change', () => { onChange(textarea.value); });
}

function renderMaxFileBytesRow(setting: Setting, profile: CodebaseProfile, onChange: (rawValue: string) => void): void {
  setting.setName('Maximum file size to read').setDesc('Files larger than this are skipped, never truncated.');
  const input = setting.controlEl.createEl('input', { attr: { type: 'number', value: String(profile.maxFileBytes) } });
  input.addEventListener('change', () => { onChange(input.value); });
}

/** The one row that needs a genuine custom render rather than a plain control: its
 *  content (text vs. button label vs. data-action) depends on binding state, which no
 *  SettingDefinitionControl can express. Reconnect/Connect are wired to a real,
 *  ENABLED callback (never a disabled placeholder — spec 1) whose body is a documented
 *  no-op until a later task's source-selection flow exists, exactly like
 *  src/host/commands.ts's scan-codebase/cancel-scan commands already do for the same
 *  reason. Clear binding is fully implemented here: settings-tab.ts opens
 *  ClearBindingModal before calling onClearBinding, so this row itself never mutates
 *  anything (acceptance criterion 6). */
function renderBindingStatusRow(setting: Setting, entry: ProfileEntry, callbacks: SettingDefinitionsCallbacks): void {
  setting.setName('Source folder');
  const { profile, binding } = entry;
  if (profile.bindingId === null) {
    setting.setDesc('Not yet connected to a folder.');
    setting.addButton((btn) => {
      btn.setButtonText('Connect');
      btn.buttonEl.setAttribute('data-action', 'connect');
      btn.onClick(() => { callbacks.onReconnect(profile.profileId); });
    });
    return;
  }
  if (binding === null) {
    setting.setDesc(BINDING_MISSING_TEXT);
    setting.addButton((btn) => {
      btn.setButtonText('Reconnect');
      btn.buttonEl.setAttribute('data-action', 'reconnect');
      btn.onClick(() => { callbacks.onReconnect(profile.profileId); });
    });
    return;
  }
  setting.setDesc(binding.rootPath);
  setting.addButton((btn) => {
    btn.setButtonText('Clear binding');
    btn.buttonEl.setAttribute('data-action', 'clear-binding');
    btn.onClick(() => { callbacks.onClearBinding(profile.profileId); });
  });
}

function buildProfilePage(entry: ProfileEntry, callbacks: SettingDefinitionsCallbacks): SettingDefinitionPage {
  const { profile } = entry;
  return {
    type: 'page',
    name: profile.name,
    desc: profile.bindingId === null ? 'Not yet connected' : undefined,
    items: [
      { name: 'Name', render: (setting) => { renderNameRow(setting, profile, (name) => { callbacks.onRenameProfile(profile.profileId, name); }); } },
      { name: 'Excluded paths', render: (setting) => { renderExclusionsRow(setting, profile, (raw) => { callbacks.onExclusionsChange(profile.profileId, raw); }); } },
      { name: 'Maximum file size to read', render: (setting) => { renderMaxFileBytesRow(setting, profile, (raw) => { callbacks.onMaxFileBytesChange(profile.profileId, raw); }); } },
      { name: 'Source folder', render: (setting) => { renderBindingStatusRow(setting, entry, callbacks); } },
    ],
  };
}

/** The plugin's ENTIRE settings surface (verification decision: FULL DECLARATIVE).
 *  Recomputed every time settings-tab.ts calls this — never memoised here — which is
 *  what lets the profile list stay live (settings-tab.ts calls the setting tab's own
 *  `update()` after any mutation; see obsidian.d.ts's getSettingDefinitions doc: "Called
 *  on every display() and once when the tab is added"). */
export function buildSettingDefinitions(
  entries: readonly ProfileEntry[],
  callbacks: SettingDefinitionsCallbacks,
): SettingDefinitionItem[] {
  return [
    {
      type: 'list',
      heading: 'Codebase profiles',
      emptyState: 'No codebase profiles yet.',
      items: entries.map((entry) => buildProfilePage(entry, callbacks)),
      onDelete: (index) => {
        const entry = entries[index];
        if (entry) callbacks.onDeleteProfile(entry.profile.profileId);
      },
      addItem: { name: 'Add profile', action: () => { callbacks.onAddProfile(); } },
    },
    // Static explanatory text — no control, action or render at all (spec 1 forbids a
    // rendered-but-disabled control; this has no control to disable in the first place).
    { name: 'Follow symbolic links', desc: SYMLINK_POLICY_TEXT },
    { name: 'Storage', desc: STORAGE_DISCLOSURE_TEXT },
  ];
}
