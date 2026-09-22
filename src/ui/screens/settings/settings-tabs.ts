// Part 4 Task 13: the Settings tab vocabulary, kept apart from SettingsSections.vue's
// <script setup> block (a type exported through an SFC's second <script> block is
// awkward with vue-tsc/eslint — allowed by the controller's Task 13 notes).
// Part 5 V27: SETTINGS_TABS is the one list (SettingsScreen's tabs, the copy keys), and
// `isSettingsTab` narrows Tabs' plain-string v-model without a cast.
export const SETTINGS_TABS = ['appearance', 'analysis', 'accessibility', 'privacy', 'about'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
const TAB_IDS: ReadonlySet<string> = new Set(SETTINGS_TABS);
export function isSettingsTab(id: string): id is SettingsTab {
  return TAB_IDS.has(id);
}
