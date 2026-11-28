import { afterEach, describe, expect, it, vi } from "vitest";
import { simulationSessionForThisTab } from "@/components/game/GameTimeProvider";

function navigationType(type: string) {
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([
    { type } as unknown as PerformanceNavigationTiming,
  ]);
}

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("simulation session per tab", () => {
  it("keeps the same session across a reload so the page does not wait out the lock", () => {
    navigationType("navigate");
    const first = simulationSessionForThisTab();
    navigationType("reload");
    expect(simulationSessionForThisTab()).toBe(first);
  });

  it("gives a newly opened tab its own session so two live tabs are still refused", () => {
    navigationType("navigate");
    const first = simulationSessionForThisTab();
    navigationType("navigate");
    expect(simulationSessionForThisTab()).not.toBe(first);
  });
});
