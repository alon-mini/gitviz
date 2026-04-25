const BASE = 'https://api.github.com';

export const endpoints = {
  graphql: `${BASE}/graphql`,
  repo: (owner: string, repo: string) => `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  community: (owner: string, repo: string) => `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/community/profile`,
  commitActivity: (owner: string, repo: string) => `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stats/commit_activity`,
  latestRelease: (owner: string, repo: string) => `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`,
  pulls: (owner: string, repo: string) => `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=closed&sort=updated&direction=desc&per_page=100`,
  issues: (owner: string, repo: string) => `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=closed&sort=updated&direction=desc&per_page=100`,
  stargazers: (owner: string, repo: string, page: number) => `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stargazers?per_page=100&page=${page}`,
  recentStargazers: (owner: string, repo: string, page: number) => `${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stargazers?per_page=100&page=${page}`,
  users: (username: string) => `${BASE}/users/${encodeURIComponent(username)}`
};
