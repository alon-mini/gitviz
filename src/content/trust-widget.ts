import type { RepoRef, RepoSummaryView, RepositoryAuthenticityView } from '../background/messages';
import { requestAuthenticity, requestSummary } from './client';
import { App, buildHealthMetric } from '../ui/App';

type PopoverPosition = { left: number; top: number };

type HealthButtonState = {
  open: boolean;
  summary?: RepoSummaryView;
  authenticity?: RepositoryAuthenticityView;
  loading: boolean;
  authenticityLoading: boolean;
  position?: PopoverPosition;
};

export const VISIBILITY_ACTION_ROOT_ID = 'github-repo-visibility-action-root';

export class VisibilityActionWidget {
  private state: HealthButtonState = { open: false, loading: true, authenticityLoading: true };

  constructor(private repo: RepoRef) {}

  mount(): void {
    const root = this.ensureRoot();
    if (!root) return;
    this.render(root);
    this.loadHealth(root);
  }

  private ensureRoot(): HTMLElement | null {
    const existing = document.getElementById(VISIBILITY_ACTION_ROOT_ID);
    if (existing) return existing;

    const target = findWatchButtonTarget();
    if (!target) return null;

    const root = document.createElement(target.listItem ? 'li' : 'span');
    root.id = VISIBILITY_ACTION_ROOT_ID;
    root.setAttribute('aria-label', 'Git repository health and authenticity');
    target.element.insertAdjacentElement('afterend', root);
    return root;
  }

  private render(root: HTMLElement): void {
    root.innerHTML = `
      <style>${styles}</style>
      <span class="gra-wrap">
        <button class="gra-badge gra-health-badge" type="button" aria-expanded="${this.state.open}" aria-haspopup="dialog" aria-label="Health">
          ${starIcon()} <span>Health</span> <strong>${escapeHtml(this.healthLabel())}</strong>
        </button>
        <button class="gra-badge gra-authenticity-badge" type="button" aria-expanded="${this.state.open}" aria-haspopup="dialog" aria-label="Authenticity">
          ${shieldIcon()} <span>Authenticity</span> <strong>${escapeHtml(this.authenticityLabel())}</strong>
        </button>
        ${this.state.open ? this.renderPopover(root) : ''}
      </span>
    `;

    root.querySelectorAll('.gra-badge').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.state = { ...this.state, open: !this.state.open, position: this.state.open ? this.state.position : this.initialPopoverPosition(root) };
        this.render(root);
      });
    });

    root.querySelector('.gra-close')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.state = { ...this.state, open: false };
      this.render(root);
    });

    this.attachDragHandlers(root);

    const panelRoot = root.querySelector<HTMLElement>('.gra-panel-root');
    if (panelRoot) new App(panelRoot, this.repo).start();
  }

  private loadHealth(root: HTMLElement): void {
    requestSummary(this.repo).then((response) => {
      if (response.ok && response.type === 'summary') {
        this.state = { ...this.state, summary: response.data, loading: false };
      } else if (!response.ok) {
        this.state = { ...this.state, loading: false };
      }
      this.render(root);
    });

    requestAuthenticity(this.repo).then((response) => {
      if (response.ok && response.type === 'authenticity') {
        this.state = { ...this.state, authenticity: response.data, authenticityLoading: false };
        this.render(root);
      } else if (!response.ok) {
        this.state = { ...this.state, authenticityLoading: false };
        this.render(root);
      }
    });
  }

  private healthLabel(): string {
    if (!this.state.summary) return this.state.loading ? 'Loading' : 'Open';
    return buildHealthMetric(this.state.summary, this.state.authenticity).label;
  }

  private authenticityLabel(): string {
    if (!this.state.authenticity) return this.state.authenticityLoading ? 'Loading' : 'Open';
    return `${this.state.authenticity.score}/100`;
  }

  private renderPopover(root: HTMLElement): string {
    const position = this.state.position ?? this.initialPopoverPosition(root);
    return `
      <section class="gra-popover" role="dialog" aria-label="Health panel" style="left: ${position.left}px; top: ${position.top}px;">
        <div class="gra-popover-bar" data-drag-handle="true">
          <span>${starIcon()} Health repository signals</span>
          <span class="gra-popover-actions">
            <span class="gra-drag-hint">Drag to move; resize from the corner</span>
            <button class="gra-close" type="button" aria-label="Close Health panel">Close</button>
          </span>
        </div>
        <div class="gra-panel-root"></div>
      </section>
    `;
  }

  private initialPopoverPosition(root: HTMLElement): PopoverPosition {
    const rect = root.getBoundingClientRect();
    const width = Math.min(980, window.innerWidth - 24);
    const left = clamp(rect.right - width, 12, Math.max(12, window.innerWidth - width - 12));
    const top = clamp(rect.bottom + 8, 12, Math.max(12, window.innerHeight - 160));
    return { left, top };
  }

  private attachDragHandlers(root: HTMLElement): void {
    const popover = root.querySelector<HTMLElement>('.gra-popover');
    const handle = root.querySelector<HTMLElement>('[data-drag-handle="true"]');
    if (!popover || !handle) return;

    handle.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      const startX = event.clientX;
      const startY = event.clientY;
      const rect = popover.getBoundingClientRect();
      const startLeft = rect.left;
      const startTop = rect.top;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const nextLeft = clamp(startLeft + moveEvent.clientX - startX, 8, Math.max(8, window.innerWidth - popover.offsetWidth - 8));
        const nextTop = clamp(startTop + moveEvent.clientY - startY, 8, Math.max(8, window.innerHeight - Math.min(popover.offsetHeight, window.innerHeight - 16) - 8));
        popover.style.left = `${nextLeft}px`;
        popover.style.top = `${nextTop}px`;
        this.state = { ...this.state, position: { left: nextLeft, top: nextTop } };
      };

      const onPointerUp = () => {
        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', onPointerUp);
        handle.removeEventListener('pointercancel', onPointerUp);
      };

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);
    });
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

function starIcon(): string {
  return '<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="m8 1.8 1.72 3.48 3.84.56-2.78 2.7.66 3.82L8 10.55l-3.44 1.81.66-3.82-2.78-2.7 3.84-.56L8 1.8Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/></svg>';
}

function shieldIcon(): string {
  return '<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M8 1.75 3.75 3.3v3.34c0 2.83 1.68 5.39 4.25 6.61 2.57-1.22 4.25-3.78 4.25-6.61V3.3L8 1.75Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/><path d="m6.1 7.85 1.2 1.2 2.75-3" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] as string));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const styles = `
  #${VISIBILITY_ACTION_ROOT_ID} { display: inline-flex; position: relative; vertical-align: middle; }
  #${VISIBILITY_ACTION_ROOT_ID} * { box-sizing: border-box; }
  .gra-wrap { position: relative; display: inline-flex; gap: 6px; }
  .gra-badge { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 6px; padding: 5px 10px; background: var(--button-default-bgColor-rest, var(--bgColor-muted, #f6f8fa)); color: var(--button-default-fgColor-rest, var(--fgColor-default, #24292f)); font: 600 14px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; cursor: pointer; }
  .gra-badge:hover { background: var(--button-default-bgColor-hover, #f3f4f6); border-color: var(--borderColor-accent-emphasis, #0969da); color: var(--fgColor-accent, #0969da); }
  .gra-badge:focus-visible, .gra-close:focus-visible { outline: 3px solid color-mix(in srgb, var(--fgColor-accent, #0969da) 34%, transparent); outline-offset: 2px; }
  .gra-badge svg { width: 14px; height: 14px; flex: 0 0 auto; }
  .gra-badge strong { margin-left: 2px; border-left: 1px solid var(--borderColor-muted, #d8dee4); padding-left: 7px; font-variant-numeric: tabular-nums; }
  .gra-popover { position: fixed; z-index: 1000; width: min(980px, calc(100vw - 24px)); min-width: min(420px, calc(100vw - 24px)); min-height: 260px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); overflow: auto; resize: both; border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 18px; padding: 10px; background: var(--bgColor-default, #fff); color: var(--fgColor-default, #24292f); box-shadow: 0 20px 52px rgba(31, 35, 40, .2); font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  .gra-popover-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; border: 1px solid var(--borderColor-muted, #d8dee4); border-radius: 14px; padding: 8px 10px; background: var(--bgColor-muted, #f6f8fa); color: var(--fgColor-muted, #57606a); font-size: 12px; font-weight: 750; cursor: move; touch-action: none; user-select: none; }
  .gra-popover-bar span { display: inline-flex; align-items: center; gap: 6px; }
  .gra-popover-actions { margin-left: auto; }
  .gra-drag-hint { color: var(--fgColor-muted, #57606a); font-weight: 650; }
  .gra-popover-bar svg { display: block; width: 15px; height: 15px; color: var(--fgColor-accent, #0969da); }
  .gra-close { border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 999px; padding: 4px 10px; background: var(--button-default-bgColor-rest, var(--bgColor-default, #fff)); color: var(--fgColor-default, #24292f); font: inherit; font-weight: 750; cursor: pointer; }
  .gra-close:hover { background: var(--button-default-bgColor-hover, #f3f4f6); }
  .gra-panel-root .grv-panel { margin: 0; box-shadow: none; }
  @media (max-width: 700px) { .gra-popover { left: 8px !important; top: 8px !important; width: calc(100vw - 16px); min-width: 0; max-height: calc(100vh - 16px); } .gra-popover-bar { align-items: flex-start; flex-direction: column; } .gra-popover-actions { align-items: flex-start; margin-left: 0; } .gra-drag-hint { display: none; } }
`;
