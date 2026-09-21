<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

defineProps<{ label: string }>();
const emit = defineEmits<{ close: [] }>();

const panel = ref<HTMLElement | null>(null);
let returnFocus: HTMLElement | null = null;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function focusables(): HTMLElement[] {
  return panel.value ? [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
}

onMounted(async () => {
  const active = panel.value?.ownerDocument.activeElement;
  returnFocus = active instanceof HTMLElement ? active : null;
  await nextTick();
  focusables()[0]?.focus();
});

onBeforeUnmount(() => { returnFocus?.focus(); });

/** Escape is claimed here (preventDefault + stopPropagation) so the city's document-level
 *  escape chain (CityWorkspace.vue) never also resolves it — spec 5.2's "one layer per press". */
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
  if (!first || !last) return;
  const active = panel.value?.ownerDocument.activeElement;
  if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
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
      <slot />
    </div>
  </div>
</template>
