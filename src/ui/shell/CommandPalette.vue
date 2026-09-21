<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { isRouteId } from '../../domain/route-ids';
import { COMMAND_PALETTE_EMPTY, COMMAND_PALETTE_LABEL, COMMAND_PALETTE_PLACEHOLDER } from '../inspector-copy';
import { useCityStore } from '../stores/city-store';
import { useReadModels } from '../read-models/use-read-models';
import CiDialog from '../kit/Dialog.vue';
import Icon from '../kit/Icon.vue';
import { paletteItems, type PaletteItem } from './palette-items';

const emit = defineEmits<{ close: [] }>();
const store = useCityStore();
const { files } = useReadModels();
const query = ref('');
const active = ref(0);
const items = computed(() => paletteItems(query.value, files.value));
watch(query, () => { active.value = 0; });

function run(item: PaletteItem | undefined): void {
  if (!item) return;
  if (item.kind === 'route' && isRouteId(item.target)) {
    store.navigate(item.target);
  } else if (item.kind === 'file') {
    store.select(item.target);
    store.navigate('city');
    store.openInspector();
  }
  emit('close');
}

function onKeydown(event: KeyboardEvent): void {
  const n = items.value.length;
  if (event.key === 'ArrowDown' && n) { event.preventDefault(); active.value = (active.value + 1) % n; }
  else if (event.key === 'ArrowUp' && n) { event.preventDefault(); active.value = (active.value - 1 + n) % n; }
  else if (event.key === 'Enter') { event.preventDefault(); run(items.value[active.value]); }
}
</script>

<template>
  <CiDialog
    :label="COMMAND_PALETTE_LABEL"
    @close="emit('close')"
  >
    <div class="ci-palette">
      <input
        v-model="query"
        type="text"
        class="ci-palette__input"
        role="combobox"
        aria-expanded="true"
        aria-controls="ci-palette-list"
        :aria-activedescendant="items[active] ? `ci-palette-${active}` : undefined"
        :placeholder="COMMAND_PALETTE_PLACEHOLDER"
        :aria-label="COMMAND_PALETTE_LABEL"
        @keydown="onKeydown"
      >
      <ul
        id="ci-palette-list"
        class="ci-palette__list"
        role="listbox"
      >
        <li
          v-for="(item, i) in items"
          :id="`ci-palette-${i}`"
          :key="item.key"
          role="option"
          class="ci-palette__item"
          :aria-selected="i === active"
          @click="run(item)"
        >
          <Icon :name="item.kind === 'route' ? 'arrow-right' : 'file-code'" />
          <span class="ci-palette__label">{{ item.label }}</span>
          <span class="ci-palette__detail">{{ item.detail }}</span>
        </li>
      </ul>
      <p
        v-if="items.length === 0"
        class="ci-palette__empty"
      >
        {{ COMMAND_PALETTE_EMPTY }}
      </p>
    </div>
  </CiDialog>
</template>
