import { describe, expect, it } from "vitest";
import {
  OSOGBO_CALENDAR,
  formatCalendarDate,
  lagosDateKey,
  upcomingCalendarEvents,
} from "@/lib/osogbo-calendar";

describe("real Osogbo calendar", () => {
  it("only lists dated events with a source page", () => {
    for (const event of OSOGBO_CALENDAR) {
      expect(event.startsOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(event.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it("returns upcoming events soonest first and skips past ones", () => {
    const fromSecondDay = upcomingCalendarEvents("2027-08-03", 10).map((e) => e.startsOn);
    expect(fromSecondDay).toEqual(["2027-08-03", "2027-08-04", "2027-08-04"]);
    expect(upcomingCalendarEvents("2027-08-05")).toEqual([]);
    expect(upcomingCalendarEvents("2026-10-14", 1)[0]?.startsOn).toBe("2027-08-02");
  });

  it("uses the Lagos calendar day, not the device's", () => {
    // 23:30 UTC on 1 Aug is already 2 Aug in Lagos (UTC+1).
    expect(lagosDateKey(new Date("2027-08-01T23:30:00Z"))).toBe("2027-08-02");
    expect(lagosDateKey(new Date("2027-08-01T22:30:00Z"))).toBe("2027-08-01");
  });

  it("formats dates for Nigerian readers", () => {
    expect(formatCalendarDate("2027-08-02")).toMatch(/2 Aug 2027/);
  });
});
