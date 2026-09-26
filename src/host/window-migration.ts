// Task 11. Spec 4.2: "Pop-out migration is dispose() plus constructing a new
// renderer. There is no rebind." — ruling M79 (task-11-context.md section 3): that
// behaviour is observed through the SHARED renderer handle and `CityViewport`'s own
// lifecycle, never a `view.renderer` field (ruling M68 removed it in task 9).
//
// Task 11 fix round 1, Minor 6: this file USED to dispose the shared handle itself,
// duplicating `CityViewport.vue`'s OWN `onWindowMigrated` registration (on the stage
// element, a DESCENDANT of `containerEl`) — which already disposes AND reconstructs
// completely and correctly on its own. Two independent disposers racing on ONE
// migration event is order-dependent: if this one's dispose ran AFTER
// CityViewport's own reconstruction, it would tear down the FRESHLY built renderer
// and leave the pop-out blank until the next resize — and no test could tell the
// difference, since "a second renderer was constructed" stays true even if it is
// then disposed. `CityViewport` is now the SOLE disposer; this registration exists
// only to satisfy this task's own host-level contract (`containerEl` is signalled,
// and `city-view.ts` retains and calls the destroy function on close) — never to
// touch the renderer itself, so there is nothing left here to race.
export function wireWindowMigration(containerEl: HTMLElement): () => void {
  return containerEl.onWindowMigrated(() => {});
}
