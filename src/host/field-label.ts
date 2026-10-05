// GRC5 (axe `label`, critical): a form control the host builds itself is named by its own
// visible label. A sibling <label> without `for`, or a Setting row's name, names nothing
// for assistive technology: Obsidian's Setting does not associate its nameEl with a
// control a `render` row creates.
import type { Setting } from 'obsidian';

let sequence = 0;

/** A document-unique id: a modal or a settings page can be built more than once. */
function fieldId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

/** Points `label` at `control` (`for` and `id`). */
export function labelFor(label: HTMLLabelElement, control: HTMLElement, prefix: string): void {
  control.id = fieldId(prefix);
  label.htmlFor = control.id;
}

/** Names a settings row's control by the row's own visible name. */
export function nameByRow(setting: Setting, control: HTMLElement): void {
  if (setting.nameEl.id === '') setting.nameEl.id = fieldId('ci-setting-name');
  control.setAttribute('aria-labelledby', setting.nameEl.id);
}
