// Part 4 Task 13: the Settings tab vocabulary, kept apart from SettingsSections.vue's
// <script setup> block (a type exported through an SFC's second <script> block is
// awkward with vue-tsc/eslint — controller ruling X14).
export type SettingsTab = 'appearance' | 'analysis' | 'accessibility' | 'privacy' | 'about';
