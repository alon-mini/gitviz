import { describe, expect, it } from 'vitest';
import { parseLinkHeader, getPageFromUrl } from '../../src/utils/link-header';

describe('parseLinkHeader', () => {
  it('extracts rel links', () => {
    const parsed = parseLinkHeader('<https://api.github.com/repositories/1/stargazers?page=2>; rel="next", <https://api.github.com/repositories/1/stargazers?page=4>; rel="last"');
    expect(getPageFromUrl(parsed.next)).toBe(2);
    expect(getPageFromUrl(parsed.last)).toBe(4);
  });
});
