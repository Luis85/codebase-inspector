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
  { ignores: ['dist/**', 'docs/**', 'node_modules/**', 'package.json', '.obsidian/**'] },
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

  // tests/mocks/obsidian.ts emulates what the real Obsidian app does to the DOM
  // BEFORE any plugin loads (patching Element/HTMLElement/HTMLCanvasElement
  // prototypes with createDiv/createEl/win/doc/etc.) — it cannot call the very
  // helpers it is in the middle of defining, so plain createElement is correct here,
  // not a style lapse. Likewise globalThis is the right target for a Node-or-jsdom
  // guard shared across both vitest environments, not a popout-window concern.
  { files: ['tests/mocks/obsidian.ts'], rules: {
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
