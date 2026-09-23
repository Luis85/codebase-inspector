// A query parameter rather than a page per screen, for one reason: a headless
// screenshot needs a URL and nothing to click.
//   ?screen=s05..s11   which screen state to seed
//   ?theme=dark|light  which host scheme (default dark)
//   ?width=<px>        the leaf box's width, for the narrow screen
//   ?route=<id>        which inspector screen (default: city)
//   ?select=first|<path>  select a file (for the file route)
//   ?tab=<id>          select a tab on a tabbed screen (after the route)
//   ?items=demo        seed three work items (workbench, report)
//   ?edit=first        open the first work card's editor (workbench, with items=demo)
//   ?run=running|cancelling  seed the run store with a scan in flight, or being cancelled (city, sources)
//   ?import=demo       open the import dialog with a fixed v1 file (settings, tab=privacy)
//   ?report=demo       attach a SYNTHETIC fallow report built from the fixture's paths (any route)
//   ?lens=findings     turn the findings lens on (city, with report=demo)
//   ?fallow=review     open the Connect fallow dialog at its review step (sources)
//
// `installObsidianDomExtensions` is called FIRST, before any other import runs its own
// top-level code: the harness page has no Obsidian, and the REAL renderer reads
// Obsidian's DOM prototype extensions directly — label-overlay.ts's
// `mountEl.createDiv()`/`setCssStyles()`, theme-bridge.ts's `containerEl.win`/
// `containerEl.getCssPropertyValue()` — not only `page.ts`'s own `document.body.createDiv`
// below. Without this, the first render throws.
import { installObsidianDomExtensions } from '../mocks/dom-extensions';

installObsidianDomExtensions(window);

import { applyWantedScheme } from './theme';
import { mountHarness, type ScreenId } from './mount';
import { isRouteId } from '../../src/domain/route-ids';
import { HARNESS_SYNTHETIC_FOOTER } from './seed';

const SCREENS: readonly ScreenId[] = ['s05', 's06', 's07', 's08', 's09', 's10', 's11'];

const params = new URLSearchParams(window.location.search);
const asked = params.get('screen');
const screen: ScreenId = SCREENS.find((s) => s === asked) ?? 's05';

// S06 is the light screen by definition, so it carries its own scheme rather than
// requiring every caller to remember `&theme=light` — a capture that forgot would be
// named s06 and show the dark city, which is worse than no capture.
applyWantedScheme(screen === 's06' ? '?theme=light' : window.location.search);

const leaf = document.body.createDiv({ cls: 'ci-harness-leaf' });
const width = params.get('width');
if (width !== null && /^\d+$/.test(width)) leaf.style.width = `${width}px`;

// Part 6 §5: a page carrying the synthetic fallow report says so, outside the plugin's own
// root, the way the design mockups carry their "synthetic data" caption.
if (params.get('report') === 'demo' || params.get('fallow') === 'review') {
  document.body.createEl('footer', { cls: 'ci-harness-footer', text: HARNESS_SYNTHETIC_FOOTER });
}

const askedRoute = params.get('route');
const route = isRouteId(askedRoute) ? askedRoute : 'city';

const select = params.get('select');
const run = params.get('run');

void mountHarness(leaf, {
  screen, route, ...(select ? { select } : {}), ...(params.get('tab') ? { tab: params.get('tab')! } : {}),
  ...(params.get('items') === 'demo' ? { items: 'demo' as const } : {}),
  ...(params.get('edit') === 'first' ? { edit: 'first' as const } : {}),
  ...(run === 'running' || run === 'cancelling' ? { run } : {}),
  ...(params.get('import') === 'demo' ? { importFile: 'demo' as const } : {}),
  ...(params.get('report') === 'demo' ? { report: 'demo' as const } : {}),
  ...(params.get('lens') === 'findings' ? { lens: 'findings' as const } : {}),
  ...(params.get('fallow') === 'review' ? { fallow: 'review' as const } : {}),
});
