import { describe, expect, it } from 'vitest';
import { buildActivity } from '../../src/metrics/activity';

describe('activity metrics', () => {
  it('uses repository recency instead of a permanent stats warmup state', () => {
    const activity = buildActivity({ status: 202, weeks: null, repoPushedDaysAgo: 2 });
    expect(activity.status).toBe('limited');
    expect(activity.quality).toBe('partial');
    expect(activity.headline).toBe('Recently pushed');
  });

  it('falls back to contributor activity when commit stats are preparing', () => {
    const activity = buildActivity({
      status: 202,
      weeks: null,
      repoPushedDaysAgo: 2,
      fallbackContributorActivity: [
        { weeks: Array.from({ length: 52 }, (_, index) => ({ w: index, c: index > 47 ? 3 : 0 })) }
      ]
    });

    expect(activity.status).toBe('available');
    expect(activity.lastFourWeeksCommits).toBe(12);
    expect(activity.headline).toBe('Active this month');
  });

  it('summarizes recent activity', () => {
    const weeks = Array.from({ length: 52 }, (_, index) => ({ week: index, total: index > 47 ? 2 : 0, days: [] }));
    const activity = buildActivity({ status: 200, weeks, repoPushedDaysAgo: 2 });
    expect(activity.lastFourWeeksCommits).toBe(8);
    expect(activity.headline).toBe('Active this month');
  });
});
