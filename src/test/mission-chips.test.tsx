import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MissionChips } from "@/components/game/MissionChips";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: rows }),
}));
const rows = [
  {
    id: "mission-1",
    status: "in_progress",
    progress: 4,
    mission: {
      title: "Visit the buka",
      description: "Find a food spot in your district.",
      target: 10,
      reward_money: 500,
      reward_xp: 15,
    },
  },
  {
    id: "mission-done",
    status: "completed",
    progress: 10,
    mission: {
      title: "Completed mission",
      description: "Already done.",
      target: 10,
      reward_money: 100,
      reward_xp: 0,
    },
  },
];

vi.mock("@/lib/game", () => ({
  q: { missions: () => ({ queryKey: ["missions"] }) },
  formatNaira: (amount: number) => `₦${amount.toLocaleString("en-NG")}`,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe("map mission chips", () => {
  it("shows only active persisted missions and expands to its progress and mission page", () => {
    render(<MissionChips />);

    expect(screen.getByText("Visit the buka")).toBeInTheDocument();
    expect(screen.queryByText("Completed mission")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Visit the buka"));
    expect(screen.getByRole("meter", { name: "Visit the buka progress" })).toHaveAttribute(
      "aria-valuenow",
      "4",
    );
    expect(screen.getByRole("link", { name: /View missions/ })).toHaveAttribute(
      "href",
      "/missions",
    );
  });
});
