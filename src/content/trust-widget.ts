import type { RepoRef } from '../background/messages';
import { App } from '../ui/App';

export const VISIBILITY_ACTION_ROOT_ID = 'github-repo-visibility-action-root';

export class VisibilityActionWidget {
  private state: { open: boolean } = { open: false };

  constructor(private repo: RepoRef) {}

  mount(): void {
    const root = this.ensureRoot();
    if (!root) return;
    this.render(root);
  }

  private ensureRoot(): HTMLElement | null {
    const existing = document.getElementById(VISIBILITY_ACTION_ROOT_ID);
    if (existing) return existing;

    const target = findWatchButtonTarget();
    if (!target) return null;

    const root = document.createElement(target.listItem ? 'li' : 'span');
    root.id = VISIBILITY_ACTION_ROOT_ID;
    root.setAttribute('aria-label', 'Git repository visibility');
    target.element.insertAdjacentElement('afterend', root);
    return root;
  }

  private render(root: HTMLElement): void {
    root.innerHTML = `
      <style>${styles}</style>
      <span class="gra-wrap">
        <button class="gra-badge" type="button" aria-expanded="${this.state.open}" aria-haspopup="dialog" aria-label="Git visibility">
          ${visibilityIcon()} Git Visibility
        </button>
        ${this.state.open ? this.renderPopover() : ''}
      </span>
    `;

    root.querySelector('.gra-badge')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.state = { open: !this.state.open };
      this.render(root);
    });

    root.querySelector('.gra-close')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.state = { open: false };
      this.render(root);
    });

    const panelRoot = root.querySelector<HTMLElement>('.gra-panel-root');
    if (panelRoot) new App(panelRoot, this.repo).start();
  }

  private renderPopover(): string {
    return `
      <section class="gra-popover" role="dialog" aria-label="Git visibility panel">
        <div class="gra-popover-bar">
          <span>${shieldIcon()} Authenticity-first repository visibility</span>
          <button class="gra-close" type="button" aria-label="Close git visibility panel">Close</button>
        </div>
        <div class="gra-panel-root"></div>
      </section>
    `;
  }
}

function findWatchButtonTarget(): { element: Element; listItem: boolean } | null {
  const watchControl = document.querySelector('#repository-details-watch-button')
    ?? Array.from(document.querySelectorAll('.pagehead-actions a, .pagehead-actions button, .pagehead-actions summary'))
      .find(isWatchControl);

  if (watchControl) {
    const actionItem = watchControl.closest('li');
    return actionItem ? { element: actionItem, listItem: true } : { element: watchControl, listItem: false };
  }

  const firstActionItem = document.querySelector('.pagehead-actions > li');
  return firstActionItem ? { element: firstActionItem, listItem: true } : null;
}

function isWatchControl(element: Element): boolean {
  const label = `${element.getAttribute('aria-label') ?? ''} ${element.textContent ?? ''}`;
  return /\b(watch|unwatch|notifications?)\b/i.test(label);
}

function visibilityIcon(): string {
  return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M2.25 12s3.5-6.25 9.75-6.25S21.75 12 21.75 12s-3.5 6.25-9.75 6.25S2.25 12 2.25 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.75" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
}

function shieldIcon(): string {
  return '<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M8 1.75 3.75 3.3v3.34c0 2.83 1.68 5.39 4.25 6.61 2.57-1.22 4.25-3.78 4.25-6.61V3.3L8 1.75Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/><path d="m6.1 7.85 1.2 1.2 2.75-3" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

const styles = `
  #${VISIBILITY_ACTION_ROOT_ID} { display: inline-flex; position: relative; vertical-align: middle; }
  #${VISIBILITY_ACTION_ROOT_ID} * { box-sizing: border-box; }
  .gra-wrap { position: relative; display: inline-flex; }
  .gra-badge { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 6px; padding: 5px 12px; background: var(--button-default-bgColor-rest, var(--bgColor-muted, #f6f8fa)); color: var(--button-default-fgColor-rest, var(--fgColor-default, #24292f)); font: 600 14px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; cursor: pointer; }
  .gra-badge:hover { background: var(--button-default-bgColor-hover, #f3f4f6); border-color: var(--borderColor-accent-emphasis, #0969da); color: var(--fgColor-accent, #0969da); }
  .gra-badge:focus-visible, .gra-close:focus-visible { outline: 3px solid color-mix(in srgb, var(--fgColor-accent, #0969da) 34%, transparent); outline-offset: 2px; }
  .gra-badge svg { width: 14px; height: 14px; }
  .gra-popover { position: absolute; top: calc(100% + 8px); right: 0; z-index: 1000; width: min(980px, calc(100vw - 24px)); max-height: min(84vh, 900px); overflow: auto; border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 18px; padding: 10px; background: var(--bgColor-default, #fff); color: var(--fgColor-default, #24292f); box-shadow: 0 20px 52px rgba(31, 35, 40, .2); font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  .gra-popover-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; border: 1px solid var(--borderColor-muted, #d8dee4); border-radius: 14px; padding: 8px 10px; background: var(--bgColor-muted, #f6f8fa); color: var(--fgColor-muted, #57606a); font-size: 12px; font-weight: 750; }
  .gra-popover-bar span { display: inline-flex; align-items: center; gap: 6px; }
  .gra-popover-bar svg { display: block; width: 15px; height: 15px; color: var(--fgColor-accent, #0969da); }
  .gra-close { border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 999px; padding: 4px 10px; background: var(--button-default-bgColor-rest, var(--bgColor-default, #fff)); color: var(--fgColor-default, #24292f); font: inherit; font-weight: 750; cursor: pointer; }
  .gra-close:hover { background: var(--button-default-bgColor-hover, #f3f4f6); }
  .gra-panel-root .grv-panel { margin: 0; box-shadow: none; }
  @media (max-width: 1012px) { .gra-popover { right: auto; left: -140px; } }
  @media (max-width: 700px) { .gra-popover { position: fixed; inset: 8px; width: auto; max-height: none; } .gra-popover-bar { align-items: flex-start; flex-direction: column; } }
`;
