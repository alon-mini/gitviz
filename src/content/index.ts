import { VISIBILITY_ACTION_ROOT_ID, VisibilityActionWidget } from './trust-widget';
import { isLikelyRepoPage, parseRepoFromLocation } from './repo-detection';

let lastRepoKey = '';

function boot(): void {
  if (!isLikelyRepoPage()) return;
  const repo = parseRepoFromLocation();
  if (!repo) return;

  const key = `${repo.owner}/${repo.repo}`;
  const existingAction = document.getElementById(VISIBILITY_ACTION_ROOT_ID);
  if (key !== lastRepoKey && existingAction) existingAction.remove();
  const visibilityActionMounted = Boolean(document.getElementById(VISIBILITY_ACTION_ROOT_ID));
  if (key === lastRepoKey && visibilityActionMounted) return;
  lastRepoKey = key;

  if (!visibilityActionMounted) new VisibilityActionWidget(repo).mount();
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
