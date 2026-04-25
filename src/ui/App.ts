import type { RepoRef, RepoSummaryView, RepositoryAuthenticityView, StarTrendView } from '../background/messages';
import { emptyAuthenticity, requestAuthenticity, requestStars, requestSummary } from '../content/client';
import { renderSparkline } from './components/Sparkline';

export type AppState = {
  repo: RepoRef;
  summary?: RepoSummaryView;
  stars?: StarTrendView;
  authenticity?: RepositoryAuthenticityView;
  loading: boolean;
  authenticityLoading: boolean;
  starLoading: boolean;
  expanded: boolean;
  error?: string;
};

export class App {
  private state: AppState;

  constructor(private root: HTMLElement, repo: RepoRef) {
    this.state = { repo, loading: true, authenticityLoading: false, starLoading: false, expanded: false };
  }

  start(): void {
    this.render();
    requestSummary(this.state.repo).then((response) => {
      if (response.ok) {
        if (response.type === 'summary') {
          this.state = { ...this.state, summary: response.data, loading: false, error: undefined };
        }
      } else {
        this.state = { ...this.state, loading: false, error: response.error };
      }
      this.render();
    });
    this.loadAuthenticity();
  }

  private loadAuthenticity(): void {
    if (this.state.authenticityLoading || this.state.authenticity) return;
    this.state = { ...this.state, authenticityLoading: true };
    requestAuthenticity(this.state.repo).then((response) => {
      if (response.ok && response.type === 'authenticity') {
        this.state = { ...this.state, authenticity: response.data, authenticityLoading: false };
      } else if (!response.ok) {
        this.state = { ...this.state, authenticity: emptyAuthenticity(this.state.repo, response.error), authenticityLoading: false };
      }
      this.render();
    });
  }

  private loadStars(): void {
    if (this.state.starLoading || this.state.stars) return;
    this.state = { ...this.state, starLoading: true };
    this.render();
    requestStars(this.state.repo).then((response) => {
      if (response.ok) {
        if (response.type === 'stars') {
          this.state = { ...this.state, stars: response.data, starLoading: false };
        }
      } else {
        this.state = {
          ...this.state,
          starLoading: false,
          stars: {
            repo: this.state.repo,
            generatedAt: new Date().toISOString(),
            days: 90,
            quality: 'unavailable',
            totalInWindow: 0,
            buckets: [],
            pagesLoaded: 0,
            message: response.error
          }
        };
      }
      this.render();
    });
  }

  private toggleExpanded(): void {
    const expanded = !this.state.expanded;
    this.state = { ...this.state, expanded };
    this.render();
    if (expanded) this.loadStars();
  }

  private render(): void {
    const summary = this.state.summary;
    const repoName = summary?.fullName ?? `${this.state.repo.owner}/${this.state.repo.repo}`;
    this.root.innerHTML = `
      <style>${styles}</style>
      <article class="grv-panel" data-state="${this.state.loading ? 'loading' : 'ready'}">
        <header class="grv-header">
          <div class="grv-brand">
            <span class="grv-logo" aria-hidden="true">${visibilityIcon()}</span>
            <div class="grv-title-stack">
              <p class="grv-eyebrow">Repository visibility</p>
              <h2>${escapeHtml(repoName)}</h2>
              <p class="grv-subtitle">Live GitHub signals summarized for quick repository triage.</p>
              <div class="grv-header-meta" aria-label="Data source and privacy details">
                <span>${sourceIcon()} Public GitHub API</span>
                <span>${shieldIcon()} Anonymous request budget</span>
              </div>
            </div>
          </div>
          <div class="grv-header-actions">
            ${summary ? statusChip(cacheLabel(summary.cacheState), summary.cacheState === 'fresh' ? 'success' : summary.cacheState === 'stale' ? 'warning' : 'neutral') : ''}
            ${this.renderAuthenticityHeaderBadge()}
            <button class="grv-toggle" type="button" aria-expanded="${this.state.expanded}">
              <span>${this.state.expanded ? 'Hide details' : 'Show details'}</span>
              <span class="grv-toggle-icon" aria-hidden="true">${chevronIcon()}</span>
            </button>
          </div>
        </header>
        ${summary ? this.renderOverview(summary) : ''}
        ${this.renderBody()}
      </article>
    `;

    this.root.querySelector('.grv-toggle')?.addEventListener('click', () => this.toggleExpanded());
  }

  private renderOverview(summary: RepoSummaryView): string {
    const score = summary.community.healthPercentage ?? 0;
    return `
      <section class="grv-overview" aria-label="Repository visibility overview">
        <div class="grv-overview-copy">
          <p class="grv-kicker">Visibility snapshot</p>
          <h3>${escapeHtml(visibilityHeadline(summary))}</h3>
          <p>${escapeHtml(visibilityCopy(summary))}</p>
        </div>
        <div class="grv-score-card" aria-label="Community trust score ${escapeHtml(communityText(summary))}">
          <div class="grv-score-ring" style="--grv-score: ${score}" aria-hidden="true">
            <span>${escapeHtml(communityText(summary))}</span>
          </div>
          <div>
            <strong>Trust baseline</strong>
            <p>${escapeHtml(summary.community.reason ?? 'Community profile health from public repository files.')}</p>
          </div>
        </div>
        <div class="grv-overview-stats" aria-label="Key repository signals">
          ${signalPill('Interest', formatNumber(summary.stars), 'stars')}
          ${signalPill('Commit signal', summary.activity.headline, summary.activity.quality)}
          ${signalPill('Trust score', communityText(summary), summary.community.quality)}
        </div>
      </section>
    `;
  }

  private renderBody(): string {
    if (this.state.loading) {
      return `
        <div class="grv-loading" role="status" aria-live="polite">
          <span class="grv-spinner" aria-hidden="true"></span>
          <span>Loading repository signals...</span>
        </div>
        <div class="grv-grid grv-grid-skeleton" aria-hidden="true">
          ${Array.from({ length: 6 }, () => '<div class="grv-skeleton-card"><span></span><strong></strong></div>').join('')}
        </div>
      `;
    }

    if (this.state.error && !this.state.summary) {
      return `<div class="grv-content"><div class="grv-notice grv-notice-error" role="alert">${escapeHtml(this.state.error)}</div></div>`;
    }

    const summary = this.state.summary;
    if (!summary) return '';

    return `
      <div class="grv-content">
        <div class="grv-summary-row">
          <div>
            <p class="grv-kicker">Repository context</p>
            ${summary.description ? `<p class="grv-description">${escapeHtml(summary.description)}</p>` : '<p class="grv-description grv-muted">No repository description available.</p>'}
          </div>
          ${this.renderBadges(summary)}
        </div>
        <section class="grv-grid" aria-label="Repository summary metrics">
          ${metric('Stars', formatNumber(summary.stars), 'Exact public stargazer count.', 'Public interest')}
          ${metric('Forks', formatNumber(summary.forks), 'Exact public fork count.', 'Reuse signal')}
          ${metric('Watchers', formatNumber(summary.watchers), 'Uses subscribers_count, not watchers_count, so it reflects true watchers.', 'Subscriber count')}
          ${metric('Last push', formatRelativeDays(summary.pushedDaysAgo), 'From repository pushed_at.', 'Maintenance recency')}
          ${metric('Release', releaseText(summary), 'Latest release endpoint; no releases is a normal state.', 'Versioning signal')}
          ${metric('Community', communityText(summary), summary.community.reason ?? 'GitHub community profile health percentage.', 'Trust baseline')}
        </section>
        <div class="grv-section-stack">
          ${this.renderAuthenticitySection()}
          <section class="grv-section grv-section-featured" aria-label="Activity snapshot">
            ${sectionHeader('Activity', summary.activity.quality, summary.activity.reason)}
            <p class="grv-section-copy">${escapeHtml(summary.activity.headline)}</p>
            ${summary.activity.weeks.length ? `<div class="grv-chart-card">${renderSparkline(summary.activity.weeks, '52-week commit sparkline')}</div>` : ''}
            <p class="grv-muted">Last 4 weeks: ${summary.activity.lastFourWeeksCommits ?? 'Unavailable'} commits</p>
          </section>
          <section class="grv-section" aria-label="Responsiveness snapshot">
            ${sectionHeader('Responsiveness', summary.responsiveness.quality)}
            <div class="grv-grid grv-grid-small">
              ${metric('Merged PRs', `${summary.responsiveness.mergedPrCount}/${summary.responsiveness.prSampleSize}`, 'Recent closed pull request sample.', 'Recent sample')}
              ${metric('Median merge', formatDurationHours(summary.responsiveness.medianMergeHours), 'Median created-to-merged time for recently merged PRs.', 'Created to merged')}
              ${metric('Closed issues', `${summary.responsiveness.closedIssueCount}/${summary.responsiveness.issueSampleSize}`, 'Recent closed issue sample, excluding pull requests.', 'Issue sample')}
            </div>
          </section>
          ${this.renderExpanded(summary)}
          ${this.renderNotices(summary)}
        </div>
      </div>
    `;
  }

  private renderAuthenticityHeaderBadge(): string {
    const authenticity = this.state.authenticity;
    if (!authenticity) return `<span class="grv-trust-badge grv-trust-loading" role="status">${shieldIcon()} Trust scan</span>`;
    return `<span class="grv-trust-badge grv-trust-${authenticity.tone}" title="${escapeHtml(authenticity.summary)}">${shieldIcon()} ${escapeHtml(trustBadgeLabel(authenticity))}</span>`;
  }

  private renderAuthenticitySection(): string {
    const authenticity = this.state.authenticity;
    if (!authenticity) {
      return `
        <section class="grv-section grv-trust-section" aria-label="Repository authenticity trust breakdown">
          ${sectionHeader('Trust Breakdown', this.state.authenticityLoading ? 'loading' : 'unavailable')}
          <p class="grv-section-copy">Loading authenticity ratios and recent stargazer account sample...</p>
        </section>
      `;
    }

    return `
      <section class="grv-section grv-trust-section grv-trust-section-${authenticity.tone}" aria-label="Repository authenticity trust breakdown">
        <div class="grv-trust-head">
          <div>
            <p class="grv-kicker">Repository Authenticity</p>
            <h3>${escapeHtml(authenticity.headline)}</h3>
            <p>${escapeHtml(authenticity.summary)}</p>
          </div>
          <div class="grv-trust-score" aria-label="Authenticity score ${authenticity.score} out of 100">
            <span>${authenticity.score}</span>
            <small>/100</small>
          </div>
        </div>
        <details class="grv-trust-details">
          <summary>
            <span>${shieldIcon()} Trust Breakdown</span>
            ${statusChip(trustToneLabel(authenticity.tone), trustChipTone(authenticity.tone))}
          </summary>
          <div class="grv-trust-grid">
            ${authenticityMetric(authenticity.ratios.forkToStar, `${formatNumber(authenticity.counts.forks)} forks / ${formatNumber(authenticity.counts.stars)} stars`)}
            ${authenticityMetric(authenticity.ratios.watcherToStar, `${formatNumber(authenticity.counts.watchers)} watchers / ${formatNumber(authenticity.counts.stars)} stars`)}
            ${authenticityMetric(authenticity.sample.zeroFollowers, `${authenticity.sample.size}/${authenticity.sample.requested} sampled accounts loaded`)}
            ${authenticityMetric(authenticity.sample.zeroPublicRepos, `${authenticity.sample.size}/${authenticity.sample.requested} sampled accounts loaded`)}
            ${authenticityMetric(authenticity.sample.ghostAccounts, `0 followers + 0 public repos + empty bio`)}
          </div>
          <div class="grv-trust-meta">
            <span>Sample source: ${escapeHtml(authenticity.sample.source)}</span>
            <span>Cache: ${escapeHtml(cacheLabel(authenticity.cacheState))}</span>
            <span>Generated: ${escapeHtml(formatDateTime(authenticity.generatedAt))}</span>
          </div>
          ${authenticity.flags.length ? `<ul class="grv-trust-flags">${authenticity.flags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join('')}</ul>` : '<p class="grv-muted">No authenticity flags crossed the suspicious thresholds.</p>'}
          ${authenticity.notices.length ? `<div class="grv-notices">${authenticity.notices.map((notice) => `<p class="grv-notice grv-notice-${notice.kind}" role="${notice.kind === 'error' || notice.kind === 'rate_limited' ? 'alert' : 'status'}">${escapeHtml(notice.message)}</p>`).join('')}</div>` : ''}
        </details>
      </section>
    `;
  }

  private renderBadges(summary: RepoSummaryView): string {
    const badges = [
      summary.archived ? { label: 'Archived', tone: 'warning' } : null,
      summary.fork ? { label: 'Fork', tone: 'neutral' } : null,
      { label: summary.license ? `License: ${summary.license}` : 'No license detected', tone: summary.license ? 'success' : 'warning' },
      summary.topics.length ? { label: `${summary.topics.length} topics`, tone: 'neutral' } : null
    ].filter((badge): badge is { label: string; tone: ChipTone } => Boolean(badge));
    return `<div class="grv-badges" aria-label="Repository attributes">${badges.map((badge) => statusChip(badge.label, badge.tone)).join('')}</div>`;
  }

  private renderExpanded(summary: RepoSummaryView): string {
    if (!this.state.expanded) return '';
    const stars = this.state.stars;
    return `
      <section class="grv-section" aria-label="Stars trend">
        ${sectionHeader('Stars', this.state.starLoading ? 'loading' : stars?.quality ?? 'lazy')}
        ${this.state.starLoading ? '<p class="grv-section-copy">Loading recent star trend...</p>' : ''}
        ${stars ? `<p class="grv-section-copy">${formatNumber(stars.totalInWindow)} stars in ${stars.days} days (${stars.quality}; ${stars.pagesLoaded} pages loaded).</p><div class="grv-chart-card">${renderSparkline(stars.buckets.map((bucket) => bucket.count), 'Recent daily star trend')}</div>${stars.message ? `<p class="grv-muted">${escapeHtml(stars.message)}</p>` : ''}` : '<p class="grv-muted">Star trend loads only after expansion to preserve the anonymous request budget.</p>'}
      </section>
      <section class="grv-section" aria-label="Community files">
        ${sectionHeader('Trust signals', summary.community.quality, summary.community.reason)}
        <ul class="grv-files">
          ${summary.community.files.map((file) => `<li><span class="grv-file-status" data-present="${file.present}" aria-label="${file.present ? 'Present' : 'Missing'}"></span><span>${escapeHtml(file.label)}</span></li>`).join('')}
        </ul>
      </section>
    `;
  }

  private renderNotices(summary: RepoSummaryView): string {
    if (!summary.notices.length) return '';
    return `<div class="grv-notices" aria-label="Repository visibility notices">${summary.notices.map((notice) => `<p class="grv-notice grv-notice-${notice.kind}" role="${notice.kind === 'error' || notice.kind === 'rate_limited' ? 'alert' : 'status'}">${escapeHtml(notice.message)}</p>`).join('')}</div>`;
  }
}

type ChipTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

function authenticityMetric(check: RepositoryAuthenticityView['ratios']['forkToStar'], meta: string): string {
  return `
    <article class="grv-trust-metric" data-flagged="${check.suspicious}">
      <span>${escapeHtml(check.label)}</span>
      <strong>${escapeHtml(check.formattedValue)}</strong>
      <small>${escapeHtml(meta)}</small>
      <em>${escapeHtml(check.threshold)}</em>
    </article>
  `;
}

function trustBadgeLabel(authenticity: RepositoryAuthenticityView): string {
  if (authenticity.tone === 'suspicious') return 'Trust: suspicious';
  if (authenticity.tone === 'moderate') return 'Trust: mixed';
  return 'Trust: healthy';
}

function trustToneLabel(tone: RepositoryAuthenticityView['tone']): string {
  if (tone === 'suspicious') return 'Highly suspicious';
  if (tone === 'moderate') return 'Moderate';
  return 'Healthy';
}

function trustChipTone(tone: RepositoryAuthenticityView['tone']): ChipTone {
  if (tone === 'suspicious') return 'danger';
  if (tone === 'moderate') return 'warning';
  return 'success';
}

function metric(label: string, value: string, tooltip: string, meta?: string): string {
  return `
    <article class="grv-metric" title="${escapeHtml(tooltip)}" aria-label="${escapeHtml(label)}: ${escapeHtml(value)}">
      <div class="grv-metric-top">
        <span class="grv-metric-icon" aria-hidden="true">${metricIcon(label)}</span>
        <span class="grv-metric-label">${escapeHtml(label)}</span>
      </div>
      <strong>${escapeHtml(value)}</strong>
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
    </article>
  `;
}

function signalPill(label: string, value: string, meta: string): string {
  return `
    <article class="grv-signal-pill">
      <span class="grv-signal-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(meta)}</small>
    </article>
  `;
}

function sectionHeader(title: string, quality: string, reason?: string): string {
  return `
    <div class="grv-section-title">
      <strong>${escapeHtml(title)}</strong>
      ${statusChip(quality, qualityTone(quality), reason)}
    </div>
  `;
}

function statusChip(label: string, tone: ChipTone = 'neutral', title?: string): string {
  return `<span class="grv-chip grv-chip-${tone}"${title ? ` title="${escapeHtml(title)}"` : ''}><span class="grv-chip-dot" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

function qualityTone(quality: string): ChipTone {
  if (quality === 'exact') return 'success';
  if (quality === 'sampled' || quality === 'loading' || quality === 'lazy') return 'info';
  if (quality === 'partial') return 'warning';
  if (quality === 'unavailable') return 'danger';
  return 'neutral';
}

function cacheLabel(cacheState: RepoSummaryView['cacheState']): string {
  if (cacheState === 'fresh') return 'Fresh data';
  if (cacheState === 'stale') return 'Refreshing';
  return 'New scan';
}

function releaseText(summary: RepoSummaryView): string {
  if (summary.latestRelease.status === 'none') return 'No releases';
  if (summary.latestRelease.status === 'unavailable') return 'Unavailable';
  return formatRelativeDays(summary.latestRelease.daysAgo);
}

function visibilityHeadline(summary: RepoSummaryView): string {
  if (summary.archived) return 'Archived repository with historical signals';
  if (summary.activity.status === 'preparing') return 'GitHub is preparing activity data';
  if (summary.activity.status === 'limited') return 'Activity signal is partially available';
  if (summary.pushedDaysAgo !== null && summary.pushedDaysAgo <= 30) return 'Recently maintained and discoverable';
  if (summary.community.healthPercentage !== null && summary.community.healthPercentage >= 70) return 'Strong community trust signals';
  return 'Repository signals need a closer look';
}

function visibilityCopy(summary: RepoSummaryView): string {
  const recency = formatRelativeDays(summary.pushedDaysAgo, 'push recency unavailable');
  const release = releaseText(summary).toLowerCase();
  return `${formatNumber(summary.stars)} stars, last push ${recency}, release ${release}. Community profile is ${communityText(summary).toLowerCase()}.`;
}

function formatRelativeDays(days: number | null, empty = 'Unavailable'): string {
  if (days === null) return empty;
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function formatDurationHours(hours: number | null): string {
  if (hours === null) return 'Unavailable';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} hr`;
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)} days`;
}

function communityText(summary: RepoSummaryView): string {
  if (summary.community.healthPercentage === null) return 'Unavailable';
  return `${summary.community.healthPercentage}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: value >= 10_000 ? 'compact' : 'standard' }).format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] as string));
}

function visibilityIcon(): string {
  return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M2.25 12s3.5-6.25 9.75-6.25S21.75 12 21.75 12s-3.5 6.25-9.75 6.25S2.25 12 2.25 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.75" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
}

function chevronIcon(): string {
  return '<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M4.5 6.25 8 9.75l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function sourceIcon(): string {
  return '<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M2.75 5.25h10.5M5.25 2.75h5.5m-6 10.5h6.5a2 2 0 0 0 2-2v-5.5a1 1 0 0 0-1-1h-8.5a1 1 0 0 0-1 1v5.5a2 2 0 0 0 2 2Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function shieldIcon(): string {
  return '<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M8 1.75 3.75 3.3v3.34c0 2.83 1.68 5.39 4.25 6.61 2.57-1.22 4.25-3.78 4.25-6.61V3.3L8 1.75Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/><path d="m6.1 7.85 1.2 1.2 2.75-3" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function metricIcon(label: string): string {
  const icons: Record<string, string> = {
    Stars: '<svg viewBox="0 0 16 16" focusable="false"><path d="m8 1.8 1.72 3.48 3.84.56-2.78 2.7.66 3.82L8 10.55l-3.44 1.81.66-3.82-2.78-2.7 3.84-.56L8 1.8Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/></svg>',
    Forks: '<svg viewBox="0 0 16 16" focusable="false"><path d="M5 3.25a1.75 1.75 0 1 1-2.2 1.68A1.75 1.75 0 0 1 5 3.25Zm6 0a1.75 1.75 0 1 1-1.75 1.75A1.75 1.75 0 0 1 11 3.25ZM5 12.75a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Zm0-3.5V6.75m6-1.75v1.5A2.5 2.5 0 0 1 8.5 9H5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    Watchers: visibilityIcon(),
    Community: shieldIcon(),
    Release: '<svg viewBox="0 0 16 16" focusable="false"><path d="M4.25 2.75h5.7l1.8 1.8v8.7h-7.5a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/><path d="M9.75 2.9v1.85h1.85M5.25 8h5.5M5.25 10.5h3.5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'Last push': '<svg viewBox="0 0 16 16" focusable="false"><path d="M8 2.25a5.75 5.75 0 1 0 5.75 5.75A5.75 5.75 0 0 0 8 2.25Zm0 2.5V8l2.15 1.25" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'Merged PRs': '<svg viewBox="0 0 16 16" focusable="false"><path d="M4.75 3.25v6.5a2.5 2.5 0 0 0 2.5 2.5h4m0 0-1.75-1.75m1.75 1.75L9.5 14M11.25 3.25v4.5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/><circle cx="4.75" cy="3.25" r="1.5" fill="none" stroke="currentColor" stroke-width="1.35"/><circle cx="11.25" cy="3.25" r="1.5" fill="none" stroke="currentColor" stroke-width="1.35"/></svg>',
    'Median merge': '<svg viewBox="0 0 16 16" focusable="false"><path d="M2.75 11.5h10.5M4.25 8.25h7.5M5.75 5h4.5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/><path d="M8 2.75v10.5" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>',
    'Closed issues': '<svg viewBox="0 0 16 16" focusable="false"><circle cx="8" cy="8" r="5.75" fill="none" stroke="currentColor" stroke-width="1.35"/><path d="m5.8 8.15 1.45 1.45 3.1-3.35" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'Ghost accounts': shieldIcon()
  };
  return icons[label] ?? sourceIcon();
}

const styles = `
  .grv-panel {
    --grv-accent: var(--fgColor-accent, #0969da);
    --grv-accent-emphasis: var(--bgColor-accent-emphasis, #0969da);
    --grv-accent-soft: var(--bgColor-accent-muted, #ddf4ff);
    --grv-border: var(--borderColor-muted, #d8dee4);
    --grv-border-strong: var(--borderColor-default, #d0d7de);
    --grv-surface: var(--bgColor-default, #ffffff);
    --grv-surface-muted: var(--bgColor-muted, #f6f8fa);
    --grv-surface-inset: var(--bgColor-inset, #f6f8fa);
    --grv-text: var(--fgColor-default, #24292f);
    --grv-text-muted: var(--fgColor-muted, #57606a);
    --grv-success: var(--fgColor-success, #1a7f37);
    --grv-success-soft: var(--bgColor-success-muted, #dafbe1);
    --grv-warning: var(--fgColor-attention, #9a6700);
    --grv-warning-soft: var(--bgColor-attention-muted, #fff8c5);
    --grv-danger: var(--fgColor-danger, #cf222e);
    --grv-danger-soft: var(--bgColor-danger-muted, #ffebe9);
    --grv-info-soft: color-mix(in srgb, var(--grv-accent-soft) 68%, var(--grv-surface));
    --grv-radius-lg: 20px;
    --grv-radius-md: 15px;
    --grv-radius-sm: 12px;
    --grv-shadow-sm: 0 1px 0 rgba(31, 35, 40, .05);
    --grv-shadow-md: 0 14px 34px rgba(31, 35, 40, .09), 0 1px 0 rgba(255, 255, 255, .55) inset;
    --grv-shadow-lg: 0 20px 48px rgba(31, 35, 40, .13), 0 1px 0 rgba(255, 255, 255, .58) inset;
    position: relative;
    isolation: isolate;
    margin: 16px 0;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--grv-border-strong) 86%, transparent);
    border-radius: var(--grv-radius-lg);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--grv-surface) 96%, var(--grv-accent-soft)) 0%, var(--grv-surface) 46%),
      var(--grv-surface);
    color: var(--grv-text);
    box-shadow: var(--grv-shadow-lg);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  .grv-panel::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 170px;
    z-index: -1;
    background:
      radial-gradient(circle at 12% -12%, color-mix(in srgb, var(--grv-accent-soft) 96%, transparent) 0, transparent 34%),
      radial-gradient(circle at 94% 0%, color-mix(in srgb, var(--grv-success-soft) 62%, transparent) 0, transparent 28%);
  }
  .grv-panel * { box-sizing: border-box; }
  .grv-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 20px 20px 14px;
  }
  .grv-brand { display: flex; align-items: flex-start; gap: 13px; min-width: 0; }
  .grv-logo {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    width: 46px;
    height: 46px;
    border: 1px solid color-mix(in srgb, var(--grv-accent) 26%, transparent);
    border-radius: 16px;
    background:
      linear-gradient(145deg, color-mix(in srgb, var(--grv-surface) 72%, var(--grv-accent-soft)), var(--grv-surface));
    color: var(--grv-accent);
    box-shadow: 0 12px 26px color-mix(in srgb, var(--grv-accent) 15%, transparent);
  }
  .grv-logo svg, .grv-toggle-icon svg { display: block; width: 21px; height: 21px; }
  .grv-title-stack { min-width: 0; }
  .grv-header h2 { margin: 0; font-size: 19px; line-height: 1.22; font-weight: 750; overflow-wrap: anywhere; letter-spacing: -.015em; }
  .grv-eyebrow, .grv-kicker { margin: 0 0 4px; color: var(--grv-accent); font-size: 11px; font-weight: 750; text-transform: uppercase; letter-spacing: .13em; }
  .grv-subtitle { margin: 5px 0 0; max-width: 58ch; color: var(--grv-text-muted); font-size: 13px; }
  .grv-header-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; color: var(--grv-text-muted); font-size: 12px; font-weight: 650; }
  .grv-header-meta span { display: inline-flex; align-items: center; gap: 5px; min-height: 24px; border: 1px solid color-mix(in srgb, var(--grv-border) 74%, transparent); border-radius: 999px; padding: 2px 8px; background: color-mix(in srgb, var(--grv-surface) 76%, transparent); }
  .grv-header-meta svg { display: block; width: 14px; height: 14px; color: var(--grv-accent); }
  .grv-header-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
  .grv-trust-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    border: 1px solid var(--grv-border-strong);
    border-radius: 999px;
    padding: 4px 10px;
    background: var(--grv-surface-muted);
    color: var(--grv-text-muted);
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }
  .grv-trust-badge svg { display: block; width: 15px; height: 15px; }
  .grv-trust-healthy { border-color: color-mix(in srgb, var(--grv-success) 26%, transparent); background: var(--grv-success-soft); color: var(--grv-success); }
  .grv-trust-moderate, .grv-trust-loading { border-color: color-mix(in srgb, var(--grv-warning) 26%, transparent); background: var(--grv-warning-soft); color: var(--grv-warning); }
  .grv-trust-suspicious { border-color: color-mix(in srgb, var(--grv-danger) 26%, transparent); background: var(--grv-danger-soft); color: var(--grv-danger); }
  .grv-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    border: 1px solid var(--grv-border-strong);
    border-radius: 999px;
    padding: 8px 14px;
    background: color-mix(in srgb, var(--grv-surface) 86%, var(--grv-surface-muted));
    color: inherit;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
    transition: background-color .18s ease, border-color .18s ease, box-shadow .18s ease, transform .18s ease;
  }
  .grv-toggle:hover { background: var(--button-default-bgColor-hover, #f3f4f6); border-color: color-mix(in srgb, var(--grv-accent) 36%, var(--grv-border-strong)); box-shadow: 0 8px 18px rgba(31, 35, 40, .09); }
  .grv-toggle:active { transform: translateY(1px) scale(.99); }
  .grv-toggle:focus-visible { outline: 3px solid color-mix(in srgb, var(--grv-accent) 34%, transparent); outline-offset: 2px; }
  .grv-toggle[aria-expanded="true"] .grv-toggle-icon { transform: rotate(180deg); }
  .grv-toggle-icon { display: inline-grid; place-items: center; transition: transform .18s ease; }
  .grv-overview {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(210px, .55fr);
    gap: 12px;
    margin: 0 20px 4px;
    border: 1px solid color-mix(in srgb, var(--grv-accent) 18%, var(--grv-border));
    border-radius: var(--grv-radius-lg);
    padding: 14px;
    background: color-mix(in srgb, var(--grv-surface) 84%, var(--grv-accent-soft));
    box-shadow: var(--grv-shadow-sm);
  }
  .grv-overview-copy h3 { margin: 0; font-size: 19px; line-height: 1.25; letter-spacing: -.012em; }
  .grv-overview-copy p:last-child { margin: 7px 0 0; max-width: 72ch; color: var(--grv-text-muted); }
  .grv-score-card { display: flex; align-items: center; gap: 12px; min-width: 0; border: 1px solid color-mix(in srgb, var(--grv-border) 72%, transparent); border-radius: var(--grv-radius-md); padding: 12px; background: color-mix(in srgb, var(--grv-surface) 90%, transparent); }
  .grv-score-card strong { display: block; font-size: 13px; }
  .grv-score-card p { margin: 3px 0 0; color: var(--grv-text-muted); font-size: 12px; line-height: 1.35; }
  .grv-score-ring { display: inline-grid; place-items: center; flex: 0 0 auto; width: 58px; height: 58px; border-radius: 999px; background: conic-gradient(var(--grv-success) calc(var(--grv-score) * 1%), color-mix(in srgb, var(--grv-border) 58%, transparent) 0); }
  .grv-score-ring::before { content: ""; grid-area: 1 / 1; width: 44px; height: 44px; border-radius: inherit; background: var(--grv-surface); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--grv-border) 60%, transparent); }
  .grv-score-ring span { grid-area: 1 / 1; z-index: 1; color: var(--grv-text); font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .grv-overview-stats { display: grid; grid-column: 1 / -1; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .grv-signal-pill {
    min-width: 0;
    border: 1px solid color-mix(in srgb, var(--grv-border) 78%, transparent);
    border-radius: 13px;
    padding: 10px;
    background: color-mix(in srgb, var(--grv-surface) 92%, transparent);
    box-shadow: var(--grv-shadow-sm);
  }
  .grv-signal-pill span, .grv-signal-pill small, .grv-metric small { display: block; color: var(--grv-text-muted); font-size: 11px; font-weight: 650; }
  .grv-signal-pill strong { display: block; margin-top: 2px; font-size: 14px; line-height: 1.25; overflow-wrap: anywhere; }
  .grv-signal-pill small, .grv-metric small { margin-top: 5px; }
  .grv-content { padding: 14px 20px 20px; }
  .grv-summary-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
  .grv-description { margin: 0; max-width: 82ch; color: var(--grv-text); }
  .grv-badges { display: flex; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; gap: 6px; max-width: 45%; }
  .grv-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; border: 1px solid transparent; border-radius: 999px; padding: 3px 9px; background: color-mix(in srgb, var(--grv-surface-muted) 86%, var(--grv-surface)); color: var(--grv-text-muted); font-size: 12px; font-weight: 700; line-height: 1.35; white-space: nowrap; }
  .grv-chip-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; opacity: .72; }
  .grv-chip-success { border-color: color-mix(in srgb, var(--grv-success) 24%, transparent); background: var(--grv-success-soft); color: var(--grv-success); }
  .grv-chip-warning { border-color: color-mix(in srgb, var(--grv-warning) 24%, transparent); background: var(--grv-warning-soft); color: var(--grv-warning); }
  .grv-chip-danger { border-color: color-mix(in srgb, var(--grv-danger) 24%, transparent); background: var(--grv-danger-soft); color: var(--grv-danger); }
  .grv-chip-info { border-color: color-mix(in srgb, var(--grv-accent) 22%, transparent); background: var(--grv-accent-soft); color: var(--grv-accent); }
  .grv-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin: 0; }
  .grv-grid-small { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 12px; }
  .grv-metric { min-width: 0; border: 1px solid var(--grv-border); border-radius: var(--grv-radius-md); padding: 12px; background: color-mix(in srgb, var(--grv-surface) 92%, var(--grv-surface-muted)); box-shadow: var(--grv-shadow-sm); transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
  .grv-metric:hover { border-color: color-mix(in srgb, var(--grv-accent) 30%, var(--grv-border)); box-shadow: var(--grv-shadow-md); transform: translateY(-1px); }
  .grv-metric-top { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .grv-metric-icon { display: inline-grid; place-items: center; flex: 0 0 auto; width: 22px; height: 22px; border-radius: 8px; background: var(--grv-info-soft); color: var(--grv-accent); }
  .grv-metric-icon svg { display: block; width: 14px; height: 14px; }
  .grv-metric-label { display: block; color: var(--grv-text-muted); font-size: 12px; font-weight: 700; overflow-wrap: anywhere; }
  .grv-metric strong { display: block; margin-top: 8px; font-size: 19px; line-height: 1.15; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; letter-spacing: -.012em; }
  .grv-section-stack { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
  .grv-section { border: 1px solid var(--grv-border); border-radius: var(--grv-radius-md); padding: 14px; background: color-mix(in srgb, var(--grv-surface) 94%, var(--grv-surface-muted)); box-shadow: var(--grv-shadow-sm); }
  .grv-trust-section { grid-column: 1 / -1; border-color: color-mix(in srgb, var(--grv-accent) 18%, var(--grv-border)); }
  .grv-trust-section-healthy { border-color: color-mix(in srgb, var(--grv-success) 28%, var(--grv-border)); background: color-mix(in srgb, var(--grv-surface) 90%, var(--grv-success-soft)); }
  .grv-trust-section-moderate { border-color: color-mix(in srgb, var(--grv-warning) 28%, var(--grv-border)); background: color-mix(in srgb, var(--grv-surface) 90%, var(--grv-warning-soft)); }
  .grv-trust-section-suspicious { border-color: color-mix(in srgb, var(--grv-danger) 28%, var(--grv-border)); background: color-mix(in srgb, var(--grv-surface) 90%, var(--grv-danger-soft)); }
  .grv-trust-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
  .grv-trust-head h3 { margin: 0; font-size: 18px; line-height: 1.24; letter-spacing: -.012em; }
  .grv-trust-head p:not(.grv-kicker) { margin: 6px 0 0; color: var(--grv-text-muted); }
  .grv-trust-score { display: inline-grid; place-items: center; flex: 0 0 auto; width: 70px; height: 70px; border: 1px solid color-mix(in srgb, currentColor 26%, transparent); border-radius: 18px; background: color-mix(in srgb, var(--grv-surface) 88%, transparent); color: inherit; box-shadow: var(--grv-shadow-sm); }
  .grv-trust-score span { font-size: 24px; line-height: 1; font-weight: 850; font-variant-numeric: tabular-nums; }
  .grv-trust-score small { margin-top: -8px; color: var(--grv-text-muted); font-size: 11px; font-weight: 800; }
  .grv-trust-details { border: 1px solid color-mix(in srgb, var(--grv-border) 72%, transparent); border-radius: 13px; background: color-mix(in srgb, var(--grv-surface) 86%, transparent); }
  .grv-trust-details summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; cursor: pointer; font-weight: 800; list-style: none; }
  .grv-trust-details summary::-webkit-details-marker { display: none; }
  .grv-trust-details summary > span { display: inline-flex; align-items: center; gap: 7px; }
  .grv-trust-details summary svg { display: block; width: 16px; height: 16px; }
  .grv-trust-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; padding: 0 12px 12px; }
  .grv-trust-metric { min-width: 0; border: 1px solid var(--grv-border); border-radius: 12px; padding: 10px; background: var(--grv-surface); }
  .grv-trust-metric[data-flagged="true"] { border-color: color-mix(in srgb, var(--grv-danger) 34%, transparent); background: var(--grv-danger-soft); }
  .grv-trust-metric span, .grv-trust-metric small, .grv-trust-metric em { display: block; color: var(--grv-text-muted); font-size: 11px; font-style: normal; font-weight: 700; }
  .grv-trust-metric strong { display: block; margin: 4px 0; font-size: 18px; font-variant-numeric: tabular-nums; }
  .grv-trust-meta { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 12px 12px; color: var(--grv-text-muted); font-size: 11px; font-weight: 700; }
  .grv-trust-meta span { border: 1px solid color-mix(in srgb, var(--grv-border) 74%, transparent); border-radius: 999px; padding: 3px 8px; background: var(--grv-surface); }
  .grv-trust-flags { margin: 0 12px 12px; padding-left: 20px; color: var(--grv-danger); font-weight: 650; }
  .grv-section-featured { border-color: color-mix(in srgb, var(--grv-accent) 20%, var(--grv-border)); background: color-mix(in srgb, var(--grv-surface) 88%, var(--grv-accent-soft)); }
  .grv-section-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
  .grv-section-title strong { font-size: 14px; }
  .grv-section-copy { margin: 0 0 10px; color: var(--grv-text); }
  .grv-muted { color: var(--grv-text-muted); font-size: 12px; }
  .grv-chart-card { margin-top: 10px; border: 1px solid color-mix(in srgb, var(--grv-border) 74%, transparent); border-radius: 12px; padding: 10px; background: var(--grv-surface-inset); }
  .grv-sparkline { display: block; width: 100%; height: 46px; color: var(--grv-accent); }
  .grv-notices { display: grid; grid-column: 1 / -1; gap: 8px; }
  .grv-notice { margin: 0; border: 1px solid var(--grv-border); border-radius: 12px; padding: 10px 12px; background: var(--grv-surface-muted); color: var(--grv-text); }
  .grv-notice-error, .grv-notice-rate_limited { border-color: color-mix(in srgb, var(--grv-danger) 28%, transparent); background: var(--grv-danger-soft); color: var(--grv-danger); }
  .grv-notice-partial { border-color: color-mix(in srgb, var(--grv-warning) 28%, transparent); background: var(--grv-warning-soft); color: var(--grv-warning); }
  .grv-files { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 10px 0 0; padding-left: 0; list-style: none; }
  .grv-files li { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .grv-file-status { display: inline-block; flex: 0 0 auto; width: 10px; height: 10px; border-radius: 999px; background: var(--grv-border-strong); }
  .grv-file-status[data-present="true"] { background: var(--grv-success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--grv-success-soft) 84%, transparent); }
  .grv-loading { display: flex; align-items: center; gap: 10px; padding: 16px 20px 0; color: var(--grv-text-muted); font-weight: 650; }
  .grv-spinner { width: 18px; height: 18px; border: 2px solid var(--grv-border); border-top-color: var(--grv-accent); border-radius: 999px; animation: grv-spin .8s linear infinite; }
  .grv-grid-skeleton { grid-template-columns: repeat(6, minmax(0, 1fr)); padding: 14px 20px 20px; }
  .grv-skeleton-card { border: 1px solid var(--grv-border); border-radius: var(--grv-radius-md); padding: 12px; background: var(--grv-surface); }
  .grv-skeleton-card span, .grv-skeleton-card strong { display: block; border-radius: 999px; background: linear-gradient(90deg, var(--grv-surface-muted), color-mix(in srgb, var(--grv-border) 42%, var(--grv-surface)), var(--grv-surface-muted)); background-size: 200% 100%; animation: grv-shimmer 1.2s ease-in-out infinite; }
  .grv-skeleton-card span { width: 56%; height: 10px; }
  .grv-skeleton-card strong { width: 72%; height: 18px; margin-top: 10px; }
  @keyframes grv-spin { to { transform: rotate(360deg); } }
  @keyframes grv-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  @media (max-width: 1012px) {
    .grv-grid, .grv-grid-skeleton { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grv-trust-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grv-overview { grid-template-columns: 1fr; }
  }
  @media (max-width: 700px) {
    .grv-header { flex-direction: column; }
    .grv-header-actions { justify-content: flex-start; width: 100%; }
    .grv-summary-row { flex-direction: column; }
    .grv-badges { justify-content: flex-start; max-width: none; }
    .grv-grid, .grv-grid-small, .grv-files, .grv-grid-skeleton, .grv-section-stack { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grv-overview-stats { grid-template-columns: 1fr; }
  }
  @media (max-width: 420px) {
    .grv-content { padding: 12px; }
    .grv-header { padding: 14px; }
    .grv-overview { margin: 0 12px 4px; padding: 12px; }
    .grv-trust-head { align-items: flex-start; flex-direction: column; }
    .grv-trust-grid { grid-template-columns: 1fr; }
    .grv-grid, .grv-grid-small, .grv-files, .grv-grid-skeleton, .grv-section-stack { grid-template-columns: 1fr; }
    .grv-toggle { width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .grv-panel *, .grv-panel *::before, .grv-panel *::after { transition: none !important; animation: none !important; }
  }
`;
