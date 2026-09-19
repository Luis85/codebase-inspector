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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
// Phase 2 fix wave, C2 (Critical): `draft` used to be read ONCE, here, and
// `city-view.ts` mounts this tree BEFORE it seeds a restored CityViewState into the
// store — so a query restored from workspace.json filtered the city while this field
// sat visibly EMPTY, and `onKeydown` gates Escape on `draft`, so Escape could not
// clear it either. The field must always show the filter that is actually in force,
// whoever set it (a restore, or the shell-level Escape chain's own `setQuery('')`).
// Not a two-way binding: typing still goes draft -> debounce -> store, and this
// watcher is a no-op for the store write that debounce itself makes.
watch(() => store.query, (query) => { draft.value = query; });
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

// Task 9 fix round 1, item 5 (Important, spec 4.4's cross-window rule): a bare
// `target instanceof HTMLElement` checks against THIS window's HTMLElement
// constructor — after a pop-out, the active element in that OTHER window is an
// instance of ITS OWN HTMLElement, so this always returned false there, "/"
// stole focus while the user was typing a slash into another field, and
// isEditable's whole reason to exist quietly stopped working. `node.instanceOf`
// (Obsidian's cross-window-capable replacement, spec 4.4) fixes it structurally.
function isEditable(target: Element | null): boolean {
  if (!target?.instanceOf(HTMLElement)) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

/** "/" focuses this field from anywhere else in the view (spec 5.2). Listens on
 *  this element's OWN window/document (never a bare global — cross-window rule,
 *  spec 4.4), and treats "this view owns focus" as "the active element is inside
 *  the same `.codebase-inspector-root` ancestor this field lives under" — the one
 *  DOM landmark every view (and every standalone component-test root) already has. */
function onGlobalKeydown(event: KeyboardEvent): void {
  const root = rootEl.value;
  if (!root) return;
  const doc = root.doc;
  const viewRoot = root.closest('.codebase-inspector-root') ?? root;
  const owns = Boolean(viewRoot.contains(doc.activeElement));
  const fires = shouldFocusSearchShortcut(
    { key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey },
    { viewOwnsFocus: owns, targetIsEditable: isEditable(doc.activeElement) },
  );
  if (!fires) return;
  event.preventDefault();
  inputEl.value?.focus();
}

// No bare-global fallback (item 5): if `rootEl` never mounted, this simply
// never attaches a listener, rather than reaching for the wrong window's
// `document`.
let listenerDoc: Document | null = null;
onMounted(() => {
  listenerDoc = rootEl.value?.doc ?? null;
  listenerDoc?.addEventListener('keydown', onGlobalKeydown);
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
