import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import obsidianmd from 'eslint-plugin-obsidianmd';

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
  // tests/** legitimately parses/writes real paths and JSON.parse results while
  // exercising Node-only fixtures; these are strictness defaults, not load-bearing
  // guards, and do not appear in ruling P3's do-not-weaken list.
  {
    files: ['tests/**/*.ts'],
    rules: {
      'obsidianmd/hardcoded-config-path': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // Rule 1 — size
  { files: ['src/**/*.{ts,vue}'], rules: { 'max-lines': ['error', 400] } },
  { files: ['tests/**/*.ts'], rules: { 'max-lines': ['error', 450] } },

  // Rule 2 — layering
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
      ] }],
      // Rule 3 — colour management. Double conversion is SILENT: no error, no warning,
      // just a 2-3x darker render. Lint is the only thing that catches it (spec 3.2, 3.4).
      'no-restricted-syntax': ['error',
        { selector: "MemberExpression[property.name='convertSRGBToLinear']",
          message: 'ColorManagement.enabled defaults to true since r152 — new Color(hex) already converts sRGB to working. Calling this renders everything markedly darker, with no error and no warning.' },
        { selector: "MemberExpression[property.name='convertLinearToSRGB']",
          message: 'Banned for the same reason as convertSRGBToLinear. Use ColorManagement.workingToColorSpace() (r177).' },
      ],
    },
  },
);
