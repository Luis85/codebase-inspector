# Design and implementation review checklist

## Structure and scope

- [ ] One native Obsidian workspace view; no independent app shell/account/theme setting.
- [ ] WP-01 exposes only implemented structural features.
- [ ] File list is clearly distinct from the host vault note explorer.
- [ ] Current-vault, vault-directory, and external-directory flows work.
- [ ] Enabling/reopening the plugin does not start scans or analyzers.
- [ ] A supplied source or provider report is treated as data, not execution authority.

## City and inspection

- [ ] Buildings map to unique normalized file IDs; different basenames do not collide.
- [ ] Height metric/scale/cap and equal-lot meaning are explained.
- [ ] Exact values remain accessible in list/inspector.
- [ ] Unknown measurements are not encoded as zero.
- [ ] Click selects; drag does not also select; focus is explicit.
- [ ] Search/filter does not arbitrarily reshuffle the city.
- [ ] Category, selected, changed, warning, and unknown states are distinguishable.
- [ ] Directional edges agree with readable edge lists.

## Host behavior

- [ ] All CSS is scoped; host globals and base colors are not overwritten.
- [ ] Light/dark/custom theme changes preserve state and readable selection.
- [ ] Two leaves maintain independent camera, query, selection, and panel state.
- [ ] Pop-out migration uses the owning document/window.
- [ ] Closing a view cancels frames, listeners, observers, and GPU resources.
- [ ] Hidden leaves pause unnecessary rendering.
- [ ] Keyboard input in a Markdown editor is not intercepted by inspector controls.

## Accessibility and resilience

- [ ] Complete core task via keyboard and HTML list without 3D.
- [ ] Non-drag single-pointer camera alternatives exist.
- [ ] Accessible names, focus-visible states, modal focus return, and safe Escape.
- [ ] Increased text size and narrow leaves retain primary actions.
- [ ] Measured contrast checked in supported default/theme combinations.
- [ ] Reduced motion disables nonessential camera transitions and auto-motion.
- [ ] Progress uses real denominators; cancellation retains completed evidence.
- [ ] WebGL failure does not remove normalized file/analysis data.

## Evidence and note writing

- [ ] Provider operation status, verdict, freshness, and metric availability are distinct.
- [ ] Scope/version/source match visible for important evidence.
- [ ] No safe-deletion probability, synthetic overall health score, or pass guarantee.
- [ ] Coverage totals aggregate correctly; omitted metrics remain unknown.
- [ ] Notes use deliberate vault writes, safe paths, collision handling, and preserved drafts.
- [ ] Absolute machine paths/source text are excluded from exports by default.
- [ ] Note embeds/deep links do not authorize work or rewrite human content.

## Release evidence

- [ ] Actual plugin installed from release artifacts in an isolated Obsidian vault.
- [ ] Real repository and current-vault workflow exercised read-only.
- [ ] Performance benchmarks recorded with hardware, versions, dataset, and actual results.
- [ ] Accessibility/host checks record pass/fail/not-run, not assumed compliance.
- [ ] Synthetic review fixtures are not shipped as the only functioning experience.
