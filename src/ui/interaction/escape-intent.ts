// Ported invariant (not the implementation or the name) from
// docs/concept/design/wp01-review/src/interaction-state.js:57-65 — see
// task-9-context.md §10 for why that file is never behavioural evidence on its own,
// and tests/unit/escape-intent.test.ts (ported from wp01-review's model.test.cjs) for
// what pins this contract now.
//
// Ruling M61 (task-9-context.md, defect D22): the brief's own step-2 snippet ordered
// query BEFORE the nonmodal drawer. Spec §5.2 governs and states the chain
// explicitly: modal -> camera interaction/help -> nonmodal drawer -> query ->
// selection. The order below follows the spec, not the brief.
export type EscapeIntent =
  | 'close-modal' | 'close-help' | 'clear-query' | 'close-inspector'
  | 'close-files-drawer' | 'clear-selection';

export interface EscapeContext {
  modal?: boolean;
  help?: boolean;
  inSearch?: boolean;
  query?: string;
  inInspector?: boolean;
  /** The OTHER nonmodal drawer spec 5.2 names (App.vue's `filesDrawerOpen`).
   *  Paired with `narrowDrawer` exactly like `inInspector` is -- see the branch
   *  below for why the unpaired version was a defect. */
  filesDrawer?: boolean;
  narrowDrawer?: boolean;
  inCanvas?: boolean;
  selected?: boolean;
  composing?: boolean;
}

/** Escape resolves EXACTLY ONE LAYER per press (spec §5.2):
 *  modal -> camera interaction/help -> nonmodal drawer (inspector or files) ->
 *  query -> selection.
 *  Suppressed entirely during IME composition — it must not disturb composition or,
 *  for the same reason, a Markdown editor elsewhere in the workspace. */
export function escapeIntent(ctx: EscapeContext): EscapeIntent | null {
  if (ctx.composing) return null;
  if (ctx.modal) return 'close-modal';
  if (ctx.help) return 'close-help';
  if (ctx.inInspector && ctx.narrowDrawer) return 'close-inspector';
  // Phase 2 fix wave, I1 (Important): the second drawer of the SAME link in the
  // chain, not a new link -- ruling M61 fixed the ORDER (modal -> help -> nonmodal
  // drawer -> query -> selection) and this disturbs none of it. Without this branch
  // an Escape with the Files drawer open fell through to `inCanvas && selected`,
  // which is TRUE precisely because focus is inside the open drawer's own list --
  // so the press resolved the LAST layer destructively, clearing the selection
  // while the drawer stayed open. The two drawers are mutually exclusive in
  // App.vue (one overlay at a time), so their relative order here is not a choice
  // the UI can ever exercise.
  //
  // Re-review round 2 (R1, Important): `&& ctx.narrowDrawer`, matching the Inspector
  // branch above, because a DRAWER THAT IS NOT A DRAWER IS NOT A LAYER. At >= 820 px
  // the list is a permanent column and the opener is `display: none`, so resolving
  // this branch there swallows the press (nothing visible happens, and the layer that
  // IS on screen -- the selection -- never gets it) and focuses a hidden control. The
  // caller also clears the flag at that width now, so this is the second of two
  // guards, not the only one; the shape difference from its neighbour bought nothing.
  if (ctx.filesDrawer && ctx.narrowDrawer) return 'close-files-drawer';
  if (ctx.inSearch && ctx.query) return 'clear-query';
  if (ctx.inCanvas && ctx.selected) return 'clear-selection';
  return null;
}
