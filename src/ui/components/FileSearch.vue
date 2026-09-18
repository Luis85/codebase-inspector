<!--
  C06 — the search field over the current snapshot's file paths. Owns its own
  ~150 ms debounce (the typed text shows immediately; the store's `query` — and
  therefore the DIM-in-place filter — commits after the debounce) and its own "/"
  reachability (spec 5.2: only while this view owns focus and the event target is
  not itself editable). Escape clears a non-empty query and keeps focus in the
  field — never blurs it, never a second layer of Escape handling; that chain lives
  in escape-intent.ts and is reused here rather than re-implemented.
-->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useCityStore } from '../stores/city-store';
import { escapeIntent } from '../interaction/escape-intent';
import { shouldFocusSearchShortcut } from '../interaction/keymap';

const PLACEHOLDER = 'Search files or paths…';
const DEBOUNCE_MS = 150;
const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const store = useCityStore();
const rootEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);
const draft = ref(store.query);
let composing = false;
let debounceHandle: ReturnType<typeof setTimeout> | null = null;

function commit(value: string): void {
  if (debounceHandle) clearTimeout(debounceHandle);
  debounceHandle = setTimeout(() => { store.setQuery(value); }, DEBOUNCE_MS);
}

function onInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  draft.value = value;
  commit(value);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  const intent = escapeIntent({ inSearch: true, query: draft.value, composing });
  if (intent === 'clear-query') {
    event.preventDefault();
    if (debounceHandle) clearTimeout(debounceHandle);
    draft.value = '';
    store.setQuery('');
    // Focus is left exactly where it is — no blur(), no focus() call.
  }
}

function onCompositionStart(): void { composing = true; }
function onCompositionEnd(): void { composing = false; }

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

/** "/" focuses this field from anywhere else in the view (spec 5.2). Listens on
 *  this element's OWN window/document (never a bare global — cross-window rule,
 *  spec 4.4), and treats "this view owns focus" as "the active element is inside
 *  the same `.codebase-inspector-root` ancestor this field lives under" — the one
 *  DOM landmark every view (and every standalone component-test root) already has. */
function onGlobalKeydown(event: KeyboardEvent): void {
  const doc = rootEl.value?.ownerDocument ?? document;
  const viewRoot = rootEl.value?.closest('.codebase-inspector-root') ?? rootEl.value;
  const owns = Boolean(viewRoot && viewRoot.contains(doc.activeElement));
  const fires = shouldFocusSearchShortcut(
    { key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey },
    { viewOwnsFocus: owns, targetIsEditable: isEditable(doc.activeElement) },
  );
  if (!fires) return;
  event.preventDefault();
  inputEl.value?.focus();
}

let listenerDoc: Document | null = null;
onMounted(() => {
  listenerDoc = rootEl.value?.ownerDocument ?? document;
  listenerDoc.addEventListener('keydown', onGlobalKeydown);
});
onBeforeUnmount(() => {
  if (debounceHandle) clearTimeout(debounceHandle);
  listenerDoc?.removeEventListener('keydown', onGlobalKeydown);
});

defineExpose({ focusInput: () => inputEl.value?.focus() });
</script>

<template>
  <div
    ref="rootEl"
    class="ci-search"
  >
    <input
      ref="inputEl"
      type="text"
      class="ci-search__input"
      :placeholder="PLACEHOLDER"
      :value="draft"
      aria-label="Search files or paths"
      @input="onInput"
      @keydown="onKeydown"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
    >
  </div>
</template>
