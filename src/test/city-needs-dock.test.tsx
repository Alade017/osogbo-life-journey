import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CityNeedsDock } from "@/components/game/CityNeedsDock";

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: null }) }));
vi.mock("@/lib/game", () => ({ q: { character: () => ({ queryKey: ["character"] }) } }));
vi.mock("@/components/game/Avatar", () => ({ Avatar: () => <span>Avatar</span> }));
vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => ({
    simulation: {
      needs: { hunger: 45, energy: 78, hygiene: 82, bladder: 60, fun: 70, social: 20 },
    },
  }),
}));

describe("floating character needs", () => {
  it("starts compact and expands to accessible live need meters", () => {
    const { container } = render(<CityNeedsDock />);
    const details = container.querySelector("details");
    const summary = container.querySelector("summary");
    expect(details).not.toHaveAttribute("open");
    expect(summary).toHaveAttribute("aria-label", "Show character needs");
    fireEvent.click(summary!);
    expect(screen.getByRole("meter", { name: "Hunger" })).toHaveAttribute("aria-valuenow", "45");
    expect(screen.getByRole("meter", { name: "Social" })).toHaveAttribute("aria-valuenow", "20");
  });
});
