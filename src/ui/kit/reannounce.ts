// Part 5 V22 (Part 4 E18): re-announce a repeated outcome without an overwrite risk.
// A screen reader only announces a text CHANGE, so the region is cleared first and the
// message is set on the next tick. The message is set only if no later call on the same
// region happened in between (per-region token) and nothing else wrote to the region
// meanwhile (it still holds the '' this call left). A later outcome always wins.
import { nextTick, type Ref } from 'vue';

const latest = new WeakMap<Ref<string>, number>();
let issued = 0;

export async function reannounce(live: Ref<string>, message: string): Promise<void> {
  issued += 1;
  const token = issued;
  latest.set(live, token);
  live.value = '';
  await nextTick();
  if (latest.get(live) === token && live.value === '') live.value = message;
}
