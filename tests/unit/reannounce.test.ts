// Part 5 V22 (Part 4 E18): re-announce a repeated outcome without an overwrite risk.
import { describe, expect, it } from 'vitest';
import { nextTick, ref, watch } from 'vue';
import { reannounce } from '../../src/ui/kit/reannounce';

/** A live region's value plus every value it took, in order (sync watcher). */
function region(initial: string) {
  const live = ref(initial);
  const seen: string[] = [];
  watch(live, (v) => { seen.push(v); }, { flush: 'sync' });
  return { live, seen };
}

describe('reannounce (V22)', () => {
  it('clears the region at once, then sets the message on the next tick', async () => {
    const { live, seen } = region('Saved.');
    const done = reannounce(live, 'Saved.');
    expect(live.value).toBe('');
    await done;
    expect(live.value).toBe('Saved.');
    expect(seen).toEqual(['', 'Saved.']);
  });

  it('two rapid calls on one region: only the later message lands, after the intermediate empty string', async () => {
    const { live, seen } = region('Old.');
    const first = reannounce(live, 'First.');
    const second = reannounce(live, 'Second.');
    await Promise.all([first, second]);
    await nextTick();
    expect(live.value).toBe('Second.');
    expect(seen).toEqual(['', 'Second.']);
  });

  it('a direct write between the clear and the tick is not overwritten', async () => {
    const { live } = region('');
    const pending = reannounce(live, 'Could not start the download.');
    live.value = 'Tests planned for a.ts.';
    await pending;
    expect(live.value).toBe('Tests planned for a.ts.');
  });

  it('regions are independent: a call on one never cancels a call on another', async () => {
    const a = ref('');
    const b = ref('');
    await Promise.all([reannounce(a, 'A.'), reannounce(b, 'B.')]);
    expect([a.value, b.value]).toEqual(['A.', 'B.']);
  });
});
