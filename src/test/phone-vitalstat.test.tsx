import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VitalStatApp } from "@/components/game/phone/VitalStatApp";

const timeState = {
  ready: true,
  simulation: {
    needs: { hunger: 90, energy: 90, hygiene: 90, bladder: 90, fun: 90, social: 90 },
  },
};

vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => timeState,
}));

describe("VitalStat", () => {
  it("lists all six needs with their values", () => {
    render(<VitalStatApp />);
    expect(screen.getAllByRole("meter")).toHaveLength(7);
    expect(screen.getByText("Everything is in a healthy range.")).toBeTruthy();
  });

  it("shows mood as the average of fun and social", () => {
    timeState.simulation.needs.hunger = 90;
    timeState.simulation.needs.energy = 90;
    timeState.simulation.needs.fun = 20;
    timeState.simulation.needs.social = 60;
    render(<VitalStatApp />);
    const mood = screen.getByRole("meter", { name: "Mood" });
    expect(mood.getAttribute("aria-valuenow")).toBe("40");
  });

  it("explains a critical need and what to do about it, worst first", () => {
    timeState.simulation.needs = {
      ...timeState.simulation.needs,
      fun: 90,
      social: 90,
      hunger: 10,
      energy: 30,
    };
    render(<VitalStatApp />);
    expect(screen.getByText("2 needs are running low.")).toBeTruthy();
    const first = screen.getAllByRole("meter")[1];
    expect(first?.getAttribute("aria-label")).toBe("Hunger");
    expect(screen.getByText(/Eat a meal/)).toBeTruthy();
    expect(screen.queryByText(/Message a friend/)).toBeNull();
  });
});
