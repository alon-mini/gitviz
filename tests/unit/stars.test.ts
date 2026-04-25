import { describe, expect, it } from 'vitest';
import { aggregateStars } from '../../src/metrics/stars';

describe('star aggregation', () => {
  it('aggregates stars into UTC daily buckets', () => {
    const trend = aggregateStars({
      repo: { owner: 'octo', repo: 'repo' },
      days: 3,
      pagesLoaded: 1,
      reachedWindowStart: true,
      now: new Date('2026-04-25T12:00:00Z'),
      stargazers: [
        { starred_at: '2026-04-23T23:00:00Z' },
        { starred_at: '2026-04-25T01:00:00Z' },
        { starred_at: '2026-04-20T01:00:00Z' }
      ]
    });

    expect(trend.quality).toBe('exact');
    expect(trend.totalInWindow).toBe(2);
    expect(trend.buckets).toEqual([
      { date: '2026-04-23', count: 1 },
      { date: '2026-04-24', count: 0 },
      { date: '2026-04-25', count: 1 }
    ]);
  });
});
