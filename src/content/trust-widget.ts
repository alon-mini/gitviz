import type { RepositoryAuthenticityView, RepoRef } from '../background/messages';
import { emptyAuthenticity, requestAuthenticity } from './client';

export const AUTHENTICITY_ROOT_ID = 'github-repo-authenticity-inline-root';

export class TrustBreakdownWidget {
  private state: {
    authenticity?: RepositoryAuthenticityView;
    loading: boolean;
    open: boolean;
  } = { loading: false, open: false };

  constructor(private repo: RepoRef) {}

  mount(): void {
    const root = this.ensureRoot();
    if (!root) return;
    this.render(root);
  }

  private ensureRoot(): HTMLElement | null {
    const existing = document.getElementById(AUTHENTICITY_ROOT_ID);
    if (existing) return existing;

    const target = findWatchButtonTarget();
    if (!target) return null;

    const root = document.createElement(target.listItem ? 'li' : 'span');
    root.id = AUTHENTICITY_ROOT_ID;
    root.setAttribute('aria-label', 'Repository authenticity trust breakdown');
    target.element.insertAdjacentElement('afterend', root);
    return root;
  }

  private render(root: HTMLElement): void {
    const authenticity = this.state.authenticity;
    root.innerHTML = `
      <style>${styles}</style>
      <span class="gra-wrap">
        <button class="gra-badge gra-${authenticity?.tone ?? (this.state.loading ? 'loading' : 'idle')}" type="button" aria-expanded="${this.state.open}" aria-haspopup="dialog" aria-label="Repository authenticity" title="${escapeHtml(authenticity?.summary ?? 'Repository authenticity')}">
          ${shieldIcon()} Authenticity
        </button>
        ${this.state.open ? this.renderPopover(authenticity) : ''}
      </span>
    `;

    root.querySelector('.gra-badge')?.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = !this.state.open;
      this.state = { ...this.state, open };
      this.render(root);
      if (open) this.loadAuthenticity(root);
    });
  }

  private loadAuthenticity(root: HTMLElement): void {
    if (this.state.loading || this.state.authenticity) return;
    this.state = { ...this.state, loading: true };
    this.render(root);
    requestAuthenticity(this.repo).then((response) => {
      if (response.ok && response.type === 'authenticity') {
        this.state = { ...this.state, authenticity: response.data, loading: false };
      } else if (!response.ok) {
        this.state = { ...this.state, authenticity: emptyAuthenticity(this.repo, response.error), loading: false };
      }
      this.render(root);
    });
  }

  private renderPopover(authenticity: RepositoryAuthenticityView | undefined): string {
    if (!authenticity) {
      return `
        <section class="gra-popover" role="dialog" aria-label="Trust Breakdown">
          <strong>Trust Breakdown</strong>
          <p>Loading repository authenticity metrics...</p>
        </section>
      `;
    }

    return `
      <section class="gra-popover" role="dialog" aria-label="Trust Breakdown">
        <header>
          <div>
            <span class="gra-kicker">Repository Authenticity</span>
            <strong>${escapeHtml(authenticity.headline)}</strong>
            <p>${escapeHtml(authenticity.summary)}</p>
          </div>
          <span class="gra-score">${authenticity.score}<small>/100</small></span>
        </header>
        <div class="gra-grid">
          ${metric(authenticity.ratios.forkToStar, `${formatNumber(authenticity.counts.forks)} forks / ${formatNumber(authenticity.counts.stars)} stars`)}
          ${metric(authenticity.ratios.watcherToStar, `${formatNumber(authenticity.counts.watchers)} watchers / ${formatNumber(authenticity.counts.stars)} stars`)}
          ${metric(authenticity.sample.zeroFollowers, `${authenticity.sample.size}/${authenticity.sample.requested} recent stargazers`)}
          ${metric(authenticity.sample.zeroPublicRepos, `${authenticity.sample.size}/${authenticity.sample.requested} recent stargazers`)}
          ${metric(authenticity.sample.ghostAccounts, '0 followers + 0 public repos + empty bio')}
        </div>
        <div class="gra-meta">
          <span>Source: ${escapeHtml(authenticity.sample.source)}</span>
          <span>Cache: ${escapeHtml(authenticity.cacheState)}</span>
        </div>
        ${authenticity.flags.length ? `<ul>${authenticity.flags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join('')}</ul>` : '<p class="gra-muted">No suspicious thresholds crossed.</p>'}
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

function metric(check: RepositoryAuthenticityView['ratios']['forkToStar'], meta: string): string {
  return `
    <article class="gra-metric" data-flagged="${check.suspicious}">
      <span>${escapeHtml(check.label)}</span>
      <strong>${escapeHtml(check.formattedValue)}</strong>
      <small>${escapeHtml(meta)}</small>
      <em>${escapeHtml(check.threshold)}</em>
    </article>
  `;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: value >= 10_000 ? 'compact' : 'standard' }).format(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] as string));
}

function shieldIcon(): string {
  return '<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M8 1.75 3.75 3.3v3.34c0 2.83 1.68 5.39 4.25 6.61 2.57-1.22 4.25-3.78 4.25-6.61V3.3L8 1.75Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/><path d="m6.1 7.85 1.2 1.2 2.75-3" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

const styles = `
  #${AUTHENTICITY_ROOT_ID} { display: inline-flex; position: relative; vertical-align: middle; }
  #${AUTHENTICITY_ROOT_ID} * { box-sizing: border-box; }
  .gra-wrap { position: relative; display: inline-flex; }
  .gra-badge { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 6px; padding: 5px 12px; background: var(--button-default-bgColor-rest, var(--bgColor-muted, #f6f8fa)); color: var(--button-default-fgColor-rest, var(--fgColor-default, #24292f)); font: 600 14px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; cursor: pointer; }
  .gra-badge svg { width: 14px; height: 14px; }
  .gra-healthy { border-color: color-mix(in srgb, var(--fgColor-success, #1a7f37) 28%, transparent); background: var(--bgColor-success-muted, #dafbe1); color: var(--fgColor-success, #1a7f37); }
  .gra-moderate, .gra-loading, .gra-idle { border-color: color-mix(in srgb, var(--fgColor-attention, #9a6700) 28%, transparent); background: var(--bgColor-attention-muted, #fff8c5); color: var(--fgColor-attention, #9a6700); }
  .gra-suspicious { border-color: color-mix(in srgb, var(--fgColor-danger, #cf222e) 28%, transparent); background: var(--bgColor-danger-muted, #ffebe9); color: var(--fgColor-danger, #cf222e); }
  .gra-popover { position: absolute; top: calc(100% + 8px); right: 0; z-index: 1000; width: min(520px, calc(100vw - 24px)); border: 1px solid var(--borderColor-default, #d0d7de); border-radius: 14px; padding: 14px; background: var(--bgColor-default, #fff); color: var(--fgColor-default, #24292f); box-shadow: 0 16px 36px rgba(31, 35, 40, .18); font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  .gra-popover header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .gra-popover strong { display: block; font-size: 15px; }
  .gra-popover p { margin: 5px 0 0; color: var(--fgColor-muted, #57606a); }
  .gra-kicker { display: block; color: var(--fgColor-accent, #0969da); font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .gra-score { display: inline-grid; place-items: center; flex: 0 0 auto; width: 56px; height: 56px; border: 1px solid var(--borderColor-muted, #d8dee4); border-radius: 14px; font-size: 20px; font-weight: 850; }
  .gra-score small { font-size: 10px; color: var(--fgColor-muted, #57606a); }
  .gra-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .gra-metric { border: 1px solid var(--borderColor-muted, #d8dee4); border-radius: 10px; padding: 9px; background: var(--bgColor-muted, #f6f8fa); }
  .gra-metric[data-flagged="true"] { border-color: color-mix(in srgb, var(--fgColor-danger, #cf222e) 32%, transparent); background: var(--bgColor-danger-muted, #ffebe9); }
  .gra-metric span, .gra-metric small, .gra-metric em { display: block; color: var(--fgColor-muted, #57606a); font-size: 11px; font-style: normal; font-weight: 650; }
  .gra-metric strong { margin: 2px 0; font-size: 17px; font-variant-numeric: tabular-nums; }
  .gra-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; color: var(--fgColor-muted, #57606a); font-size: 11px; font-weight: 700; }
  .gra-meta span { border: 1px solid var(--borderColor-muted, #d8dee4); border-radius: 999px; padding: 2px 7px; background: var(--bgColor-muted, #f6f8fa); }
  .gra-popover ul { margin: 10px 0 0; padding-left: 18px; color: var(--fgColor-danger, #cf222e); font-weight: 650; }
  .gra-muted { color: var(--fgColor-muted, #57606a); font-size: 12px; }
  @media (max-width: 560px) { .gra-popover { right: auto; left: -120px; } .gra-grid { grid-template-columns: 1fr; } }
`;
