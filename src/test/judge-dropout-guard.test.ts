import { describe, it, expect } from 'vitest';
import { shouldTriggerJudgeDropout } from '@/lib/judge-dropout-guard';

describe('shouldTriggerJudgeDropout', () => {
  it('returns true when profile.is_judge is true', () => {
    expect(shouldTriggerJudgeDropout({ is_judge: true })).toBe(true);
  });

  it('returns false when profile.is_judge is false', () => {
    expect(shouldTriggerJudgeDropout({ is_judge: false })).toBe(false);
  });

  it('returns false when profile.is_judge is null', () => {
    expect(shouldTriggerJudgeDropout({ is_judge: null })).toBe(false);
  });

  it('returns false when profile.is_judge is undefined', () => {
    expect(shouldTriggerJudgeDropout({ is_judge: undefined })).toBe(false);
  });

  it('returns false when profile is null', () => {
    expect(shouldTriggerJudgeDropout(null)).toBe(false);
  });

  it('returns false when profile is undefined', () => {
    expect(shouldTriggerJudgeDropout(undefined)).toBe(false);
  });
});
