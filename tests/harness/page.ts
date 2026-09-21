// A query parameter rather than a page per screen, for one reason: a headless
// screenshot needs a URL and nothing to click.
//   ?screen=s05..s11   which screen state to seed
//   ?theme=dark|light  which host scheme (default dark)
//   ?width=<px>        the leaf box's width, for the narrow screen
//   ?route=<id>        which inspector screen (default: city)
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

const askedRoute = params.get('route');
const route = isRouteId(askedRoute) ? askedRoute : 'city';

void mountHarness(leaf, { screen, route });
