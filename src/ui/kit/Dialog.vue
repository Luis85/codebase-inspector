<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

defineProps<{ label: string; status?: string }>();
const emit = defineEmits<{ close: [] }>();

const panel = ref<HTMLElement | null>(null);
let returnFocus: HTMLElement | null = null;
/** Part 6 Task 10 fix round 1: `summary` is in the Tab order (a <details> toggle), so it is
 *  in the trap too; otherwise Tab from the last control skipped it and Shift+Tab from it left. */
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

function focusables(): HTMLElement[] {
  return panel.value ? [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
}

onMounted(async () => {
  const active = panel.value?.ownerDocument.activeElement;
  // `.instanceOf()`, never a plain `instanceof` (spec 4.4's cross-window rule): an opener
  // in an Obsidian pop-out is an instance of THAT window's HTMLElement, so `instanceof`
  // is false there and focus was never restored (scope-modal.ts, FileSearch.vue).
  returnFocus = active?.instanceOf(HTMLElement) ? active : null;
  await nextTick();
  focusables()[0]?.focus();
});

/** Restores focus to the opener. When the opener is gone (e.g. the palette navigated
 *  away and the screen that held it unmounted), focus falls back to the shell root
 *  (App.vue's focusable `.ci-shell`) so it never drops to <body> outside the leaf. */
onBeforeUnmount(() => {
  if (returnFocus?.isConnected) { returnFocus.focus(); return; }
  panel.value?.closest<HTMLElement>('.ci-shell')?.focus();
});

/** Node.DOCUMENT_POSITION_FOLLOWING, without reaching a bare global. */
const FOLLOWING = 4;

/** Escape is claimed here so the city's escape chain (CityWorkspace.vue) never also
 *  resolves it — spec 5.2's "one layer per press". That chain returns early on
 *  `event.defaultPrevented`; stopPropagation additionally keeps the press from ever
 *  reaching the document. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    emit('close');
    return;
  }
  if (event.key !== 'Tab') return;
  const items = focusables();
  const first = items[0]; const last = items[items.length - 1];
  const active = panel.value?.ownerDocument.activeElement;
  if (!first || !last || !active) return;
  // Polish F5: an active element outside the list (a tabindex="-1" heading) wraps by where it
  // is: after `last`, Tab goes to `first`; before `first`, Shift+Tab goes to `last`; anywhere
  // between, the browser's own order is right and nothing is prevented.
  const listed = items.some((el) => el === active);
  const afterLast = !listed && (last.compareDocumentPosition(active) & FOLLOWING) !== 0;
  const beforeFirst = !listed && (active.compareDocumentPosition(first) & FOLLOWING) !== 0;
  if (!event.shiftKey && (active === last || afterLast)) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && (active === first || beforeFirst)) { event.preventDefault(); last.focus(); }
}
</script>

<template>
  <div
    class="ci-dialog__backdrop"
    @click.self="emit('close')"
  >
    <div
      ref="panel"
      class="ci-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="label"
      @keydown="onKeydown"
    >
      <p
        v-if="status !== undefined"
        class="visually-hidden ci-dialog__status"
        role="status"
      >
        {{ status }}
      </p>
      <slot />
    </div>
  </div>
</template>
