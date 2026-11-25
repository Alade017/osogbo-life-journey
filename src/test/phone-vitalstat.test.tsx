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
    expect(screen.getAllByRole("meter")).toHaveLength(6);
    expect(screen.getByText("Everything is in a healthy range.")).toBeTruthy();
  });

  it("explains a critical need and what to do about it, worst first", () => {
    timeState.simulation.needs.hunger = 10;
    timeState.simulation.needs.energy = 30;
    render(<VitalStatApp />);
    expect(screen.getByText("2 needs are running low.")).toBeTruthy();
    const first = screen.getAllByRole("meter")[0];
    expect(first?.getAttribute("aria-label")).toBe("Hunger");
    expect(screen.getByText(/Eat a meal/)).toBeTruthy();
    expect(screen.queryByText(/Message a friend/)).toBeNull();
  });
});
