import { describe, expect, it } from "vitest";
import {
  isPrayerDue,
  prayerWindowLabel,
  prayersFor,
  type WorshipPrayer,
} from "@/game/worship-schedule";

const MOSQUE = "osogbo-central-mosque";
const CHURCH = "oke-fia-community-church";
const dhuhr = prayersFor(MOSQUE).find((prayer) => prayer.id === "dhuhr") as WorshipPrayer;
const service = prayersFor(CHURCH)[0] as WorshipPrayer;

describe("worship schedule", () => {
  it("gives the mosque five daily prayers", () => {
    expect(prayersFor(MOSQUE).map((prayer) => prayer.id)).toEqual([
      "fajr",
      "dhuhr",
      "asr",
      "maghrib",
      "isha",
    ]);
  });

  it("holds the church's service on Wednesday, Thursday, Friday and Sunday only", () => {
    expect(service.weekdays).toEqual([2, 3, 4, 6]);
    for (const day of [0, 1, 5]) expect(isPrayerDue(service, day, 600)).toBe(false);
    for (const day of [2, 3, 4, 6]) expect(isPrayerDue(service, day, 600)).toBe(true);
  });

  it("opens each mosque prayer for its hour and no other", () => {
    expect(isPrayerDue(dhuhr, 3, 779)).toBe(false);
    expect(isPrayerDue(dhuhr, 3, 780)).toBe(true);
    expect(isPrayerDue(dhuhr, 3, 839)).toBe(true);
    expect(isPrayerDue(dhuhr, 3, 840)).toBe(false);
  });

  it("labels the windows for the visitor", () => {
    expect(prayerWindowLabel(dhuhr)).toBe("13:00–14:00");
    expect(prayerWindowLabel(service)).toBe("Any time on service days");
  });

  it("has no prayers at a place that is not a worship place", () => {
    expect(prayersFor("town-market")).toEqual([]);
  });
});
