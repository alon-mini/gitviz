import type { RepoRef } from '../background/messages';

const RESERVED = new Set([
  'features', 'topics', 'collections', 'trending', 'events', 'marketplace', 'pricing',
  'nonprofit', 'customer-stories', 'security', 'login', 'join', 'settings', 'notifications',
  'new', 'organizations', 'dashboard', 'pulls', 'issues', 'explore', 'sponsors', 'account'
]);

export function parseRepoFromLocation(location: Location = window.location): RepoRef | null {
  if (location.hostname !== 'github.com') return null;
  const [owner, repo] = location.pathname.split('/').filter(Boolean);
  if (!owner || !repo) return null;
  if (RESERVED.has(owner.toLowerCase())) return null;
  if (repo.includes('.')) return null;
  return { owner, repo };
}

export function isLikelyRepoPage(location: Location = window.location): boolean {
  const repo = parseRepoFromLocation(location);
  if (!repo) return false;
  const parts = location.pathname.split('/').filter(Boolean);
  return parts.length >= 2;
}
