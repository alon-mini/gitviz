import { endpoints } from '../api/endpoints';
import { githubGet, githubPost } from '../api/github';
import type { RepositoryAuthenticityView, RepoRef, StatusKind } from '../background/messages';

export type GitHubRepoAuthenticityCounts = {
  stargazers_count: number;
  forks_count: number;
  subscribers_count?: number;
};

type GraphQlStargazerResponse = {
  data?: {
    repository?: {
      stargazers?: {
        edges?: Array<{
          starredAt: string;
          node: {
            login: string;
            bio: string | null;
            followers: { totalCount: number };
            repositories: { totalCount: number };
          } | null;
        }>;
      };
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

type RestStargazer = {
  user?: {
    login?: string;
  };
};

type RestUser = {
  login: string;
  followers: number;
  public_repos: number;
  bio: string | null;
};

type SampledUser = {
  login: string;
  followers: number;
  publicRepos: number;
  bio: string | null;
};

type StargazerSample = {
  users: SampledUser[];
  requested: number;
  source: RepositoryAuthenticityView['sample']['source'];
  notices: RepositoryAuthenticityView['notices'];
};

const FORK_HEALTHY_MIN = 0.10;
const FORK_HEALTHY_MAX = 0.20;
const FORK_SUSPICIOUS_MAX = 0.05;
const WATCHER_HEALTHY_MIN = 0.005;
const WATCHER_HEALTHY_MAX = 0.03;
const WATCHER_SUSPICIOUS_MAX = 0.001;
const ZERO_FOLLOWERS_SUSPICIOUS_MIN = 0.30;
const ZERO_REPOS_SUSPICIOUS_MIN = 0.25;
const GHOST_SUSPICIOUS_MIN = 0.15;

export function buildRepositoryAuthenticity(input: {
  repo: RepoRef;
  counts: GitHubRepoAuthenticityCounts;
  sample: StargazerSample;
  cacheState: RepositoryAuthenticityView['cacheState'];
  now?: Date;
}): RepositoryAuthenticityView {
  const stars = input.counts.stargazers_count;
  const forks = input.counts.forks_count;
  const watchers = input.counts.subscribers_count ?? 0;
  const users = input.sample.users;
  const sampleSize = users.length;

  const forkToStar = stars > 0 ? forks / stars : 0;
  const watcherToStar = stars > 0 ? watchers / stars : 0;
  const zeroFollowersCount = users.filter((user) => user.followers === 0).length;
  const zeroPublicReposCount = users.filter((user) => user.publicRepos === 0).length;
  const ghostCount = users.filter((user) => user.followers === 0 && user.publicRepos === 0 && isBlank(user.bio)).length;
  const zeroFollowersRate = sampleSize > 0 ? zeroFollowersCount / sampleSize : 0;
  const zeroReposRate = sampleSize > 0 ? zeroPublicReposCount / sampleSize : 0;
  const ghostRate = sampleSize > 0 ? ghostCount / sampleSize : 0;

  const ratios = {
    forkToStar: ratioCheck('Fork-to-star ratio', forkToStar, `${formatPercent(FORK_SUSPICIOUS_MAX, 1)} suspicious; ${formatPercent(FORK_HEALTHY_MIN, 0)}-${formatPercent(FORK_HEALTHY_MAX, 0)} healthy`, forkToStar < FORK_SUSPICIOUS_MAX, forkToStar >= FORK_HEALTHY_MIN && forkToStar <= FORK_HEALTHY_MAX),
    watcherToStar: ratioCheck('Watcher-to-star ratio', watcherToStar, `< ${formatPercent(WATCHER_SUSPICIOUS_MAX, 1)} suspicious; ${formatPercent(WATCHER_HEALTHY_MIN, 1)}-${formatPercent(WATCHER_HEALTHY_MAX, 0)} healthy`, watcherToStar < WATCHER_SUSPICIOUS_MAX, watcherToStar >= WATCHER_HEALTHY_MIN && watcherToStar <= WATCHER_HEALTHY_MAX)
  };

  const sample = {
    requested: input.sample.requested,
    size: sampleSize,
    zeroFollowers: percentCheck('Zero followers', zeroFollowersRate, `Flag if > ${formatPercent(ZERO_FOLLOWERS_SUSPICIOUS_MIN, 0)}`, zeroFollowersRate > ZERO_FOLLOWERS_SUSPICIOUS_MIN),
    zeroPublicRepos: percentCheck('Zero public repos', zeroReposRate, `Flag if > ${formatPercent(ZERO_REPOS_SUSPICIOUS_MIN, 0)}`, zeroReposRate > ZERO_REPOS_SUSPICIOUS_MIN),
    ghostAccounts: percentCheck('Ghost accounts', ghostRate, `Flag if > ${formatPercent(GHOST_SUSPICIOUS_MIN, 0)}; healthy repos are usually around ~1%`, ghostRate > GHOST_SUSPICIOUS_MIN),
    source: input.sample.source
  };

  const flags = [
    ratios.forkToStar.suspicious ? 'Fork-to-star ratio is unusually low.' : null,
    ratios.watcherToStar.suspicious ? 'Watcher-to-star ratio is unusually low.' : null,
    sample.zeroFollowers.suspicious ? 'Large share of sampled stargazers have zero followers.' : null,
    sample.zeroPublicRepos.suspicious ? 'Large share of sampled stargazers have zero public repositories.' : null,
    sample.ghostAccounts.suspicious ? 'High ghost-account volume in recent stargazers.' : null
  ].filter((flag): flag is string => Boolean(flag));

  const ratioFlagCount = Number(ratios.forkToStar.suspicious) + Number(ratios.watcherToStar.suspicious);
  const sampleFlagCount = Number(sample.zeroFollowers.suspicious) + Number(sample.zeroPublicRepos.suspicious) + Number(sample.ghostAccounts.suspicious);
  const tone = ratioFlagCount >= 2 && sample.ghostAccounts.suspicious
    ? 'suspicious'
    : ratioFlagCount + sampleFlagCount >= 2
      ? 'moderate'
      : 'healthy';
  const score = Math.max(0, 100 - ratioFlagCount * 20 - sampleFlagCount * 15 - (sample.ghostAccounts.suspicious ? 10 : 0));

  return {
    repo: input.repo,
    generatedAt: (input.now ?? new Date()).toISOString(),
    cacheState: input.cacheState,
    quality: sampleSize > 0 ? 'sampled' : 'partial',
    tone,
    score,
    headline: headlineForTone(tone),
    summary: summaryForTone(tone, flags.length, sampleSize),
    counts: { stars, forks, watchers },
    ratios,
    sample,
    flags,
    notices: input.sample.notices
  };
}

export async function fetchStargazerSample(input: {
  repo: RepoRef;
  sampleSize: number;
  githubToken?: string | null;
}): Promise<StargazerSample> {
  if (input.githubToken) {
    const graphQlSample = await fetchGraphQlStargazerSample(input.repo, input.sampleSize, input.githubToken);
    if (graphQlSample) return graphQlSample;
  }

  return fetchRestStargazerSample(input.repo, input.sampleSize, input.githubToken ?? null);
}

async function fetchGraphQlStargazerSample(repo: RepoRef, sampleSize: number, githubToken: string): Promise<StargazerSample | null> {
  const query = `
    query RepoAuthenticityStargazers($owner: String!, $name: String!, $sampleSize: Int!) {
      repository(owner: $owner, name: $name) {
        stargazers(last: $sampleSize, orderBy: {field: STARRED_AT, direction: ASC}) {
          edges {
            starredAt
            node {
              login
              bio
              followers { totalCount }
              repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }
            }
          }
        }
      }
    }
  `;

  const result = await githubPost<GraphQlStargazerResponse>(endpoints.graphql, {
    query,
    variables: { owner: repo.owner, name: repo.repo, sampleSize }
  }, 'application/vnd.github+json', githubToken);

  if (result.rateLimited) throw new AuthenticityRateLimitError('GitHub API limit reached while sampling stargazers.', result.retryAfterSeconds);
  if (!result.ok || !result.data?.data?.repository?.stargazers?.edges) return null;

  return {
    requested: sampleSize,
    source: 'graphql',
    users: result.data.data.repository.stargazers.edges
      .map((edge) => edge.node)
      .filter((node): node is NonNullable<typeof node> => Boolean(node))
      .map((node) => ({
        login: node.login,
        followers: node.followers.totalCount,
        publicRepos: node.repositories.totalCount,
        bio: node.bio
      })),
    notices: []
  };
}

async function fetchRestStargazerSample(repo: RepoRef, sampleSize: number, githubToken: string | null): Promise<StargazerSample> {
  const notices: RepositoryAuthenticityView['notices'] = githubToken
    ? [{ kind: 'partial', message: 'GraphQL stargazer sampling was unavailable; used REST fallback.' }]
    : [{ kind: 'partial', message: 'Anonymous mode shows ratio-only authenticity checks to avoid exhausting GitHub API limits.' }];

  if (!githubToken) {
    return { requested: sampleSize, source: 'unavailable', users: [], notices };
  }

  const stargazersResult = await githubGet<RestStargazer[]>(endpoints.recentStargazers(repo.owner, repo.repo, 1), undefined, 'application/vnd.github.star+json', githubToken);
  if (stargazersResult.rateLimited) throw new AuthenticityRateLimitError('GitHub API limit reached while sampling stargazers.', stargazersResult.retryAfterSeconds);

  if (!stargazersResult.ok || !stargazersResult.data) {
    return { requested: sampleSize, source: 'unavailable', users: [], notices: [...notices, { kind: 'error', message: stargazersResult.error ?? 'Could not load stargazer sample.' }] };
  }

  const logins = stargazersResult.data
    .map((stargazer) => stargazer.user?.login)
    .filter((login): login is string => Boolean(login))
    .slice(0, sampleSize);
  const users: SampledUser[] = [];

  for (const login of logins) {
    const userResult = await githubGet<RestUser>(endpoints.users(login), undefined, 'application/vnd.github+json', githubToken);
    if (userResult.rateLimited) throw new AuthenticityRateLimitError('GitHub API limit reached while loading sampled stargazer profiles.', userResult.retryAfterSeconds);
    if (userResult.ok && userResult.data) {
      users.push({
        login: userResult.data.login,
        followers: userResult.data.followers,
        publicRepos: userResult.data.public_repos,
        bio: userResult.data.bio
      });
    }
  }

  if (users.length < logins.length) {
    notices.push({ kind: 'partial', message: `Loaded ${users.length}/${logins.length} sampled stargazer profiles.` });
  }

  return { requested: sampleSize, source: 'rest', users, notices };
}

function ratioCheck(label: string, value: number, threshold: string, suspicious: boolean, healthy: boolean): RepositoryAuthenticityView['ratios']['forkToStar'] {
  return { label, value, formattedValue: formatPercent(value, value < 0.01 ? 2 : 1), threshold, suspicious, healthy };
}

function percentCheck(label: string, value: number, threshold: string, suspicious: boolean): RepositoryAuthenticityView['sample']['zeroFollowers'] {
  return { label, value, formattedValue: formatPercent(value, 1), threshold, suspicious, healthy: !suspicious };
}

function headlineForTone(tone: RepositoryAuthenticityView['tone']): string {
  if (tone === 'suspicious') return 'Highly suspicious star authenticity signals';
  if (tone === 'moderate') return 'Mixed repository authenticity signals';
  return 'Healthy repository authenticity signals';
}

function summaryForTone(tone: RepositoryAuthenticityView['tone'], flags: number, sampleSize: number): string {
  const sampleText = sampleSize > 0 ? `${sampleSize} recent stargazers sampled` : 'stargazer sample unavailable';
  if (tone === 'suspicious') return `Multiple core ratios and sampled-account checks are flagged (${sampleText}).`;
  if (tone === 'moderate') return `${flags} authenticity check${flags === 1 ? '' : 's'} flagged; review the breakdown (${sampleText}).`;
  return `Core ratios and sampled stargazer accounts look normal (${sampleText}).`;
}

function formatPercent(value: number, fractionDigits: number): string {
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

function isBlank(value: string | null): boolean {
  return !value || value.trim().length === 0;
}

export class AuthenticityRateLimitError extends Error {
  constructor(message: string, public retryAfterSeconds?: number) {
    super(message);
  }
}
