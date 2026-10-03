// Part 5 V7: focus after in-leaf navigation. A `pre` watcher notes whether focus was inside
// this leaf's shell before the route patch; a `post` watcher then decides:
// (1) focus was inside and fell out (the trigger unmounted; CiDialog's fallback onto the
//     shell root counts too): focus the new screen's first page-header title, or <main>.
//     The focused heading is the announcement, so nothing else is said.
// (2) focus was inside and still is (nav column, top bar, palette opener): it stays, and
//     the shell's status region says "<Screen> screen." once (reannounce).
// (3) focus was elsewhere (host-driven navigation, another pane): nothing moves or is said.
import { watch, type Ref } from 'vue';
import { ROUTE_OPENED } from '../inspector-copy';
import { reannounce } from '../kit/reannounce';
import { ROUTE_META } from '../routes';
import { useCityStore } from '../stores/city-store';

/** Focus sits on something inside the shell other than the shell root itself. */
function focusWithin(shell: HTMLElement): boolean {
  const active = shell.ownerDocument.activeElement;
  return active !== null && active !== shell && shell.contains(active);
}

export function useRouteFocus(shellEl: Ref<HTMLElement | null>, mainEl: Ref<HTMLElement | null>, liveMessage: Ref<string>): void {
  const store = useCityStore();
  let hadFocus = false;
  watch(() => store.route, () => {
    const shell = shellEl.value;
    hadFocus = shell !== null && shell.contains(shell.ownerDocument.activeElement);
  }, { flush: 'pre' });
  watch(() => store.route, (route) => {
    const shell = shellEl.value;
    const wasInside = hadFocus;
    hadFocus = false;
    if (!wasInside || !shell) return;
    if (focusWithin(shell)) {
      void reannounce(liveMessage, ROUTE_OPENED(ROUTE_META[route].title));
      return;
    }
    const main = mainEl.value;
    (main?.querySelector<HTMLElement>('.ci-page-header__title') ?? main)?.focus();
  }, { flush: 'post' });
}
