import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { moodLabel } from "@/lib/profile-service";
import { ProfilePage } from "@/routes/_authenticated/_game/profile";

// The 3D preview needs WebGL and ResizeObserver, which jsdom does not provide.
vi.mock("@/components/3d/CharacterPreview", () => ({
  CharacterPreview: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}));

vi.mock("@/components/game/CharacterWardrobePanel", () => ({
  CharacterWardrobePanel: () => <div aria-label="Character wardrobe" role="region" />,
}));

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

  it("progressively discloses badges while retaining their earned summary", () => {
    render(<ProfilePage />);
    const heading = screen.getByRole("heading", { name: "Badges" });
    const summary = heading.closest("summary");
    const disclosure = summary?.closest("details");

    expect(summary).not.toBeNull();
    expect(disclosure).not.toBeNull();
    expect(disclosure).not.toHaveAttribute("open");
    expect(screen.getByText("0 / 6 earned")).toBeInTheDocument();

    fireEvent.click(summary!);
    expect(disclosure).toHaveAttribute("open");
    fireEvent.click(summary!);
    expect(disclosure).not.toHaveAttribute("open");
  });

  it("renders current player data and the wardrobe entry point", () => {
    render(<ProfilePage />);
    expect(screen.getByRole("heading", { name: "Ayo" })).toBeInTheDocument();
    expect(screen.getByText("₦12,000")).toBeInTheDocument();
    expect(screen.getByText(/Designer/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Badges" })).toBeInTheDocument();
    expect(screen.getByText("0 / 6 earned")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Character wardrobe/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /level/i })).toBeInTheDocument();
  });
});
