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
  | 'close-modal' | 'close-help' | 'clear-query' | 'close-inspector' | 'clear-selection';

export interface EscapeContext {
  modal?: boolean;
  help?: boolean;
  inSearch?: boolean;
  query?: string;
  inInspector?: boolean;
  narrowDrawer?: boolean;
  inCanvas?: boolean;
  selected?: boolean;
  composing?: boolean;
}

/** Escape resolves EXACTLY ONE LAYER per press (spec §5.2):
 *  modal -> camera interaction/help -> nonmodal drawer -> query -> selection.
 *  Suppressed entirely during IME composition — it must not disturb composition or,
 *  for the same reason, a Markdown editor elsewhere in the workspace. */
export function escapeIntent(ctx: EscapeContext): EscapeIntent | null {
  if (ctx.composing) return null;
  if (ctx.modal) return 'close-modal';
  if (ctx.help) return 'close-help';
  if (ctx.inInspector && ctx.narrowDrawer) return 'close-inspector';
  if (ctx.inSearch && ctx.query) return 'clear-query';
  if (ctx.inCanvas && ctx.selected) return 'clear-selection';
  return null;
}
