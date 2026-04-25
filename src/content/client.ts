import type { RepoRef, RepositoryAuthenticityView, StarTrendView, VisibilityResponse } from '../background/messages';

export function requestSummary(repo: RepoRef): Promise<VisibilityResponse> {
  return chrome.runtime.sendMessage({ type: 'GITHUB_VISIBILITY_GET_SUMMARY', repo });
}

export function requestStars(repo: RepoRef, days = 90): Promise<VisibilityResponse> {
  return chrome.runtime.sendMessage({ type: 'GITHUB_VISIBILITY_GET_STARS', repo, days, maxPages: 5 });
}

export function requestAuthenticity(repo: RepoRef, sampleSize = 100): Promise<VisibilityResponse> {
  return chrome.runtime.sendMessage({ type: 'GITHUB_VISIBILITY_GET_AUTHENTICITY', repo, sampleSize });
}

export function emptyAuthenticity(repo: RepoRef, message: string): RepositoryAuthenticityView {
  return {
    repo,
    generatedAt: new Date().toISOString(),
    cacheState: 'miss',
    quality: 'unavailable',
    tone: 'moderate',
    score: 0,
    headline: 'Repository authenticity unavailable',
    summary: message,
    counts: { stars: 0, forks: 0, watchers: 0 },
    ratios: {
      forkToStar: { label: 'Fork-to-star ratio', value: 0, formattedValue: 'Unavailable', threshold: '< 5.0% suspicious; 10%-20% healthy', suspicious: false },
      watcherToStar: { label: 'Watcher-to-star ratio', value: 0, formattedValue: 'Unavailable', threshold: '< 0.1% suspicious; 0.5%-3% healthy', suspicious: false }
    },
    sample: {
      requested: 100,
      size: 0,
      zeroFollowers: { label: 'Zero followers', value: 0, formattedValue: 'Unavailable', threshold: 'Flag if > 30%', suspicious: false },
      zeroPublicRepos: { label: 'Zero public repos', value: 0, formattedValue: 'Unavailable', threshold: 'Flag if > 25%', suspicious: false },
      ghostAccounts: { label: 'Ghost accounts', value: 0, formattedValue: 'Unavailable', threshold: 'Flag if > 15%; healthy repos are usually around ~1%', suspicious: false },
      source: 'unavailable'
    },
    flags: [],
    notices: [{ kind: 'error', message }]
  };
}

export function emptyStarTrend(repo: RepoRef): StarTrendView {
  return {
    repo,
    generatedAt: new Date().toISOString(),
    days: 90,
    quality: 'unavailable',
    totalInWindow: 0,
    buckets: [],
    pagesLoaded: 0,
    message: 'Star trend has not been loaded yet.'
  };
}
