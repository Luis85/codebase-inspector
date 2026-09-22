// Fix round 3, minor 4: a no-op default for `inject()` calls whose provider is absent
// (a component mounted alone, as most component tests do). Declared once, module scope
// (oxlint consistent-function-scoping: a no-arg closure that captures nothing is
// hoisted, and a shared instance is never re-allocated per inject() call).
export const noop = (): void => {};
