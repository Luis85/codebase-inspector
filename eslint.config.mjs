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

// The src -> tests ban, shared by the src/** block and every layer block below (GRC1): flat
// config REPLACES a rule's options per block, so a block that sets its own
// no-restricted-imports must repeat this pattern or its files silently lose the ban.
const RESTRICT_TESTS_IMPORT_PATTERN = {
  group: ['**/tests/**', '../tests/*', '../../tests/*'],
  message: 'src/** must not import from tests/**: a test fixture reaching the bundle ships test code.',
};

// One layer ban in both forms (GRC1, GCO10). `regex` and not a glob: `**/host/**` does not match a bare
// directory import such as '../host' or '../adapters', which resolves to the directory's index. The same source
// pattern feeds the import() selector, since core no-restricted-imports does not inspect import() expressions
// and a dynamic import would otherwise cross the boundary unseen. Only a string-literal specifier can be read
// statically; a computed one is out of reach of lint.
const layerRegex = (names) => `(^|/)(${names.join('|')})(/|$)`;
const layerBan = (source, message) => ({
  pattern: { regex: source, message },
  dynamic: { selector: `ImportExpression > Literal[value=/${source.replace(/\//g, '\\/')}/]`,
    message: `${message} The ban covers import() expressions as well.` },
});
const UI_BAN = layerBan(layerRegex(['adapters', 'host']),
  'src/ui never imports adapters or host: it reaches them through application ports and injected dependencies.');
const APPLICATION_BAN = layerBan(layerRegex(['adapters', 'host', 'ui']),
  'src/application never imports adapters, host or ui: it defines ports; they implement and consume them.');
const ADAPTERS_BAN = layerBan(layerRegex(['host', 'ui']),
  'src/adapters never imports host or ui: an adapter implements an application port.');
// The review adapter (GCP2) keeps the host ban and the ui ban except for the one codec module.
const REVIEW_ADAPTER_HOST_BAN = layerBan(layerRegex(['host']), ADAPTERS_BAN.pattern.message);
const REVIEW_ADAPTER_UI_BAN = layerBan('(^|/)ui(?:$|/(?!read-models/review-record-codec$))',
  'src/adapters never imports host or ui; the review-record codec is the one recorded exception (GCP2).');
const DOMAIN_BAN = layerBan(layerRegex(['adapters', 'host', 'ui', 'visualization', 'application']),
  'src/domain must not depend on an outer layer.');
const VISUALIZATION_BAN = layerBan(layerRegex(['host', 'adapters', 'application']),
  'src/visualization reaches neither the filesystem nor the host.');
// A layer block replaces no-restricted-syntax too, so each one repeats the tests selector beside its own.
const syntax = (...bans) => ['error', RESTRICT_DYNAMIC_TESTS_IMPORT, ...bans.map((b) => b.dynamic)];

export default tseslint.config(
  // package.json is excluded: eslint-plugin-vue's unscoped essential/strongly-recommended
  // rule blocks (no `files` restriction) assume a script/template AST and crash the JSON
  // language plugin obsidianmd's recommended config applies to package.json.
  // .obsidian/** is this working directory's own local vault config (gitignored, holds
  // other unrelated third-party plugins' bundled main.js) — never our source.
  // tests/fixtures/fallow/project/** is Part 6's fallow fixture project (Y21): analysed by
  // fallow, excluded from tsconfig.test.json, so it cannot be type-aware linted either.
  // tests/fixtures/fallow/relations-project/** is WP-03 Part 1's relations fixture (N34): same reason.
  { ignores: ['dist/**', 'docs/**', 'node_modules/**', 'package.json', '.obsidian/**', 'tests/fixtures/fallow/project/**', 'tests/fixtures/fallow/relations-project/**', '.fallow-bin/**', '.obsidian-cache/**', 'reports/**'] },
  ...tseslint.configs.recommendedTypeChecked,
  ...vue.configs['flat/recommended'],
  ...obsidianmd.configs.recommended,   // no-nodejs-modules, hardcoded-config-path,
                                       // prefer-instanceof, detach-leaves,
                                       // no-unsupported-api, prefer-setting-definitions
  { languageOptions: { parserOptions: { project: ['./tsconfig.json', './tsconfig.test.json', './tests/e2e/tsconfig.json'] } } },

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
  { files: ['tests/**/*.{ts,mts}'], rules: { 'obsidianmd/hardcoded-config-path': 'off' } },

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
  { files: ['tests/**/*.{ts,mts}'], rules: { 'max-lines': ['error', 450] } },

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
      'no-restricted-imports': ['error', { patterns: [RESTRICT_TESTS_IMPORT_PATTERN] }],
      'no-restricted-syntax': ['error', { selector: RESTRICT_DYNAMIC_TESTS_IMPORT.selector,
        message: RESTRICT_DYNAMIC_TESTS_IMPORT.message }],
    },
  },
  // GRC1 / GCO10: a layer never imports one above it. Each block repeats the shared tests
  // pattern (flat config replaces, never merges). The three blocks are declared AFTER the
  // src/** block and BEFORE the exception below, since later blocks win per rule.
  {
    files: ['src/ui/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        RESTRICT_TESTS_IMPORT_PATTERN,
        UI_BAN.pattern,
      ] }],
      'no-restricted-syntax': syntax(UI_BAN),
    },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        RESTRICT_TESTS_IMPORT_PATTERN,
        APPLICATION_BAN.pattern,
      ] }],
      'no-restricted-syntax': syntax(APPLICATION_BAN),
    },
  },
  {
    files: ['src/adapters/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        RESTRICT_TESTS_IMPORT_PATTERN,
        ADAPTERS_BAN.pattern,
      ] }],
      'no-restricted-syntax': syntax(ADAPTERS_BAN),
    },
  },
  // The one recorded exception (GCP2) until the codec moves: the durable review adapter
  // encodes and decodes records through ui/read-models/review-record-codec. Spec row GRC1,
  // owner decision GCO10. Only that import is allowed; the file keeps the host ban, the rest
  // of the ui ban and the tests ban. A `regex` pattern, not a negated glob: gitignore-style
  // `!` cannot re-include a file whose parent directory (ui/read-models) the glob excluded.
  {
    files: ['src/adapters/storage/plugin-data-review-repository.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        RESTRICT_TESTS_IMPORT_PATTERN,
        REVIEW_ADAPTER_HOST_BAN.pattern,
        REVIEW_ADAPTER_UI_BAN.pattern,
      ] }],
      'no-restricted-syntax': syntax(REVIEW_ADAPTER_HOST_BAN, REVIEW_ADAPTER_UI_BAN),
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['obsidian', 'electron', 'vue', 'pinia', 'three', 'three/*',
                  'fs', 'path', 'node:*', 'fallow', 'fallow/*'],
          message: 'src/domain stays pure: no host, framework, renderer, Node or fallow imports.' },
        DOMAIN_BAN.pattern,
        RESTRICT_TESTS_IMPORT_PATTERN,
      ] }],
      'no-restricted-syntax': syntax(DOMAIN_BAN),
    },
  },
  {
    files: ['src/visualization/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['obsidian', 'electron', 'fs', 'path', 'node:*'],
          message: 'src/visualization reaches neither the filesystem nor the host.' },
        VISUALIZATION_BAN.pattern,
        RESTRICT_TESTS_IMPORT_PATTERN,
      ] }],
      // Rule 3 — colour management. Double conversion is SILENT: no error, no warning,
      // just a 2-3x darker render. Lint is the only thing that catches it (spec 3.2, 3.4).
      'no-restricted-syntax': ['error',
        // Repeated from the src/** block above: flat config replaces, never merges.
        { selector: RESTRICT_DYNAMIC_TESTS_IMPORT.selector, message: RESTRICT_DYNAMIC_TESTS_IMPORT.message },
        VISUALIZATION_BAN.dynamic,
        { selector: "MemberExpression[property.name='convertSRGBToLinear']",
          message: 'ColorManagement.enabled defaults to true since r152 — new Color(hex) already converts sRGB to working. Calling this renders everything markedly darker, with no error and no warning.' },
        { selector: "MemberExpression[property.name='convertLinearToSRGB']",
          message: 'Banned for the same reason as convertSRGBToLinear. Use ColorManagement.workingToColorSpace() (r177).' },
      ],
    },
  },
);
