import { describe, expect, it } from 'vitest';
import { SETTINGS_TABS, isSettingsTab } from '../../src/ui/screens/settings/settings-tabs';
import { SETTINGS_TAB } from '../../src/ui/inspector-copy';

describe('settings tabs (Part 5 V27)', () => {
  it('narrows exactly the five tab ids', () => {
    expect(SETTINGS_TABS).toEqual(['appearance', 'analysis', 'accessibility', 'privacy', 'about']);
    for (const id of SETTINGS_TABS) expect(isSettingsTab(id), id).toBe(true);
    for (const id of ['', 'Privacy', 'privacy ', 'constructor', 'toString', 'settings']) expect(isSettingsTab(id), id).toBe(false);
  });
  it('is the one list the tab labels are keyed by', () => {
    expect(Object.keys(SETTINGS_TAB)).toEqual([...SETTINGS_TABS]);
  });
});
