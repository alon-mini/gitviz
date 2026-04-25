export type LocalMeta = {
  retryAfterByRepo?: Record<string, number>;
  githubToken?: string;
};

const META_KEY = 'githubRepoVisibilityMeta';

export async function getLocalMeta(): Promise<LocalMeta> {
  const result = await chrome.storage.local.get(META_KEY);
  return (result[META_KEY] as LocalMeta | undefined) ?? {};
}

export async function setRepoRetryAfter(repoKey: string, timestampMs: number): Promise<void> {
  const meta = await getLocalMeta();
  await chrome.storage.local.set({
    [META_KEY]: {
      ...meta,
      retryAfterByRepo: {
        ...(meta.retryAfterByRepo ?? {}),
        [repoKey]: timestampMs
      }
    }
  });
}

export async function getRepoRetryAfter(repoKey: string): Promise<number | null> {
  const meta = await getLocalMeta();
  const value = meta.retryAfterByRepo?.[repoKey];
  return typeof value === 'number' ? value : null;
}

export async function getGitHubToken(): Promise<string | null> {
  const meta = await getLocalMeta();
  return typeof meta.githubToken === 'string' && meta.githubToken.trim() ? meta.githubToken.trim() : null;
}
