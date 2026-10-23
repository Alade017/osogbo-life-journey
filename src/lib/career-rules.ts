// Display helpers only. PostgreSQL remains authoritative for rewards, steps, promotions and mood.
export const CAREER_MOOD_MIN = 0;
export const CAREER_MOOD_MAX = 100;
export const CAREER_SHIFT_STEPS = 3;
export function clampCareerMood(score: number): number {
  if (!Number.isFinite(score)) return 50;
  return Math.min(CAREER_MOOD_MAX, Math.max(CAREER_MOOD_MIN, Math.round(score)));
}
export function applyCareerMoodDelta(score: number, delta: number): number {
  return clampCareerMood(clampCareerMood(score) + delta);
}
export function nextCareerStep(stepsCompleted: number, stepsRequired: number): number | null {
  if (!Number.isInteger(stepsCompleted) || !Number.isInteger(stepsRequired)) return null;
  if (stepsCompleted < 0 || stepsRequired < 1 || stepsCompleted >= stepsRequired) return null;
  return stepsCompleted + 1;
}
export function canPromote(level: number, shifts: number, performance: number, requiredShifts: number): boolean {
  return level >= 1 && level < 3 && shifts >= requiredShifts && performance >= requiredShifts;
}
