import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CityNeedsDock } from "@/components/game/CityNeedsDock";

const queryData = vi.hoisted(() => ({ character: null as { thirst: number } | null }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "character" ? queryData.character : null,
  }),
}));
vi.mock("@/lib/game", () => ({
  q: {
    character: () => ({ queryKey: ["character"] }),
    equipment: () => ({ queryKey: ["equipment"] }),
  },
}));
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
    expect(summary).toHaveAttribute("aria-label", "Show character needs including thirst");
    const compactItems = container.querySelectorAll(".city-needs-mini-item");
    expect(compactItems).toHaveLength(6);
    compactItems.forEach((item) => {
      expect(item.querySelector("svg")).not.toBeNull();
      expect(item).toHaveAttribute("title");
      expect(item.textContent).toBe("");
      expect(item.querySelector(".city-needs-mini i")).not.toBeNull();
    });
    container.querySelectorAll(".city-needs-label").forEach((label) => {
      expect(label.querySelector("svg")).not.toBeNull();
      expect(label.textContent).toBe("");
    });
    fireEvent.click(summary!);
    expect(screen.getByRole("meter", { name: "Hunger" })).toHaveAttribute("aria-valuenow", "45");
    expect(screen.getByRole("meter", { name: "Social" })).toHaveAttribute("aria-valuenow", "20");
  });

  it("shows the thirst icon and saved satisfaction without a visible name", () => {
    queryData.character = { thirst: 30 };
    try {
      const { container } = render(<CityNeedsDock />);
      const thirst = container.querySelector('.city-needs-mini-item[title="Thirst satisfaction"]');
      expect(thirst?.querySelector("svg")).not.toBeNull();
      expect(thirst?.textContent).toBe("");
      expect(thirst?.querySelector("i")).toHaveStyle({ width: "70%" });
      expect(screen.getByRole("meter", { name: "Thirst satisfaction" })).toHaveAttribute(
        "aria-valuenow",
        "70",
      );
    } finally {
      queryData.character = null;
    }
  });
});
