// Pure party rules shared by the Party screen and tests.
// The database is the authority: these helpers only mirror its numbers for display.

export const PARTY_MOOD_MIN = 0;
export const PARTY_MOOD_MAX = 100;
export const PARTY_MOOD_START = 50;
export const DANCE_COOLDOWN_SECONDS = 60;
export const CLUB_VISIT_HOURS = 2;
export const EVENT_LIVE_HOURS = 3;
export const EVENT_MAX_LEAD_HOURS = 24;

export function clampPartyMood(score: number): number {
  if (!Number.isFinite(score)) return PARTY_MOOD_START;
  return Math.min(PARTY_MOOD_MAX, Math.max(PARTY_MOOD_MIN, Math.round(score)));
}

export function applyPartyMoodDelta(score: number, delta: number): number {
  return clampPartyMood(clampPartyMood(score) + delta);
}

export function partyMoodLabel(score: number): string {
  const value = clampPartyMood(score);
  if (value >= 80) return "Buzzing";
  if (value >= 60) return "Happy";
  if (value >= 40) return "Relaxed";
  if (value >= 20) return "Flat";
  return "Low";
}

/** Seconds left before the player may dance again (0 when ready). */
export function danceCooldownRemaining(lastDanceAt: string | null, now: Date): number {
  if (!lastDanceAt) return 0;
  const elapsedMs = now.getTime() - new Date(lastDanceAt).getTime();
  const remainingMs = DANCE_COOLDOWN_SECONDS * 1000 - elapsedMs;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

export type EventWindow = "scheduled" | "live" | "ended" | "cancelled";

export function eventWindow(
  event: { status: string; starts_at: string; ends_at: string },
  now: Date,
): EventWindow {
  if (event.status === "cancelled") return "cancelled";
  if (now.getTime() < new Date(event.starts_at).getTime()) return "scheduled";
  if (now.getTime() < new Date(event.ends_at).getTime()) return "live";
  return "ended";
}

export function requirementRemaining(req: { quantity: number; fulfilled_count: number }): number {
  return Math.max(0, req.quantity - req.fulfilled_count);
}

/** Starts must be in the future and within 24 hours. */
export function validEventStart(startsAt: Date, now: Date): string | null {
  if (Number.isNaN(startsAt.getTime())) return "Choose a valid start time.";
  if (startsAt.getTime() <= now.getTime()) return "The event must start in the future.";
  if (startsAt.getTime() > now.getTime() + EVENT_MAX_LEAD_HOURS * 3600_000) {
    return "Events can start up to 24 hours from now.";
  }
  return null;
}
