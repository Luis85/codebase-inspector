// Obsidian signals a palette change with a `css-change` workspace event carrying no
// payload; `city-view.ts` responds by calling `readPalette` again and forwarding the
// result to `setColors`. There is no workspace here, so the harness fires a plain DOM
// event and `mount.ts` does the same two steps. Without this, switching scheme would
// restyle every HTML surface and leave the WebGL city in the old palette — the exact
// split the design package's "theme changes must recolor materials AND labels" rule is
// about.
export type Scheme = 'dark' | 'light';

export const HARNESS_THEME_EVENT = 'ci-harness-theme';

const SCHEMES: readonly Scheme[] = ['dark', 'light'];

export function wantedScheme(search: string): Scheme {
  const asked = new URLSearchParams(search).get('theme');
  return SCHEMES.find((scheme) => scheme === asked) ?? 'dark';
}

export function applyScheme(scheme: Scheme): void {
  document.body.classList.toggle('theme-dark', scheme === 'dark');
  document.body.classList.toggle('theme-light', scheme === 'light');
  window.dispatchEvent(new Event(HARNESS_THEME_EVENT));
}

export function applyWantedScheme(search: string): Scheme {
  const scheme = wantedScheme(search);
  applyScheme(scheme);
  return scheme;
}
