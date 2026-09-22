// Part 4 W5 (Part 1 A2's deferred preferences store): leaf display preferences, in
// memory only (W1). Theme is never here: the inspector follows Obsidian's.
import { defineStore } from 'pinia';

export type Density = 'comfortable' | 'compact';
export const DENSITIES: readonly Density[] = ['comfortable', 'compact'];

export const usePreferencesStore = defineStore('preferences', {
  state: (): { density: Density } => ({ density: 'comfortable' }),
  actions: {
    setDensity(density: Density): void {
      if (DENSITIES.includes(density)) this.density = density;
    },
  },
});
