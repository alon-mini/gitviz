import type { StatusKind } from '../background/messages';

export type ApiResult<T> = {
  status: number;
  data: T | null;
  headers: Record<string, string>;
  ok: boolean;
  notModified: boolean;
  rateLimited: boolean;
  retryAfterSeconds?: number;
  error?: string;
};

export type CacheValidators = {
  etag?: string;
  lastModified?: string;
};

export async function githubGet<T>(url: string, validators?: CacheValidators, accept = 'application/vnd.github+json'): Promise<ApiResult<T>> {
  const headers = new Headers({
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28'
  });

  if (validators?.etag) headers.set('If-None-Match', validators.etag);
  if (validators?.lastModified) headers.set('If-Modified-Since', validators.lastModified);

  return githubFetch<T>(url, { headers });
}

export async function githubPost<T>(url: string, body: unknown, accept = 'application/vnd.github+json'): Promise<ApiResult<T>> {
  const headers = new Headers({
    Accept: accept,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28'
  });

  return githubFetch<T>(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function githubFetch<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, init);
    const responseHeaders = headersToRecord(response.headers);
    const retryAfter = response.headers.get('retry-after');
    const rateRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimited = response.status === 403 && rateRemaining === '0';

    if (response.status === 304) {
      return { status: 304, data: null, headers: responseHeaders, ok: true, notModified: true, rateLimited: false };
    }

    if (response.status === 204 || response.status === 202) {
      return { status: response.status, data: null, headers: responseHeaders, ok: response.ok, notModified: false, rateLimited };
    }

    const contentType = response.headers.get('content-type') ?? '';
    const data = contentType.includes('application/json') ? await response.json() : null;

    return {
      status: response.status,
      data: response.ok ? (data as T) : null,
      headers: responseHeaders,
      ok: response.ok,
      notModified: false,
      rateLimited,
      retryAfterSeconds: retryAfter ? Number.parseInt(retryAfter, 10) : undefined,
      error: response.ok ? undefined : extractError(data, response.status)
    };
  } catch (error) {
    return {
      status: 0,
      data: null,
      headers: {},
      ok: false,
      notModified: false,
      rateLimited: false,
      error: error instanceof Error ? error.message : 'Network request failed'
    };
  }
}

export function statusFromApiResult(result: ApiResult<unknown>): StatusKind {
  if (result.rateLimited) return 'rate_limited';
  if (result.status === 202 || result.status === 204) return 'partial';
  if (!result.ok) return 'error';
  return 'ok';
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

function extractError(data: unknown, status: number): string {
  if (typeof data === 'object' && data && 'message' in data && typeof data.message === 'string') {
    return data.message;
  }
  if (status === 404) return 'Not found';
  if (status === 403) return 'GitHub API request was forbidden or rate limited';
  return `GitHub API request failed (${status})`;
}
