// IPF20: native tests never match Obsidian's own UI text (the session UI follows the system locale, German
// here); they use selectors, command ids and `executeObsidian`.
import { expect } from 'vitest';
import { CITY_VIEW_TYPE, type NativeBrowser } from './session';

type ErrorWindow = Window & { ciErrors?: string[] };

export type InspectorPage = ReturnType<typeof createInspectorPage>;

export function createInspectorPage(browser: NativeBrowser) {
  const root = () => browser.$(`.workspace-leaf-content[data-type="${CITY_VIEW_TYPE}"] .codebase-inspector-root`);
  return {
    root,
    screen: (route: string) => root().$(`.ci-screen--${route}`),
    async openCity(): Promise<void> {
      await browser.executeObsidianCommand('codebase-inspector:open-city');
      await expect.poll(() => root().isExisting()).toBe(true);
    },
    async navigate(title: string): Promise<void> {
      const item = root().$(`.ci-nav__item*=${title}`);
      if (!(await item.isDisplayed())) await root().$('.ci-topbar__menu').click();
      await item.click();
    },
    async recordErrors(): Promise<void> {
      await browser.executeObsidian(() => {
        const win: ErrorWindow = activeWindow;
        const errors: string[] = [];
        win.ciErrors = errors;
        const original = console.error.bind(console);
        console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); original(...args); };
        win.addEventListener('error', (e) => { errors.push(e.message); });
        win.addEventListener('unhandledrejection', (e) => { errors.push(String(e.reason)); });
      });
    },
    errors: () => browser.executeObsidian((): string[] => (activeWindow as ErrorWindow).ciErrors ?? []),
  };
}
