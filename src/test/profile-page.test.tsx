import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { moodLabel } from "@/lib/profile-service";
import { ProfilePage } from "@/routes/_authenticated/_game/profile";

const character = {
  id: "character-1",
  user_id: "user-1",
  name: "Ayo",
  appearance: {},
  gender: "nonbinary",
  level: 3,
  xp: 225,
  health: 90,
  energy: 68,
  hunger: 20,
  thirst: 10,
  reputation: 42,
  wanted_level: 0,
  happiness: 82,
  stress: 12,
  personality: "Friendly",
  occupation_preference: "designer",
  current_location_id: "location-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

vi.mock("@tanstack/react-router", () => ({
  useRouteContext: () => ({ user: { id: "user-1" } }),
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children }: { children: React.ReactNode }) => <a href="#test">{children}</a>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    const key = queryKey[0];
    if (key === "character") return { data: character, isLoading: false, isError: false };
    if (key === "wallet") return { data: { balance: 12000 }, isLoading: false, isError: false };
    if (key === "jobs") return { data: [{ slug: "designer", name: "Designer" }] };
    if (key === "locations") return { data: [{ id: "location-1", name: "Central district" }] };
    if (key === "equipment") return { data: [{ slot: "top" }] };
    if (key === "missions") return { data: [] };
    return { data: [] };
  },
}));

vi.mock("@/lib/game", () => ({
  q: {
    character: () => ({ queryKey: ["character"] }),
    wallet: () => ({ queryKey: ["wallet"] }),
    jobs: () => ({ queryKey: ["jobs"] }),
    locations: () => ({ queryKey: ["locations"] }),
    equipment: () => ({ queryKey: ["equipment"] }),
    missions: () => ({ queryKey: ["missions"] }),
  },
  formatNaira: (value: number) => `₦${value.toLocaleString("en-NG")}`,
  xpProgress: () => ({ into: 25, needed: 100, toNextLevel: 75 }),
}));

vi.mock("@/lib/seo", () => ({ pageMeta: vi.fn() }));

describe("profile page", () => {
  it("uses the saved happiness and stress values", () => {
    expect(moodLabel(90, 10)).toBe("Thriving");
    expect(moodLabel(90, 80)).toBe("Stressed");
    expect(moodLabel(20, 10)).toBe("Needs care");
  });

  it("renders current player data and the outfit entry point", () => {
    render(<ProfilePage />);
    expect(screen.getByRole("heading", { name: "Ayo" })).toBeInTheDocument();
    expect(screen.getByText("₦12,000")).toBeInTheDocument();
    expect(screen.getAllByText("Designer")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Edit outfit/i })).toBeInTheDocument();
    expect(document.querySelector('[data-equipment-slot="top"]')).toBeInTheDocument();
  });
});
