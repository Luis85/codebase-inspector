// FM6: clearBinding was duplicated between commands.e2e.ts (scenario 39) and preview.e2e.ts (scenario 23, inline);
// this is the one copy both call. NP2: tests/e2e/inspector.ts is held at exactly 400 lines, so a new shared step
// goes in its own file.
import { expect } from 'vitest';
import type { InspectorPage } from './inspector';
import type { NativeBrowser } from './session';

/** Scenario 39: Clear binding on the open profile page, confirmed in its modal; done when the page offers Reconnect.
 *  Observed: the profile page slides in, and its buttons are not interactable until it has. */
export async function clearBinding(browser: NativeBrowser, inspector: InspectorPage): Promise<void> {
  const clear = inspector.settingsPage().$('[data-action="clear-binding"]');
  await expect.poll(() => clear.isClickable()).toBe(true);
  await clear.click();
  const confirm = browser.$('.modal-container [data-action="confirm-clear-binding"]');
  await expect.poll(() => confirm.isClickable()).toBe(true);
  await confirm.click();
  await expect.poll(() => inspector.settingsPage().$('[data-action="reconnect"]').isExisting()).toBe(true);
}
