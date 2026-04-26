import { ROOT_ID as PANEL_ROOT_ID, mountRoot } from './mount';
import { AUTHENTICITY_ROOT_ID, TrustBreakdownWidget } from './trust-widget';
import { isLikelyRepoPage, parseRepoFromLocation } from './repo-detection';

import { App } from '../ui/App';

let lastRepoKey = '';

function boot(): void {
  if (!isLikelyRepoPage()) return;
  const repo = parseRepoFromLocation();
  if (!repo) return;

  const key = `${repo.owner}/${repo.repo}`;
  const panelMounted = Boolean(document.getElementById(PANEL_ROOT_ID));
  const authenticityMounted = Boolean(document.getElementById(AUTHENTICITY_ROOT_ID));
  if (key === lastRepoKey && panelMounted && authenticityMounted) return;
  lastRepoKey = key;

  if (!panelMounted) {
    const root = mountRoot();
    if (root) new App(root, repo).start();
  }
  if (!authenticityMounted) new TrustBreakdownWidget(repo).mount();
}

boot();

const observer = new MutationObserver(() => {
  window.requestIdleCallback?.(boot, { timeout: 1000 }) ?? window.setTimeout(boot, 250);
});

observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener('popstate', () => {
  lastRepoKey = '';
  boot();
});
