# Verification: can getSettingDefinitions() express a dynamic per-profile list?

Spec §11 open question, blocking task 6. Spec §4.4's hybrid is the documented fallback.

## Sources consulted

1. `node_modules/obsidian/obsidian.d.ts` — the installed `obsidian` package, version
   `1.13.1` per `node_modules/obsidian/package.json` line 3. Read directly on
   2026-09-18. This is the `obsidianmd/obsidian-api` typings the brief names as
   source 1 and the highest-ranked one that answers all three questions, so per the
   brief's own instruction ("stop at the first that answers it") sources 3
   (`docs.obsidian.md`) and 4 (a community plugin) were not needed.
2. `node_modules/eslint-plugin-obsidianmd/dist/lib/rules/settingsTab/preferSettingDefinitions.js`
   — the installed package's own compiled rule source (`eslint-plugin-obsidianmd`
   version `0.4.2`, per `node_modules/eslint-plugin-obsidianmd/package.json`), read
   directly on 2026-09-18 — not its documentation, and not the spec's own
   characterisation of it (task-6-context.md section 3 explicitly warns that this
   package's `recommended` config already contradicted a "verified" spec claim once
   on this plan).
3. `manifest.json` (this repository) — `minAppVersion: "1.13.0"`, confirming the
   plugin's supported range already includes the version that introduced
   `getSettingDefinitions()` (`@since 1.13.0` throughout `obsidian.d.ts`), so no
   version bump is needed to use it for the features cited below.

## A. Can the definition list be recomputed when profiles change?

**Yes.** `obsidian.d.ts:6570-6584` (the base `SettingTab.getSettingDefinitions`,
which `PluginSettingTab.getSettingDefinitions` at `obsidian.d.ts:5159` inherits and
may override) documents: "Override to provide setting definitions. Return an array
of definitions and inline groups. Called on every display() and once when the tab
is added to the setting modal for search indexing." ("display()" here reads as the
generic verb "shown", not a call to the deprecated method of that name — see
question C, which shows the two are explicitly decoupled once
`getSettingDefinitions()` returns anything.) `obsidian.d.ts:6585-6591` additionally
declares `update()`: "Stores the result of getSettingDefinitions() for rendering
and search indexing. Called by addSettingTab() and by dynamic tabs when their data
changes" — a method whose entire purpose is to force a fresh
`getSettingDefinitions()` call after the underlying data (e.g. the profile list)
changes. §11's premise that the list "is read once at registration" is contradicted
directly: it is re-read on every show, and `update()` exists specifically to
trigger a re-read on demand.

## B. Can a definition render a button and a custom row?

**Yes, both, natively.** The `SettingDefinition` union (`obsidian.d.ts:5932`) has
two members built for exactly this:

- `SettingDefinitionAction` (`obsidian.d.ts:5938-5963`): `action: (el: HTMLElement,
  index: number) => void` — "Callback invoked when the action setting is clicked."
  This is a button (reconnect, clear binding).
- `SettingDefinitionRender` (`obsidian.d.ts:6265-6285`): `render: (setting: Setting,
  group: SettingGroup) => void | (() => void)` — "Renders the setting row
  imperatively." This is a fully custom row (a storage disclosure paragraph, or
  anything else), receiving a real `Setting` instance to build with.

Beyond the two questions literally asked, `SettingDefinitionList`
(`obsidian.d.ts:6157-6194`), one of the four members of `SettingDefinitionItem`
(`obsidian.d.ts:6147`), is purpose-built for "collections of mutable data: entries
the user adds, reorders, or removes" — `onDelete(index)`, `onReorder(oldIndex,
newIndex)`, and an `addItem` affordance — i.e. a dynamic per-profile list with
native add/delete support. `SettingDefinitionPage` (`obsidian.d.ts:6202-6259`) lets
each list entry open its own navigable sub-page of further definitions, which is
how a profile's own name/exclusions/size-limit/binding-status controls are reached
from its row in the list. Between `SettingDefinitionList`, `SettingDefinitionPage`,
`SettingDefinitionAction` and `SettingDefinitionRender`, every element the open
question names — a dynamic per-profile list, buttons, and a custom row — has a
direct, purpose-built declarative counterpart.

## C. Does prefer-setting-definitions accept a scoped disable in display()?

The rule's actual logic, read in full from `preferSettingDefinitions.js`, is
narrower than the open question assumes: **it does not inspect `display()` at
all.** Its `check()` function reports a `PluginSettingTab`/`SettingTab` subclass
only when the class has **no** `getSettingDefinitions` member whatsoever
(`if (findClassMember(node, "getSettingDefinitions")) { return; }`) — it never
looks at whether `display()` exists, what it does, or whether the array
`getSettingDefinitions()` returns is exhaustive. Two consequences follow: (a) an
ordinary `eslint-disable-next-line` comment works against this rule exactly like
any other ESLint rule — nothing in its implementation specially defeats a disable
directive; but (b) in practice **no disable is needed under either branch**,
because implementing any `getSettingDefinitions()` method — regardless of what it
returns, and regardless of whether `display()` also exists — already satisfies the
rule.

Investigating this surfaced a fact the open question did not ask about, but which
governs whether spec §4.4's hybrid is even buildable as literally described:
`obsidian.d.ts:6633` states "Not called when {@link getSettingDefinitions} returns
a non-empty array; the tab is rendered declaratively from those definitions
instead." Spec §4.4 asks for `getSettingDefinitions()` to return the scalar
settings (a non-empty array) **and** `display()` to render the profile manager —
but per this text, once `getSettingDefinitions()` returns non-empty, the framework
never calls `display()` at all. As literally specified, the §4.4 hybrid would ship
a `display()` override that never executes against the real, installed 1.13.1
host — the profile manager it is supposed to hold would never render, a functional
defect, not just an unverified assumption.

## Decision

[x] FULL DECLARATIVE — the profile manager is expressed in `getSettingDefinitions()`.
[ ] HYBRID (the spec §4.4 fallback)

The evidence for A and B is unambiguous and the installed typings' own API surface
(`SettingDefinitionList`, `SettingDefinitionPage`, `SettingDefinitionAction`,
`SettingDefinitionRender`) covers every element the open question named. C
additionally shows the §4.4 hybrid does not work as literally written against
these typings, because `display()` is skipped entirely once
`getSettingDefinitions()` is non-empty — taking HYBRID here would not be "correct
either way" as the brief allows for the inconclusive case; it would ship a
profile-manager `display()` that the framework never calls. Per the brief's own
instruction, reaching for HYBRID when the evidence this clearly supports FULL
DECLARATIVE "would be a dishonest record" — so FULL DECLARATIVE is taken. Spec §11
is dated 2026-09-17, one day before this verification; the capability it flagged as
unverified is present, and more complete than either the open question or the
§4.4 fallback text anticipated.

## What this means for task 6

`CodebaseInspectorSettingTab.getSettingDefinitions()` (`src/host/settings-tab.ts`)
returns the plugin's entire settings surface: a `SettingDefinitionList` of saved
profiles (each entry a `SettingDefinitionPage` for that profile's own name,
exclusions and maximum file size), `SettingDefinitionRender` rows for the
binding-status control (COPY-28's text plus a `data-action="reconnect"` button
when the binding is missing on this machine, or a "Clear binding" button that
opens `ClearBindingModal` and mutates nothing until confirmed) and the storage
disclosure paragraph, and a plain, control-less row (`SettingDefinitionBase` with
no `control`/`action`/`render`) for the static "Follow symbolic links" text — spec
§1 forbids a rendered-but-disabled control, and this shape has no control at all
to disable. No `prefer-setting-definitions` disable appears anywhere in the
implementation (question C: a real `getSettingDefinitions()` already satisfies the
rule), and `display()` is not implemented at all — `minAppVersion` is already
`1.13.0`, so an unreachable pre-1.13 fallback would be dead code with no supported
host to exercise it.

One practical consequence worth recording for whoever reviews the tests: the
`obsidian` npm package ships type declarations only (its `package.json`'s `"main"`
is `""`, exactly like every other Obsidian API already relied on in this repo's
test doubles) — there is no runtime anywhere in this dependency tree that turns a
`SettingDefinitionItem[]` tree into DOM outside the real, closed-source Obsidian
application itself. The component test (`tests/component/settings-tab.test.ts`)
therefore does not attempt to fake Obsidian's own list/page/search rendering
machinery — doing so would risk testing a guess at Obsidian's behaviour rather than
the plugin's own. Instead it calls `getSettingDefinitions()` directly and asserts
on the returned data (list membership, closures), and separately invokes each
`SettingDefinitionRender`'s `render` callback against a small, faithful
hand-written `Setting` double (added to `tests/mocks/obsidian.ts`, mirroring the
long-stable, pre-1.13 `Setting` API that the `render` callback itself receives as
its first argument) to exercise the real DOM this plugin's own code builds — never
Obsidian's declarative renderer, which is not this plugin's code to test.
