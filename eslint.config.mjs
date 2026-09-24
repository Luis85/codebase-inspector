import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import obsidianmd from 'eslint-plugin-obsidianmd';

// M3 (fix wave item 2), shared between the src/** block and the src/visualization/**
// block below, because flat config REPLACES a rule's options rather than merging them —
// and src/visualization is precisely where the one real src -> tests edge lived.
const RESTRICT_DYNAMIC_TESTS_IMPORT = {
  selector: 'ImportExpression > Literal[value=/(^|\\/)tests\\//]',
  message: 'src/** must not import from tests/**, dynamically either: core no-restricted-imports does not inspect import() expressions.',
};

export default tseslint.config(
  // package.json is excluded: eslint-plugin-vue's unscoped essential/strongly-recommended
  // rule blocks (no `files` restriction) assume a script/template AST and crash the JSON
  // language plugin obsidianmd's recommended config applies to package.json.
  // .obsidian/** is this working directory's own local vault config (gitignored, holds
  // other unrelated third-party plugins' bundled main.js) — never our source.
  // tests/fixtures/fallow/project/** is Part 6's fallow fixture project (Y21): analysed by
  // fallow, excluded from tsconfig.test.json, so it cannot be type-aware linted either.
  // tests/fixtures/fallow/relations-project/** is WP-03 Part 1's relations fixture (N34): same reason.
  { ignores: ['dist/**', 'docs/**', 'node_modules/**', 'package.json', '.obsidian/**', 'tests/fixtures/fallow/project/**', 'tests/fixtures/fallow/relations-project/**', '.fallow-bin/**'] },
  ...tseslint.configs.recommendedTypeChecked,
  ...vue.configs['flat/recommended'],
  ...obsidianmd.configs.recommended,   // no-nodejs-modules, hardcoded-config-path,
                                       // prefer-instanceof, detach-leaves,
                                       // no-unsupported-api, prefer-setting-definitions
  { languageOptions: { parserOptions: { project: ['./tsconfig.json', './tsconfig.test.json'] } } },

  // vue.configs['flat/recommended'] sets up vue-eslint-parser for .vue files, but its
  // <script> block still parses with plain espree unless told to use
  // @typescript-eslint/parser instead — without this, `<script setup lang="ts">`'s own
  // TypeScript syntax (starting with `import type { ... }`) is a parse error. Task 3 is
  // the first task with a .vue file that has any script content, so this gap was never
  // exercised until now.
  { files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] } } },

  // eslint-plugin-obsidianmd@0.4.2's own recommended config turns `no-nodejs-modules` OFF
  // everywhere when manifest.json declares isDesktopOnly: true (its rationale: the rule
  // exists to protect mobile compatibility, which a desktop-only plugin has opted out of).
  // That default is correct for scripts/** and tests/**, which run under plain Node and
  // never enter the bundle — but spec 3.1's guard is about src/**, where a static Node
  // import would be bundled into the Obsidian renderer regardless of desktop-only status.
  // Ruling P3 forbids weakening this rule, so it is restored to 'error' for src/** only.
  { files: ['src/**/*.{ts,vue}'], rules: { 'obsidianmd/no-nodejs-modules': 'error' } },

  // *.mjs build scripts and *.config.* files belong to no tsconfig project; scope
  // type-aware linting off them so `npm run lint` can pass (ruling P3).
  // disableTypeChecked only turns off @typescript-eslint/*'s own type-checked rules —
  // it does not touch eslint-plugin-obsidianmd's type-checked rules (no-plugin-as-component,
  // no-view-references-in-plugin, no-unsupported-api, prefer-create-el,
  // prefer-file-manager-trash-file, prefer-instanceof), which stay enabled with no
  // parser services and crash. These rules exist to police Obsidian plugin source
  // (src/**), not build scripts, so they are turned off here too, not weakened there.
  {
    files: ['**/*.mjs', '*.config.*'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      'obsidianmd/no-plugin-as-component': 'off',
      'obsidianmd/no-view-references-in-plugin': 'off',
      'obsidianmd/no-unsupported-api': 'off',
      'obsidianmd/prefer-create-el': 'off',
      'obsidianmd/prefer-file-manager-trash-file': 'off',
      'obsidianmd/prefer-instanceof': 'off',
      // Same reasoning as the scripts/** block below: config files are tooling,
      // not plugin source, and eslint.config.mjs's own ignore list literally
      // names '.obsidian/**' to exclude this working directory's local vault.
      'obsidianmd/hardcoded-config-path': 'off',
    },
  },

  // scripts/** are Node build tooling, never shipped in the bundle: the hardcoded
  // '.obsidian' default in install-to-vault.mjs is deliberate (spec 3.5) and the
  // console.log status lines are normal CLI output, not renderer logging spec 3.4's
  // no-console guidance targets.
  { files: ['scripts/**/*.mjs'], rules: {
    'obsidianmd/hardcoded-config-path': 'off',
    'obsidianmd/rule-custom-message': 'off',
  } },
  // tests/** legitimately writes real, literal paths (scratch vault fixtures) while
  // exercising Node-only fixtures; this is a strictness default, not a load-bearing
  // guard, and does not appear in ruling P3's do-not-weaken list. Fixture values read
  // via JSON.parse are typed at the call site instead of disabling no-unsafe-* here —
  // see tests/unit/manifest.test.ts's ManifestJson interface.
  { files: ['tests/**/*.ts'], rules: { 'obsidianmd/hardcoded-config-path': 'off' } },

  // tests/unit/validator.test.ts deliberately builds malformed / arbitrary-shaped
  // payloads to exercise validateSnapshot's and validateCityViewState's `unknown`
  // boundary (corrupting a valid fixture's fields to values a hostile or corrupted
  // payload could carry). `any` is the correct type for that, unlike a typed
  // JSON.parse fixture (see manifest.test.ts's ManifestJson). Scoped to this one file.
  { files: ['tests/unit/validator.test.ts'], rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
  } },

  // Both files construct hand-rolled Plugin/CityRendererPort test doubles whose
  // methods are plain vi.fn() properties, not real bound instance methods.
  // expect(double.method) is the correct assertion idiom for a spy and never depends
  // on `this` binding; @typescript-eslint/unbound-method only flags it here because
  // the double's type intersects with the real Obsidian Plugin class, whose same-named
  // members ARE real methods.
  { files: ['tests/host/plugin-onload.test.ts', 'tests/host/city-view.test.ts'], rules: {
    '@typescript-eslint/unbound-method': 'off',
  } },

  // tests/mocks/obsidian.ts (and, since task 11 fix round 1's item 0 split,
  // tests/mocks/dom-extensions.ts — the SAME code, relocated for the tests/**
  // 450-line cap, not a new file earning a new exemption) emulates what the real
  // Obsidian app does to the DOM BEFORE any plugin loads (patching Element/
  // HTMLElement/HTMLCanvasElement prototypes with createDiv/createEl/win/doc/etc.)
  // — it cannot call the very helpers it is in the middle of defining, so plain
  // createElement is correct here, not a style lapse. Likewise globalThis is the
  // right target for a Node-or-jsdom guard shared across both vitest environments,
  // not a popout-window concern.
  { files: ['tests/mocks/obsidian.ts', 'tests/mocks/dom-extensions.ts'], rules: {
    'obsidianmd/prefer-create-el': 'off',
    'obsidianmd/no-global-this': 'off',
  } },

  // The task-3 brief's own verbatim code uses `win.document.createElement('canvas')`
  // (not createEl) for the one-shot, throwaway 1x1 canvas used to resolve a CSS colour
  // and for the renderer's WebGL canvas — createEl's DomElementInfo convenience (cls/
  // attr/text) buys nothing here, and the fixture tests double `document.createElement`
  // directly (matching a real 2D/WebGL context negotiation, which createEl does not
  // change). Scoped to these two files, not project-wide.
  { files: ['src/visualization/color.ts', 'src/visualization/city-renderer.ts'], rules: {
    'obsidianmd/prefer-create-el': 'off',
  } },

  // Task 4's own verbatim brief code: downloadText's transient anchor is created on
  // `host.ownerDocument` — a generic HTMLElement's document, not necessarily one Obsidian
  // has patched with `createEl`/`win` (the component test deliberately does not import
  // ../mocks/obsidian, matching what a non-Obsidian jsdom document looks like). Plain
  // `doc.createElement('a')` is the portable call that works whether or not the document
  // has been extended. Its component test builds its host the same plain way, for the
  // same reason: to prove downloadText against an unpatched jsdom document. Scoped to
  // these two files, not project-wide.
  { files: ['src/ui/export/download.ts', 'tests/component/download.test.ts'], rules: {
    'obsidianmd/prefer-create-el': 'off',
  } },

  // Rule 4 — spec 4.4's CROSS-WINDOW rule, backed by a tool instead of by discipline
  // (Phase 2 fix wave, I9; ruling M88). Spec 4.4 states a closed list: "inside the
  // renderer and view, no bare `window`, `document`, `requestAnimationFrame`,
  // `setInterval`, `ResizeObserver`, `IntersectionObserver`, or `instanceof` on a DOM
  // type". Every one of those resolves against the window the MODULE was loaded in,
  // never the window the element is currently in — so after a pop-out they silently
  // address the wrong window, with no error anywhere. This branch has already paid
  // THREE fix rounds for that exact class (bare document/window/instanceof in three
  // files; the Escape listener bound to the pre-migration document; the ResizeObserver
  // built off the old window's constructor), each found by a reviewer rather than by a
  // tool. The injected `Window`/`Document` — `el.win`, `el.doc`, or a `win` parameter —
  // is the only correct source, exactly as the colour rule above made a silent
  // renderer hazard loud.
  //
  // setTimeout/clearTimeout are included beyond §4.4's own list: timers share the
  // plugin's one JS realm, so a bare one is not a live defect the way a bare
  // `document` is, but it is the same SHAPE, it is the residue this rule was written
  // against, and exempting it would leave the rule arguing with itself. The
  // `instanceof` half of §4.4's sentence is not expressible here; `obsidianmd/
  // prefer-instanceof` already covers it.
  {
    files: ['src/ui/**/*.{ts,vue}', 'src/visualization/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error',
        ...['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame',
            'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout',
            'ResizeObserver', 'IntersectionObserver', 'matchMedia', 'devicePixelRatio',
            'getComputedStyle', 'innerWidth', 'innerHeight', 'localStorage'].map((name) => ({
          name,
          message: `spec 4.4: no bare \`${name}\` inside src/ui or src/visualization — it resolves against the window this MODULE loaded in, which is the wrong one after a pop-out. Use the injected Window/Document (el.win / el.doc / a \`win\` parameter).`,
        })),
      ],
    },
  },

  // WP-02 task 5: src/ui/kit/** is a low-level display-primitive kit (Icon, Callout,
  // Panel, Sparkline, ...) whose names are deliberately single words, matching common
  // UI-kit convention and the task brief's own verbatim component names. vue/multi-word-
  // component-names exists to keep app-level components from colliding with native/
  // future HTML elements; these are internal, PascalCase-imported kit primitives, never
  // registered as custom elements, so the collision risk the rule guards against does
  // not apply here. Scoped to this one directory rather than weakened project-wide.
  { files: ['src/ui/kit/**/*.vue'], rules: { 'vue/multi-word-component-names': 'off' } },

  // Rule 1 — size
  { files: ['src/**/*.{ts,vue}'], rules: { 'max-lines': ['error', 400] } },
  { files: ['tests/**/*.ts'], rules: { 'max-lines': ['error', 450] } },

  // Rule 2 — layering
  //
  // M3 (fix wave item 2): src/** must never reach into tests/**. There was exactly one
  // such edge — city-renderer.ts's dev-fixture import — and per I1 it demonstrably
  // reached dist/main.js, so this makes the leak structurally impossible rather than
  // merely fixed. Declared FIRST and repeated inside the two narrower blocks below on
  // purpose: flat config REPLACES a rule's options rather than merging them, so a
  // src/domain or src/visualization file would otherwise lose this pattern entirely.
  //
  // The no-restricted-syntax half is not belt-and-braces. Verified by running eslint:
  // core `no-restricted-imports` sees `import ... from '…'` declarations but NOT an
  // `import('…')` EXPRESSION — and the one real edge that existed (city-renderer.ts's
  // dev fixture) was exactly a dynamic import, so the patterns alone would have left the
  // hole they were added to close. The fixture itself was moved into src/visualization/,
  // so no src -> tests edge remains in either form.
  {
    files: ['src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['**/tests/**', '../tests/*', '../../tests/*'],
          message: 'src/** must not import from tests/**: a test fixture reaching the bundle ships test code.' },
      ] }],
      'no-restricted-syntax': ['error', { selector: RESTRICT_DYNAMIC_TESTS_IMPORT.selector,
        message: RESTRICT_DYNAMIC_TESTS_IMPORT.message }],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['obsidian', 'electron', 'vue', 'pinia', 'three', 'three/*',
                  'fs', 'path', 'node:*', 'fallow', 'fallow/*'],
          message: 'src/domain stays pure: no host, framework, renderer, Node or fallow imports.' },
        { group: ['../adapters/*', '../host/*', '../ui/*', '../visualization/*', '../application/*',
                  '**/adapters/**', '**/host/**', '**/ui/**', '**/visualization/**', '**/application/**'],
          message: 'src/domain must not depend on an outer layer.' },
        { group: ['**/tests/**', '../../tests/*'],
          message: 'src/** must not import from tests/**.' },
      ] }],
    },
  },
  {
    files: ['src/visualization/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['obsidian', 'electron', 'fs', 'path', 'node:*',
                  '**/host/**', '**/adapters/**', '**/application/**'],
          message: 'src/visualization reaches neither the filesystem nor the host.' },
        { group: ['**/tests/**', '../../tests/*'],
          message: 'src/** must not import from tests/**.' },
      ] }],
      // Rule 3 — colour management. Double conversion is SILENT: no error, no warning,
      // just a 2-3x darker render. Lint is the only thing that catches it (spec 3.2, 3.4).
      'no-restricted-syntax': ['error',
        // Repeated from the src/** block above: flat config replaces, never merges.
        { selector: RESTRICT_DYNAMIC_TESTS_IMPORT.selector, message: RESTRICT_DYNAMIC_TESTS_IMPORT.message },
        { selector: "MemberExpression[property.name='convertSRGBToLinear']",
          message: 'ColorManagement.enabled defaults to true since r152 — new Color(hex) already converts sRGB to working. Calling this renders everything markedly darker, with no error and no warning.' },
        { selector: "MemberExpression[property.name='convertLinearToSRGB']",
          message: 'Banned for the same reason as convertSRGBToLinear. Use ColorManagement.workingToColorSpace() (r177).' },
      ],
    },
  },
);
