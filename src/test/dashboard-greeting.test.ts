import { describe, expect, it } from "vitest";
import { dashboardGreeting } from "@/lib/dashboard-greeting";

describe("dashboard greeting", () => {
  it.each([
    [8, "Good morning"],
    [12, "Good afternoon"],
    [16, "Good afternoon"],
    [17, "Good evening"],
    [21, "Good evening"],
    [23, "Welcome back"],
    [3, "Welcome back"],
  ])("selects a greeting for game hour %i", (hour, expected) => {
    expect(dashboardGreeting(hour)).toBe(expected);
  });
});
