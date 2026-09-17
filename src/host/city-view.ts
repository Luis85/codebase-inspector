// ItemView owning onOpen/onClose/getState/setState (task 3). Task 9 replaces the
// welcome-shell UI with the real C01 shell; tasks 10-11 replace the renderer and add
// per-leaf snapshot reconciliation. This file's own responsibilities do not change.
//
// Host rules this file exists to satisfy (spec 4.4):
// - WebGL context creation happens in onOpen, never the constructor.
// - Vue mounts on this.contentEl (not containerEl.children[1]); each view creates its
//   OWN Pinia instance.
// - getState() returns identifiers and presentation state only; setState validates
//   through the same runtime validator as settings, because workspace.json is
//   user-editable.
// - No bare window/document/ResizeObserver: everything goes through contentEl.win.
// - Below the 320 CSS px hard floor, no WebGL context is created at all.
import { ItemView } from 'obsidian';
import type { EventRef, Plugin, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { createApp, ref, type App as VueApp, type Ref } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import RootComponent from '../ui/App.vue';
import { createCityRenderer } from '../visualization/city-renderer';
import type { CityRendererEvent, CityRendererPort } from '../visualization/renderer-port';
import type { CityViewState } from '../domain/model';
import { defaultCityViewState, decodeCityViewState } from './view-state';
import { readPalette } from './theme-bridge';

// lib.dom.d.ts declares ResizeObserver only as a bare global `var`, not as a member of
// `Window` (a lib.dom gap) — even though at runtime it is a real property of every
// window, including a popped-out one. This augmentation lets
// `containerEl.win.ResizeObserver` type-check, so this file can honour the
// cross-window rule (spec 4.4) instead of reaching for the bare global.
declare global {
  interface Window {
    ResizeObserver: typeof ResizeObserver;
  }
}

export const CITY_VIEW_TYPE = 'codebase-inspector-city';
const MIN_INLINE_SIZE = 320;   // spec 5.2 hard floor, CSS px, measured on the leaf

interface ExposedRoot {
  rendererHost: HTMLElement | null;
}

export class CityView extends ItemView {
  private readonly plugin: Plugin;
  private vueApp: VueApp | null = null;
  private pinia: Pinia | null = null;
  private renderer: CityRendererPort | null = null;
  private rendererMountEl: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private cssChangeRef: EventRef | null = null;
  private state: CityViewState = defaultCityViewState();
  // Owned here, injected into App.vue, so a resize-driven availability change never
  // requires remounting the welcome shell.
  private readonly rendererAvailable: Ref<boolean> = ref(false);

  constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  override getViewType(): string { return CITY_VIEW_TYPE; }
  override getDisplayText(): string { return 'Codebase city'; }
  override getIcon(): string { return 'building-2'; }

  override async onOpen(): Promise<void> {
    this.contentEl.classList.add('codebase-inspector-root');

    this.pinia = createPinia();
    // typescript-eslint's type-aware linting resolves a cross-file .vue import as an
    // untyped/error module (it has no Vue SFC language-service plugin, unlike vue-tsc,
    // which DOES type-check this correctly — see `npm run typecheck`). Real behaviour
    // is unaffected; this is a lint-tooling gap, not an unsafe value.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- see comment above: vue-tsc, not eslint's type-aware linting, is the accurate check here
    this.vueApp = createApp(RootComponent);
    this.vueApp.provide('rendererAvailable', this.rendererAvailable);
    this.vueApp.use(this.pinia);
    const instance = this.vueApp.mount(this.contentEl) as unknown as ExposedRoot;
    this.rendererMountEl = instance.rendererHost;

    const win = this.contentEl.win;               // never a bare window
    this.resizeObserver = new win.ResizeObserver(() => { this.applyWidth(); });
    this.resizeObserver.observe(this.contentEl);
    this.applyWidth();      // decide once synchronously; the observer covers later drags

    this.cssChangeRef = this.plugin.app.workspace.on('css-change', () => {
      // Re-reads every cached colour. Never moves buildings, changes camera, or
      // clears state (spec 4.4).
      this.renderer?.setColors(readPalette(this.contentEl));
    });
  }

  override async onClose(): Promise<void> {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.cssChangeRef) {
      this.plugin.app.workspace.offref(this.cssChangeRef);
      this.cssChangeRef = null;
    }
    this.teardownRenderer();
    this.vueApp?.unmount();
    this.vueApp = null;
    this.pinia = null;
    this.rendererMountEl = null;
  }

  override getState(): Record<string, unknown> {
    // Identifiers and presentation state only — never a snapshot, a resolved
    // absolute path, or scan authorisation (spec 4.4).
    return { ...this.state };
  }

  override async setState(state: unknown, _result: ViewStateResult): Promise<void> {
    // workspace.json is user-editable: validated through the same runtime validator
    // as settings. An invalid payload keeps whatever state this view already had,
    // never partially applying it. Independent of setState/onOpen ordering on
    // workspace restore (spec 11, open question) — this only ever touches `this.state`
    // and never reads anything onOpen sets up, so either order produces the same
    // result.
    this.state = decodeCityViewState(state, this.state);
  }

  private applyWidth(): void {
    const rect = this.contentEl.getBoundingClientRect();
    const available = rect.width >= MIN_INLINE_SIZE;
    this.rendererAvailable.value = available;
    if (available) {
      this.ensureRenderer();
      const pixelRatio = this.contentEl.win.devicePixelRatio || 1;
      this.renderer?.resize(rect.width, rect.height, pixelRatio);
    } else {
      this.teardownRenderer();
    }
  }

  private ensureRenderer(): void {
    if (this.renderer || !this.rendererMountEl) return;
    const win = this.contentEl.win;
    this.renderer = createCityRenderer(this.rendererMountEl, win, (event) => {
      this.onRendererEvent(event);
    });
    this.renderer.setColors(readPalette(this.contentEl));
  }

  private onRendererEvent(event: CityRendererEvent): void {
    if (event.type === 'unavailable') {
      // No self-healing (spec 4.2): drop the reference. A later resize/onOpen is
      // what constructs a fresh renderer, never a restore.
      this.rendererAvailable.value = false;
      this.teardownRenderer();
    }
  }

  private teardownRenderer(): void {
    if (!this.renderer) return;
    this.renderer.dispose();
    this.renderer = null;
  }
}
