import { describe, expect, it } from 'vitest';
import { median, buildResponsiveness } from '../../src/metrics/responsiveness';

describe('responsiveness metrics', () => {
  it('calculates median values', () => {
    expect(median([1, 3, 5])).toBe(3);
    expect(median([1, 3])).toBe(2);
    expect(median([])).toBeNull();
  });

  it('filters pull requests from issue sample', () => {
    const result = buildResponsiveness(
      [{ created_at: '2026-01-01T00:00:00Z', merged_at: '2026-01-03T00:00:00Z' }],
      [
        { closed_at: '2026-01-01T00:00:00Z' },
        { closed_at: '2026-01-01T00:00:00Z', pull_request: {} }
      ]
    );
    expect(result.mergedPrCount).toBe(1);
    expect(result.medianMergeHours).toBe(48);
    expect(result.closedIssueCount).toBe(1);
    expect(result.issueSampleSize).toBe(2);
  });
});
