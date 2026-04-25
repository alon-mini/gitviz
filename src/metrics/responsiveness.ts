import type { RepoSummaryView } from '../background/messages';
import { hoursBetween } from '../utils/date';

export type GitHubPullRequest = {
  created_at: string;
  merged_at: string | null;
};

export type GitHubIssue = {
  closed_at: string | null;
  pull_request?: unknown;
};

export function buildResponsiveness(pulls: GitHubPullRequest[] | null, issues: GitHubIssue[] | null): RepoSummaryView['responsiveness'] {
  const merged = (pulls ?? []).filter((pull) => pull.merged_at);
  const mergeHours = merged
    .map((pull) => hoursBetween(pull.created_at, pull.merged_at as string))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  const closedIssues = (issues ?? []).filter((issue) => !issue.pull_request && issue.closed_at);

  return {
    quality: pulls || issues ? 'sampled' : 'unavailable',
    mergedPrCount: merged.length,
    prSampleSize: pulls?.length ?? 0,
    medianMergeHours: median(mergeHours),
    closedIssueCount: closedIssues.length,
    issueSampleSize: issues?.length ?? 0
  };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  if (values.length % 2) return values[mid];
  return (values[mid - 1] + values[mid]) / 2;
}
