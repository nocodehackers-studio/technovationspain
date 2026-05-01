export interface JudgeDropoutProfile {
  is_judge: boolean | null | undefined;
}

export function shouldTriggerJudgeDropout(
  profile: JudgeDropoutProfile | null | undefined
): boolean {
  return Boolean(profile?.is_judge);
}
