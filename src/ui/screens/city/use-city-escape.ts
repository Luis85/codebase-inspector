// WP-02 Part 5 (V2): the city's Escape chain, moved out of CityWorkspace.vue with no
// behaviour change.
//
// Task 9 fix round 2, item 2 (Fold): escapeIntent's chain (modal -> help -> nonmodal
// drawer -> query -> selection, ruling M61) was previously reachable end to end ONLY
// through FileSearch.vue's own local `clear-query` handling. This shell-level listener
// reaches the drawer and selection branches too, with REAL state — no `modal`/`help`
// state exists at this level yet, so those two never fire; the rest do.
//
// Task 9 fix round 3, item 1 (Important): it acts only when focus is inside THIS view
// (M9: two open leaves share one document), gated exactly like FileSearch.vue's own
// `viewRoot.contains(doc.activeElement)` check.
import { onBeforeUnmount, onMounted, type Ref, type ShallowRef } from 'vue';
import type { useCityStore } from '../../stores/city-store';
import { escapeIntent } from '../../interaction/escape-intent';
import { narrowContainer } from '../../container-box';

interface DocBearing { doc?: Document }

export interface CityEscapeOptions {
  rootEl: Readonly<Ref<HTMLElement | null>>;
  store: ReturnType<typeof useCityStore>;
  /** The element that opened the inspector (drawer-focus.ts); focus returns to it. */
  inspectorOpener: ShallowRef<HTMLElement | null>;
  filesDrawerOpen: Readonly<Ref<boolean>>;
  narrowDrawer: Readonly<Ref<boolean>>;
  /** Closes the Files drawer and returns focus to its opener. */
  closeFilesDrawer: () => void;
}

export function useCityEscape(options: CityEscapeOptions): void {
  const { rootEl, store, inspectorOpener, filesDrawerOpen, narrowDrawer, closeFilesDrawer } = options;
  let listenerDoc: Document | null = null;
  let unwireMigration: (() => void) | null = null;

  /** `event.isComposing` (native, spec-provided) rather than a locally tracked flag —
   *  this listens on the document, never a specific input, so there is no single
   *  element whose own compositionstart/end this could track instead. */
  function onGlobalKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const el = rootEl.value;
    if (!el) return;
    const active = listenerDoc?.activeElement ?? null;
    if (!narrowContainer(el).contains(active)) return;
    const intent = escapeIntent({
      composing: event.isComposing,
      inInspector: store.inspectorOpen,
      // Phase 2 fix wave, I1 (Important): the shell's OWN Files-drawer state -- without it
      // the chain fell through to `inCanvas && selected` (true precisely BECAUSE focus is
      // inside the open drawer's list) and Escape destroyed the selection instead of
      // closing the drawer. Spec 5.2 names Files as one of the two nonmodal drawers.
      filesDrawer: filesDrawerOpen.value,
      narrowDrawer: narrowDrawer.value,
      inSearch: Boolean(active?.closest('.ci-search')),
      query: store.query,
      // "canvas/list focus": the spatial selection surfaces a selection can be MADE from
      // (spec 5.2) — the 3D viewport and the HTML list both select the same
      // `store.selectedEntityId`, so Escape clearing it applies to either.
      inCanvas: Boolean(active?.closest('.ci-viewport, .ci-file-list')),
      selected: store.selectedEntityId !== null,
    });
    if (intent === 'close-inspector') {
      store.closeInspector();
      inspectorOpener.value?.focus();
    } else if (intent === 'close-files-drawer') {
      closeFilesDrawer();          // already returns focus to the opener
    } else if (intent === 'clear-selection') {
      store.clearSelection();
    } else if (intent === 'clear-query') {
      // Reachable only when a leftover query exists while focus is on NEITHER the search
      // field (FileSearch.vue claims that case via `event.defaultPrevented`) nor anywhere
      // else this chain checks first (tests/unit/escape-intent.test.ts's reachability note).
      store.setQuery('');
    }
  }

  /** Re-resolves the document the listener is attached to, off `el`'s CURRENT `.doc`
   *  (spec 4.4: the injected Document, never a bare global). Task 11 fix round 1, item 3
   *  (Important): a pop-out's Escape key used to stay bound to the PRE-migration document
   *  forever. Detaches the previous document's listener first, so migrating more than
   *  once never accumulates one. */
  function attachKeydownListener(el: HTMLElement): void {
    listenerDoc?.removeEventListener('keydown', onGlobalKeydown);
    listenerDoc = (el as unknown as DocBearing).doc ?? null;
    listenerDoc?.addEventListener('keydown', onGlobalKeydown);
  }

  onMounted(() => {
    const el = rootEl.value;
    if (!el) return;
    attachKeydownListener(el);
    unwireMigration = el.onWindowMigrated(() => { attachKeydownListener(el); });
  });
  onBeforeUnmount(() => {
    listenerDoc?.removeEventListener('keydown', onGlobalKeydown);
    listenerDoc = null;
    unwireMigration?.();
    unwireMigration = null;
  });
}
