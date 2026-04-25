import type { RepoRef, StarTrendView } from '../background/messages';
import { DAY_MS, isoDateOnly, startOfUtcDay } from '../utils/date';

export type Stargazer = {
  starred_at: string;
  user?: unknown;
};

export function aggregateStars(input: {
  repo: RepoRef;
  stargazers: Stargazer[];
  days: number;
  pagesLoaded: number;
  reachedWindowStart: boolean;
  now?: Date;
}): StarTrendView {
  const now = input.now ?? new Date();
  const today = startOfUtcDay(now);
  const start = new Date(today.getTime() - (input.days - 1) * DAY_MS);
  const buckets = new Map<string, number>();

  for (let i = 0; i < input.days; i += 1) {
    buckets.set(isoDateOnly(new Date(start.getTime() + i * DAY_MS)), 0);
  }

  for (const star of input.stargazers) {
    const starredAt = new Date(star.starred_at);
    if (Number.isNaN(starredAt.getTime())) continue;
    const day = startOfUtcDay(starredAt);
    if (day < start || day > today) continue;
    const key = isoDateOnly(day);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const bucketArray = Array.from(buckets, ([date, count]) => ({ date, count }));
  const totalInWindow = bucketArray.reduce((sum, bucket) => sum + bucket.count, 0);

  return {
    repo: input.repo,
    generatedAt: now.toISOString(),
    days: input.days,
    quality: input.reachedWindowStart ? 'exact' : 'partial',
    totalInWindow,
    buckets: bucketArray,
    pagesLoaded: input.pagesLoaded,
    message: input.reachedWindowStart
      ? 'Loaded enough stargazer pages to cover the requested window.'
      : 'Recent trend is partial because the request budget ended before the full window was reached.'
  };
}
