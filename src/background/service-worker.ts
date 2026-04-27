import { endpoints } from '../api/endpoints';
import { githubGet } from '../api/github';
import { getCache, getValidators, putCache } from '../cache/indexed-db';
import { getCachedAuthenticity, putCachedAuthenticity } from '../cache/local-authenticity';
import { getGitHubToken, getRepoRetryAfter, setRepoRetryAfter } from '../cache/local-meta';
import { buildActivity, type CommitActivityWeek, type ContributorActivity } from '../metrics/activity';
import { AuthenticityRateLimitError, buildRepositoryAuthenticity, fetchStargazerSample } from '../metrics/authenticity';
import { buildResponsiveness, type GitHubIssue, type GitHubPullRequest } from '../metrics/responsiveness';
import { aggregateStars, type Stargazer } from '../metrics/stars';
import { buildBaseSummary, type GitHubCommunityProfile, type GitHubRelease, type GitHubRepo } from '../metrics/summary';
import type { RepoRef, RepoSummaryView, RepositoryAuthenticityView, StarTrendView, VisibilityRequestMessage, VisibilityResponse } from './messages';

const SUMMARY_TTL_MS = 15 * 60 * 1000;
const STAR_TTL_MS = 60 * 60 * 1000;
const AUTHENTICITY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_AUTHENTICITY_SAMPLE_SIZE = 100;
const inflight = new Map<string, Promise<unknown>>();

chrome.runtime.onMessage.addListener((message: VisibilityRequestMessage, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: VisibilityRequestMessage): Promise<VisibilityResponse> {
  try {
    if (message.type === 'GITHUB_VISIBILITY_GET_SUMMARY') {
      const data = await dedupe(`summary:${repoKey(message.repo)}`, () => getSummary(message.repo));
      return { ok: true, type: 'summary', data };
    }

    if (message.type === 'GITHUB_VISIBILITY_GET_AUTHENTICITY') {
      const sampleSize = message.sampleSize ?? DEFAULT_AUTHENTICITY_SAMPLE_SIZE;
      const data = await dedupe(`authenticity:${repoKey(message.repo)}:${sampleSize}`, () => getAuthenticity(message.repo, sampleSize));
      return { ok: true, type: 'authenticity', data };
    }

    const days = message.days ?? 90;
    const maxPages = message.maxPages ?? 5;
    const data = await dedupe(`stars:${repoKey(message.repo)}:${days}:${maxPages}`, () => getStars(message.repo, days, maxPages));
    return { ok: true, type: 'stars', data };
  } catch (error) {
    return {
      ok: false,
      type: responseTypeForMessage(message),
      status: error instanceof RateLimitError || error instanceof AuthenticityRateLimitError ? 'rate_limited' : 'error',
      retryAfterSeconds: error instanceof RateLimitError || error instanceof AuthenticityRateLimitError ? error.retryAfterSeconds : undefined,
      error: error instanceof Error ? error.message : 'Unknown extension error'
    };
  }
}

async function getSummary(repo: RepoRef): Promise<RepoSummaryView> {
  const key = `summary:${repoKey(repo)}`;
  const retryAfter = await getRepoRetryAfter(repoKey(repo));
  const cached = await getCache<RepoSummaryView>(key, SUMMARY_TTL_MS);

  if (retryAfter && retryAfter > Date.now()) {
    if (cached) {
      return {
        ...cached.record.value,
        cacheState: 'stale',
        notices: [
          ...cached.record.value.notices,
          { kind: 'rate_limited', message: 'Anonymous GitHub API limit reached. Showing cached data.' }
        ]
      };
    }
    throw new RateLimitError('Anonymous GitHub API limit reached. Try again later.', Math.ceil((retryAfter - Date.now()) / 1000));
  }

  if (cached && !cached.stale) {
    return { ...cached.record.value, cacheState: 'fresh' };
  }

  const validators = await getValidators(key);
  const repoResult = await githubGet<GitHubRepo>(endpoints.repo(repo.owner, repo.repo), validators);
  if (repoResult.rateLimited) await rememberRateLimit(repo, repoResult.retryAfterSeconds);

  if (repoResult.notModified && cached) {
    return { ...cached.record.value, cacheState: 'fresh' };
  }

  if (!repoResult.ok || !repoResult.data) {
    if (cached) {
      return {
        ...cached.record.value,
        cacheState: 'stale',
        notices: [...cached.record.value.notices, { kind: 'error', message: repoResult.error ?? 'Could not refresh repository data.' }]
      };
    }
    throw new Error(repoResult.error ?? 'Could not load repository data.');
  }

  const [releaseResult, communityResult, activityResult, pullsResult, issuesResult] = await Promise.all([
    githubGet<GitHubRelease>(endpoints.latestRelease(repo.owner, repo.repo)),
    repoResult.data.fork
      ? Promise.resolve(null)
      : githubGet<GitHubCommunityProfile>(endpoints.community(repo.owner, repo.repo)),
    githubGet<CommitActivityWeek[]>(endpoints.commitActivity(repo.owner, repo.repo)),
    githubGet<GitHubPullRequest[]>(endpoints.pulls(repo.owner, repo.repo)),
    githubGet<GitHubIssue[]>(endpoints.issues(repo.owner, repo.repo))
  ]);
  const contributorActivityResult = activityResult.status === 202
    ? await githubGet<ContributorActivity[]>(endpoints.contributors(repo.owner, repo.repo))
    : null;

  for (const result of [releaseResult, communityResult, activityResult, contributorActivityResult, pullsResult, issuesResult]) {
    if (result?.rateLimited) await rememberRateLimit(repo, result.retryAfterSeconds);
  }

  const communityProfile = communityResult?.ok ? communityResult.data : null;
  const communityReason = repoResult.data.fork
    ? 'Community profile metrics are not available for fork repositories.'
    : communityResult && !communityResult.ok
      ? communityResult.error
      : undefined;

  const base = buildBaseSummary({
    repoRef: repo,
    repo: repoResult.data,
    release: releaseResult.status === 404 ? null : releaseResult.data,
    releaseUnavailable: releaseResult.status !== 404 && !releaseResult.ok,
    community: communityProfile,
    communityQuality: repoResult.data.fork || !communityProfile ? 'unavailable' : 'exact',
    communityReason,
    cacheState: cached ? 'stale' : 'miss'
  });

  const activity = buildActivity({
    status: activityResult.status,
    weeks: activityResult.ok ? activityResult.data : null,
    repoPushedDaysAgo: base.pushedDaysAgo,
    fallbackContributorActivity: contributorActivityResult?.ok ? contributorActivityResult.data : null,
    error: activityResult.error
  });

  const responsiveness = buildResponsiveness(
    pullsResult.ok ? pullsResult.data : null,
    issuesResult.ok ? issuesResult.data : null
  );

  const notices = buildNotices(repoResult.data, releaseResult.status, communityReason, activity.reason);
  const summary: RepoSummaryView = { ...base, activity, responsiveness, notices };

  await putCache(key, summary, {
    etag: repoResult.headers.etag,
    lastModified: repoResult.headers['last-modified']
  });

  return summary;
}

async function getAuthenticity(repo: RepoRef, sampleSize: number): Promise<RepositoryAuthenticityView> {
  const retryAfter = await getRepoRetryAfter(repoKey(repo));
  const cached = await getCachedAuthenticity(repoKey(repo), AUTHENTICITY_TTL_MS);

  if (retryAfter && retryAfter > Date.now()) {
    if (cached) {
      return {
        ...cached.record.value,
        cacheState: 'stale',
        notices: [
          ...cached.record.value.notices,
          { kind: 'rate_limited', message: 'Anonymous GitHub API limit reached. Showing cached authenticity data.' }
        ]
      };
    }
    throw new RateLimitError('Anonymous GitHub API limit reached. Try again later.', Math.ceil((retryAfter - Date.now()) / 1000));
  }

  if (cached && !cached.stale) {
    return { ...cached.record.value, cacheState: 'fresh' };
  }

  const repoResult = await githubGet<GitHubRepo>(endpoints.repo(repo.owner, repo.repo));
  if (repoResult.rateLimited) await rememberRateLimit(repo, repoResult.retryAfterSeconds);

  if (!repoResult.ok || !repoResult.data) {
    if (cached) {
      return {
        ...cached.record.value,
        cacheState: 'stale',
        notices: [...cached.record.value.notices, { kind: 'error', message: repoResult.error ?? 'Could not refresh authenticity data.' }]
      };
    }
    throw new Error(repoResult.error ?? 'Could not load repository authenticity data.');
  }

  try {
    const sample = await fetchStargazerSample({
      repo,
      sampleSize,
      githubToken: await getGitHubToken()
    });
    const authenticity = buildRepositoryAuthenticity({
      repo,
      counts: repoResult.data,
      sample,
      cacheState: cached ? 'stale' : 'miss'
    });
    await putCachedAuthenticity(repoKey(repo), authenticity);
    return authenticity;
  } catch (error) {
    if (error instanceof AuthenticityRateLimitError) {
      await setRepoRetryAfter(repoKey(repo), Date.now() + (error.retryAfterSeconds ?? 60 * 10) * 1000);
      if (cached) {
        return {
          ...cached.record.value,
          cacheState: 'stale',
          notices: [
            ...cached.record.value.notices,
            { kind: 'rate_limited', message: 'GitHub API limit reached while refreshing authenticity data. Showing cached data.' }
          ]
        };
      }
    }
    throw error;
  }
}

async function getStars(repo: RepoRef, days: number, maxPages: number): Promise<StarTrendView> {
  const key = `stars:${repoKey(repo)}:${days}:${maxPages}`;
  const cached = await getCache<StarTrendView>(key, STAR_TTL_MS);
  if (cached && !cached.stale) return cached.record.value;

  const allStars: Stargazer[] = [];
  let reachedWindowStart = false;
  let pagesLoaded = 0;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await githubGet<Stargazer[]>(
      endpoints.stargazers(repo.owner, repo.repo, page),
      undefined,
      'application/vnd.github.star+json'
    );

    if (result.rateLimited) await rememberRateLimit(repo, result.retryAfterSeconds);
    if (!result.ok || !result.data) break;

    pagesLoaded = page;
    allStars.push(...result.data);

    if (result.data.some((star) => new Date(star.starred_at) < cutoff) || result.data.length < 100) {
      reachedWindowStart = true;
      break;
    }
  }

  const view = aggregateStars({ repo, stargazers: allStars, days, pagesLoaded, reachedWindowStart });
  await putCache(key, view);
  return view;
}

function buildNotices(repo: GitHubRepo, releaseStatus: number, communityReason?: string, activityReason?: string): RepoSummaryView['notices'] {
  const notices: RepoSummaryView['notices'] = [];
  if (repo.archived) notices.push({ kind: 'partial', message: 'Repository is archived.' });
  if (repo.fork) notices.push({ kind: 'unavailable', message: 'Community health is unavailable for forks.' });
  if (releaseStatus === 404) notices.push({ kind: 'unavailable', message: 'No releases found.' });
  if (communityReason && !repo.fork) notices.push({ kind: 'unavailable', message: communityReason });
  if (activityReason) notices.push({ kind: 'partial', message: activityReason });
  return notices;
}

async function rememberRateLimit(repo: RepoRef, retryAfterSeconds?: number): Promise<never> {
  const waitSeconds = retryAfterSeconds ?? 60 * 10;
  await setRepoRetryAfter(repoKey(repo), Date.now() + waitSeconds * 1000);
  throw new RateLimitError('Anonymous GitHub API limit reached. Showing cached data when available.', waitSeconds);
}

async function dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = factory().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

function responseTypeForMessage(message: VisibilityRequestMessage): VisibilityResponse['type'] {
  if (message.type === 'GITHUB_VISIBILITY_GET_STARS') return 'stars';
  if (message.type === 'GITHUB_VISIBILITY_GET_AUTHENTICITY') return 'authenticity';
  return 'summary';
}

function repoKey(repo: RepoRef): string {
  return `${repo.owner}/${repo.repo}`.toLowerCase();
}

class RateLimitError extends Error {
  constructor(message: string, public retryAfterSeconds?: number) {
    super(message);
  }
}
