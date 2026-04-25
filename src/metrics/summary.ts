import type { MetricQuality, RepoRef, RepoSummaryView } from '../background/messages';
import { daysBetween } from '../utils/date';

export type GitHubRepo = {
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  subscribers_count?: number;
  open_issues_count: number;
  archived: boolean;
  fork: boolean;
  pushed_at: string | null;
  license: { spdx_id?: string; name?: string } | null;
  topics?: string[];
};

export type GitHubRelease = {
  name: string | null;
  tag_name: string;
  published_at: string | null;
};

export type GitHubCommunityProfile = {
  health_percentage: number | null;
  files?: {
    readme?: unknown;
    contributing?: unknown;
    code_of_conduct?: unknown;
    license?: unknown;
    issue_template?: unknown;
    pull_request_template?: unknown;
  };
};

export function buildBaseSummary(input: {
  repoRef: RepoRef;
  repo: GitHubRepo;
  release: GitHubRelease | null;
  releaseUnavailable?: boolean;
  community: GitHubCommunityProfile | null;
  communityQuality: MetricQuality;
  communityReason?: string;
  cacheState: RepoSummaryView['cacheState'];
  now?: Date;
}): Omit<RepoSummaryView, 'activity' | 'responsiveness' | 'notices'> {
  const now = input.now ?? new Date();
  const pushedDaysAgo = daysBetween(input.repo.pushed_at, now);
  const releaseDaysAgo = daysBetween(input.release?.published_at, now);
  const files = input.community?.files;

  return {
    repo: input.repoRef,
    generatedAt: now.toISOString(),
    cacheState: input.cacheState,
    repoUrl: input.repo.html_url,
    fullName: input.repo.full_name,
    description: input.repo.description,
    defaultBranch: input.repo.default_branch,
    topics: input.repo.topics ?? [],
    stars: input.repo.stargazers_count,
    forks: input.repo.forks_count,
    watchers: input.repo.subscribers_count ?? 0,
    openIssues: input.repo.open_issues_count,
    archived: input.repo.archived,
    fork: input.repo.fork,
    license: input.repo.license?.spdx_id && input.repo.license.spdx_id !== 'NOASSERTION'
      ? input.repo.license.spdx_id
      : input.repo.license?.name ?? null,
    pushedAt: input.repo.pushed_at,
    pushedDaysAgo,
    latestRelease: input.release
      ? {
          status: 'available',
          name: input.release.name || input.release.tag_name,
          publishedAt: input.release.published_at,
          daysAgo: releaseDaysAgo
        }
      : {
          status: input.releaseUnavailable ? 'unavailable' : 'none',
          name: null,
          publishedAt: null,
          daysAgo: null
        },
    community: {
      quality: input.communityQuality,
      healthPercentage: input.community?.health_percentage ?? null,
      reason: input.communityReason,
      files: [
        { label: 'README', present: Boolean(files?.readme) },
        { label: 'Contributing', present: Boolean(files?.contributing) },
        { label: 'Code of conduct', present: Boolean(files?.code_of_conduct) },
        { label: 'Issue template', present: Boolean(files?.issue_template) },
        { label: 'PR template', present: Boolean(files?.pull_request_template) },
        { label: 'License', present: Boolean(files?.license) || Boolean(input.repo.license) }
      ]
    }
  };
}
