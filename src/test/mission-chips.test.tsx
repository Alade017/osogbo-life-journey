import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MissionChips } from "@/components/game/MissionChips";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [
      {
        id: "m1",
        status: "in_progress",
        progress: 1,
        mission: {
          title: "Market errands",
          target: 4,
          description: "Visit the market",
          reward_money: 20,
          reward_xp: 2,
        },
      },
      {
        id: "m2",
        status: "in_progress",
        progress: 0,
        mission: {
          title: "Find a book",
          target: 1,
          description: "Visit the library",
          reward_money: 10,
          reward_xp: 1,
        },
      },
    ],
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/game", () => ({
  q: { missions: () => ({ queryKey: ["missions"] }) },
  formatNaira: (amount: number) => `₦${amount}`,
}));

describe("MissionChips", () => {
  it("keeps the map overlay to one mission and explains the additional missions", () => {
    render(<MissionChips />);
    expect(screen.getByText("Market errands")).toBeInTheDocument();
    expect(screen.queryByText("Find a book")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View 1 other active mission" })).toHaveAttribute(
      "href",
      "/missions",
    );
  });
});
