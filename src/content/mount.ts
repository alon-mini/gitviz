export const ROOT_ID = 'github-repo-visibility-root';

export function mountRoot(): HTMLElement | null {
  const existing = document.getElementById(ROOT_ID);
  if (existing) return existing;

  const root = document.createElement('section');
  root.id = ROOT_ID;
  root.setAttribute('aria-label', 'GitHub repository visibility summary');

  const target = findMountTarget();
  if (!target) return null;

  target.insertAdjacentElement('afterend', root);
  return root;
}

function findMountTarget(): Element | null {
  return document.querySelector('[data-testid="repository-container-header"]')
    ?? document.querySelector('.js-repo-nav')
    ?? document.querySelector('main .Layout-sidebar')
    ?? document.querySelector('main')
    ?? document.body;
}
