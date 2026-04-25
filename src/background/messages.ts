export type MetricQuality = 'exact' | 'sampled' | 'partial' | 'unavailable';

export type AuthenticityTone = 'healthy' | 'moderate' | 'suspicious';

export type AuthenticityCheck = {
  label: string;
  value: number;
  formattedValue: string;
  threshold: string;
  suspicious: boolean;
  healthy?: boolean;
};

export type RepositoryAuthenticityView = {
  repo: RepoRef;
  generatedAt: string;
  cacheState: 'fresh' | 'stale' | 'miss';
  quality: MetricQuality;
  tone: AuthenticityTone;
  score: number;
  headline: string;
  summary: string;
  counts: {
    stars: number;
    forks: number;
    watchers: number;
  };
  ratios: {
    forkToStar: AuthenticityCheck;
    watcherToStar: AuthenticityCheck;
  };
  sample: {
    requested: number;
    size: number;
    zeroFollowers: AuthenticityCheck;
    zeroPublicRepos: AuthenticityCheck;
    ghostAccounts: AuthenticityCheck;
    source: 'graphql' | 'rest' | 'unavailable';
  };
  flags: string[];
  notices: Array<{ kind: StatusKind; message: string }>;
};

export type RepoRef = {
  owner: string;
  repo: string;
};

export type SummaryRequestMessage = {
  type: 'GITHUB_VISIBILITY_GET_SUMMARY';
  repo: RepoRef;
};

export type StarsRequestMessage = {
  type: 'GITHUB_VISIBILITY_GET_STARS';
  repo: RepoRef;
  days?: number;
  maxPages?: number;
};

export type AuthenticityRequestMessage = {
  type: 'GITHUB_VISIBILITY_GET_AUTHENTICITY';
  repo: RepoRef;
  sampleSize?: number;
};

export type VisibilityRequestMessage = SummaryRequestMessage | StarsRequestMessage | AuthenticityRequestMessage;

export type StatusKind = 'ok' | 'loading' | 'cached' | 'partial' | 'unavailable' | 'rate_limited' | 'error';

export type RepoSummaryView = {
  repo: RepoRef;
  generatedAt: string;
  cacheState: 'fresh' | 'stale' | 'miss';
  repoUrl: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  topics: string[];
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  archived: boolean;
  fork: boolean;
  license: string | null;
  pushedAt: string | null;
  pushedDaysAgo: number | null;
  latestRelease: {
    status: 'available' | 'none' | 'unavailable';
    name: string | null;
    publishedAt: string | null;
    daysAgo: number | null;
  };
  community: {
    quality: MetricQuality;
    healthPercentage: number | null;
    reason?: string;
    files: Array<{ label: string; present: boolean }>;
  };
  activity: {
    quality: MetricQuality;
    status: 'available' | 'preparing' | 'empty' | 'limited' | 'unavailable';
    headline: string;
    weeks: number[];
    lastWeekCommits: number | null;
    lastFourWeeksCommits: number | null;
    reason?: string;
  };
  responsiveness: {
    quality: MetricQuality;
    mergedPrCount: number;
    prSampleSize: number;
    medianMergeHours: number | null;
    closedIssueCount: number;
    issueSampleSize: number;
  };
  notices: Array<{ kind: StatusKind; message: string }>;
};

export type StarTrendView = {
  repo: RepoRef;
  generatedAt: string;
  days: number;
  quality: MetricQuality;
  totalInWindow: number;
  buckets: Array<{ date: string; count: number }>;
  pagesLoaded: number;
  message?: string;
};

export type VisibilityResponse =
  | { ok: true; type: 'summary'; data: RepoSummaryView }
  | { ok: true; type: 'stars'; data: StarTrendView }
  | { ok: true; type: 'authenticity'; data: RepositoryAuthenticityView }
  | { ok: false; type: 'summary' | 'stars' | 'authenticity'; error: string; status?: StatusKind; retryAfterSeconds?: number };
