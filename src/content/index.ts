import { mountRoot } from './mount';
import { isLikelyRepoPage, parseRepoFromLocation } from './repo-detection';
import { TrustBreakdownWidget } from './trust-widget';
import { App } from '../ui/App';

let lastRepoKey = '';

function boot(): void {
  if (!isLikelyRepoPage()) return;
  const repo = parseRepoFromLocation();
  if (!repo) return;

  const key = `${repo.owner}/${repo.repo}`;
  if (key === lastRepoKey && document.getElementById('github-repo-visibility-root')) return;
  lastRepoKey = key;

  const root = mountRoot();
  if (root) new App(root, repo).start();
  new TrustBreakdownWidget(repo).mount();
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
