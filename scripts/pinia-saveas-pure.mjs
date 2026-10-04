// Gap closure GRA10/B23. pinia 4.0.3 offers ONE entry (dist/pinia.js, its `exports` map has
// no production variant) and that file carries a FileSaver island, two XHRs, that is dead
// in this plugin: the devtools code that calls it is removed by the production
// `NODE_ENV` define, and `saveAs` has no other caller. The island still survived
// tree-shaking, because `saveAs`'s initialiser is a conditional expression Rollup cannot
// prove side-effect free (it reads `HTMLAnchorElement.prototype`).
//
// Wrapping that initialiser in a `/*#__PURE__*/` IIFE tells Rollup it may drop the whole
// declaration when unreferenced, which takes the island's helper functions with it. The
// transform is deliberately narrow (one file, one statement) and FAILS the build when the
// statement is gone, so a pinia bump cannot quietly turn this into a no-op.
const PINIA_ID = /[\\/]node_modules[\\/]pinia[\\/]dist[\\/]pinia\.js$/;
const NEEDLE = /const saveAs = (!IS_CLIENT \?[^;]*);/;

/** @returns {import('vite').Plugin} */
export function piniaSaveAsPure() {
  return {
    name: 'ci-pinia-saveas-pure',
    enforce: 'pre',
    transform(code, id) {
      if (!PINIA_ID.test(id)) return null;
      if (!NEEDLE.test(code)) {
        this.error('pinia-saveas-pure (GRA10): the saveAs needle is gone; re-check pinia before shipping its XHR island');
      }
      return { code: code.replace(NEEDLE, 'const saveAs = /*#__PURE__*/ (() => $1)();'), map: null };
    },
  };
}
