import type { RepoSummaryView } from '../background/messages';

export type CommitActivityWeek = {
  total: number;
  week: number;
  days: number[];
};

export type ContributorActivity = {
  weeks?: Array<{
    c?: number;
    a?: number;
    d?: number;
    w?: number;
  }>;
};

export function buildActivity(input: {
  status: number;
  weeks: CommitActivityWeek[] | null;
  repoPushedDaysAgo: number | null;
  fallbackContributorActivity?: ContributorActivity[] | null;
  error?: string;
}): RepoSummaryView['activity'] {
  if (input.status === 202) {
    const fallback = activityFromContributors(input.fallbackContributorActivity, input.repoPushedDaysAgo);
    if (fallback) return fallback;

    return {
      quality: 'partial',
      status: 'preparing',
      headline: 'Preparing activity data',
      weeks: [],
      lastWeekCommits: null,
      lastFourWeeksCommits: null,
      reason: 'GitHub is generating repository statistics. Try again shortly.'
    };
  }

  if (input.status === 204) {
    return {
      quality: 'unavailable',
      status: 'empty',
      headline: 'No activity data available',
      weeks: [],
      lastWeekCommits: null,
      lastFourWeeksCommits: null,
      reason: 'GitHub returned no commit activity for this repository.'
    };
  }

  if (!input.weeks) {
    return {
      quality: 'unavailable',
      status: 'unavailable',
      headline: 'Activity unavailable',
      weeks: [],
      lastWeekCommits: null,
      lastFourWeeksCommits: null,
      reason: input.error ?? 'GitHub statistics are unavailable for this repository.'
    };
  }

  const totals = input.weeks.slice(-52).map((week) => week.total);
  const lastWeekCommits = totals.at(-1) ?? 0;
  const lastFourWeeksCommits = totals.slice(-4).reduce((sum, value) => sum + value, 0);

  return {
    quality: 'sampled',
    status: 'available',
    headline: activityHeadline(lastFourWeeksCommits, input.repoPushedDaysAgo),
    weeks: totals,
    lastWeekCommits,
    lastFourWeeksCommits
  };
}

function activityHeadline(lastFourWeeksCommits: number, pushedDaysAgo: number | null): string {
  if (lastFourWeeksCommits > 20) return 'Very active this month';
  if (lastFourWeeksCommits > 0) return 'Active this month';
  if (pushedDaysAgo !== null && pushedDaysAgo <= 30) return 'Recently pushed';
  return 'Quiet recently';
}

function activityFromContributors(contributors: ContributorActivity[] | null | undefined, repoPushedDaysAgo: number | null): RepoSummaryView['activity'] | null {
  if (!contributors?.length) return null;

  const weeklyTotals = new Map<number, number>();
  for (const contributor of contributors) {
    for (const week of contributor.weeks ?? []) {
      const weekStart = week.w;
      if (typeof weekStart !== 'number') continue;
      weeklyTotals.set(weekStart, (weeklyTotals.get(weekStart) ?? 0) + (week.c ?? 0));
    }
  }

  if (!weeklyTotals.size) return null;

  const totals = Array.from(weeklyTotals.entries())
    .sort(([leftWeek], [rightWeek]) => leftWeek - rightWeek)
    .slice(-52)
    .map(([, total]) => total);
  const lastWeekCommits = totals.at(-1) ?? 0;
  const lastFourWeeksCommits = totals.slice(-4).reduce((sum, value) => sum + value, 0);

  return {
    quality: 'sampled',
    status: 'available',
    headline: activityHeadline(lastFourWeeksCommits, repoPushedDaysAgo),
    weeks: totals,
    lastWeekCommits,
    lastFourWeeksCommits,
    reason: 'GitHub commit statistics were still preparing, so activity uses contributor commit totals.'
  };
}
