import { describe, expect, it } from 'vitest';
import { buildActivity } from '../../src/metrics/activity';

describe('activity metrics', () => {
  it('represents GitHub stats warmup state', () => {
    const activity = buildActivity({ status: 202, weeks: null, repoPushedDaysAgo: null });
    expect(activity.status).toBe('preparing');
    expect(activity.quality).toBe('partial');
  });

  it('summarizes recent activity', () => {
    const weeks = Array.from({ length: 52 }, (_, index) => ({ week: index, total: index > 47 ? 2 : 0, days: [] }));
    const activity = buildActivity({ status: 200, weeks, repoPushedDaysAgo: 2 });
    expect(activity.lastFourWeeksCommits).toBe(8);
    expect(activity.headline).toBe('Active this month');
  });
});
