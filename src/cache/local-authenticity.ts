import type { RepositoryAuthenticityView } from '../background/messages';

type AuthenticityCacheRecord = {
  value: RepositoryAuthenticityView;
  savedAt: number;
};

type AuthenticityCacheStore = Record<string, AuthenticityCacheRecord>;

const AUTHENTICITY_CACHE_KEY = 'githubRepoAuthenticityCache';

export async function getCachedAuthenticity(repoKey: string, maxAgeMs: number): Promise<{ record: AuthenticityCacheRecord; stale: boolean } | null> {
  const store = await getStore();
  const record = store[repoKey];
  if (!record) return null;
  return { record, stale: Date.now() - record.savedAt > maxAgeMs };
}

export async function putCachedAuthenticity(repoKey: string, value: RepositoryAuthenticityView): Promise<void> {
  const store = await getStore();
  await chrome.storage.local.set({
    [AUTHENTICITY_CACHE_KEY]: {
      ...store,
      [repoKey]: {
        value,
        savedAt: Date.now()
      }
    }
  });
}

async function getStore(): Promise<AuthenticityCacheStore> {
  const result = await chrome.storage.local.get(AUTHENTICITY_CACHE_KEY);
  return (result[AUTHENTICITY_CACHE_KEY] as AuthenticityCacheStore | undefined) ?? {};
}
