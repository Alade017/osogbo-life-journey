import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_PINS,
  dashboardBadgeCounts,
  normalizeDashboardPins,
  visibleDashboardPins,
} from "@/lib/dashboard-pins";

describe("dashboard shortcuts", () => {
  it("uses the default shortcuts when no saved preference exists", () => {
    expect(normalizeDashboardPins(undefined)).toEqual(DEFAULT_DASHBOARD_PINS);
  });

  it("counts unread attention items by feature", () => {
    expect(
      dashboardBadgeCounts([
        { kind: "job_waiting", read_at: null },
        { kind: "rent_due", read_at: null },
        { kind: "friend_request", read_at: null },
        { kind: "mission_reward", read_at: "2026-10-17T10:00:00Z" },
      ]),
    ).toEqual({ jobs: 1, bank: 1, social: 1 });
  });

  it("drops the lowest priority shortcut instead of scrolling on narrow phones", () => {
    expect(visibleDashboardPins(DEFAULT_DASHBOARD_PINS, 320)).toEqual([
      "jobs",
      "bank",
      "map",
      "missions",
    ]);
  });

  it("keeps five shortcuts at regular phone widths", () => {
    expect(visibleDashboardPins(DEFAULT_DASHBOARD_PINS, 390)).toHaveLength(5);
  });
});
