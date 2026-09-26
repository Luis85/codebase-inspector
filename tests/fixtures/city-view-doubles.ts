// Polish G1 (Part 5 E10): the Obsidian plugin double every real-CityView host test builds, once.
// A file whose double differs (extra workspace members, spies it reads back) keeps its own.
import { vi } from 'vitest';

export function makePluginDouble(): {
  app: { workspace: Record<string, ReturnType<typeof vi.fn>>; vault: { adapter: Record<string, ReturnType<typeof vi.fn>>; configDir: string } };
} {
  return {
    app: {
      workspace: {
        onLayoutReady: vi.fn(), getLeavesOfType: vi.fn(() => []), getLeaf: vi.fn(),
        revealLeaf: vi.fn(async () => {}), on: vi.fn(() => ({})), offref: vi.fn(),
      },
      vault: { adapter: { read: vi.fn(), list: vi.fn() }, configDir: '.obsidian' },
    },
  };
}
