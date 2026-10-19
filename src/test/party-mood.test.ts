import { describe, expect, it } from "vitest";
import {
  applyPartyMoodDelta,
  clampPartyMood,
  danceCooldownRemaining,
  eventWindow,
  partyMoodLabel,
  requirementRemaining,
  validEventStart,
} from "@/lib/party-mood";

describe("party mood", () => {
  it("caps and floors the 0-100 score", () => {
    expect(clampPartyMood(140)).toBe(100);
    expect(clampPartyMood(-12)).toBe(0);
    expect(applyPartyMoodDelta(98, 10)).toBe(100);
    expect(applyPartyMoodDelta(3, -10)).toBe(0);
    expect(applyPartyMoodDelta(50, 15)).toBe(65);
  });

  it("labels the score", () => {
    expect(partyMoodLabel(90)).toBe("Buzzing");
    expect(partyMoodLabel(50)).toBe("Relaxed");
    expect(partyMoodLabel(5)).toBe("Low");
  });
});

describe("dance cooldown", () => {
  const now = new Date("2026-10-19T12:00:00Z");

  it("is ready with no previous dance", () => {
    expect(danceCooldownRemaining(null, now)).toBe(0);
  });

  it("counts down for 60 seconds after a dance", () => {
    expect(danceCooldownRemaining("2026-10-19T11:59:30Z", now)).toBe(30);
    expect(danceCooldownRemaining("2026-10-19T11:58:59Z", now)).toBe(0);
  });
});

describe("event windows and requirements", () => {
  const event = {
    status: "scheduled",
    starts_at: "2026-10-19T13:00:00Z",
    ends_at: "2026-10-19T16:00:00Z",
  };

  it("moves from scheduled to live to ended", () => {
    expect(eventWindow(event, new Date("2026-10-19T12:00:00Z"))).toBe("scheduled");
    expect(eventWindow(event, new Date("2026-10-19T14:00:00Z"))).toBe("live");
    expect(eventWindow(event, new Date("2026-10-19T16:00:00Z"))).toBe("ended");
    expect(eventWindow({ ...event, status: "cancelled" }, new Date("2026-10-19T14:00:00Z"))).toBe(
      "cancelled",
    );
  });

  it("counts remaining requirement places without going negative", () => {
    expect(requirementRemaining({ quantity: 3, fulfilled_count: 1 })).toBe(2);
    expect(requirementRemaining({ quantity: 1, fulfilled_count: 1 })).toBe(0);
  });

  it("only allows starts within the next 24 hours", () => {
    const now = new Date("2026-10-19T12:00:00Z");
    expect(validEventStart(new Date("2026-10-19T11:00:00Z"), now)).toMatch(/future/);
    expect(validEventStart(new Date("2026-10-20T13:00:00Z"), now)).toMatch(/24 hours/);
    expect(validEventStart(new Date("2026-10-19T20:00:00Z"), now)).toBeNull();
  });
});
