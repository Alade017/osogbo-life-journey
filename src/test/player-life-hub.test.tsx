import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PlayerState } from "@/lib/player-state";

const queryData = {
  character: { occupation_preference: "preferred-job" },
  playerSkills: [{ id: "skill-1", skill_slug: "cooking", level: 2, experience: 45 }],
  npcRelationships: [{ id: "relationship-1", npc_id: "npc-1", friendship: 12, trust: 9 }],
  npcs: [{ id: "npc-1", name: "Abeni" }],
  jobs: [
    { id: "job-1", slug: "current-job", name: "Shop Assistant", description: "Works at a local shop." },
    { id: "job-2", slug: "preferred-job", name: "Teacher", description: "Preferred career path." },
  ],
  myJobs: [{ id: "employment-1", job_id: "job-1", is_current: true, career_level: 3, times_performed: 8 }],
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: [keyof typeof queryData] }) => ({
    data: queryData[options.queryKey[0]],
  }),
}));
vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => ({
    ready: true,
    simulation: { needs: { hunger: 80, energy: 75, hygiene: 70, bladder: 80, fun: 65, social: 60 } },
  }),
}));
vi.mock("@/hooks/use-missions", () => ({
  useMissions: () => ({
    data: [{
      id: "player-mission-1",
      status: "in_progress",
      completed_at: null,
      claimed_at: null,
      mission: { title: "Visit the market", description: "Explore the local market." },
    }],
  }),
}));
vi.mock("@/lib/game", () => ({
  q: {
    character: () => ({ queryKey: ["character"] }),
    playerSkills: () => ({ queryKey: ["playerSkills"] }),
    npcRelationships: () => ({ queryKey: ["npcRelationships"] }),
    npcs: () => ({ queryKey: ["npcs"] }),
    jobs: () => ({ queryKey: ["jobs"] }),
    myJobs: () => ({ queryKey: ["myJobs"] }),
  },
}));
vi.mock("@/components/3d/CharacterPreview", () => ({
  CharacterPreview: () => <div data-testid="character-preview" />,
}));
vi.mock("@/routes/_authenticated/_game/settings", () => ({
  SettingsPage: () => <div>Embedded settings content</div>,
}));

import { PlayerLifeHub } from "@/components/game/PlayerLifeHub";

const player = {
  id: "player-1",
  name: "Malik",
  level: 4,
  cash: 2500,
  reputation: 18,
  location: { name: "Olaiya" },
  gender: "male",
  avatar: {},
  equipment: [],
} as unknown as PlayerState;

afterEach(() => {
  vi.restoreAllMocks();
});

it("renders saved mission, skill, relationship, and current employment records", () => {
  render(<PlayerLifeHub player={player} open initialTab="profile" onClose={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Goals" }));
  expect(screen.getByText("Visit the market")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Skills" }));
  expect(screen.getByText("Cooking")).toBeInTheDocument();
  expect(screen.getByText("Level 2 · 45 XP")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "People" }));
  expect(screen.getByText("Abeni")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Career" }));
  expect(screen.getByText("Shop Assistant")).toBeInTheDocument();
  expect(screen.getByText("Career level 3")).toBeInTheDocument();
});

it("does not let the synthetic click after a downward drag undo sheet collapse", () => {
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  render(<PlayerLifeHub player={player} open initialTab="profile" onClose={vi.fn()} />);
  const handle = screen.getByRole("button", { name: "Expand player hub" });
  fireEvent.click(handle);
  expect(document.querySelector(".player-hub-sheet")).toHaveClass("is-expanded");

  fireEvent.pointerDown(handle, { pointerId: 1, clientY: 100 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 160 });
  fireEvent.pointerUp(handle, { pointerId: 1, clientY: 160 });
  fireEvent.click(handle);

  expect(document.querySelector(".player-hub-sheet")).not.toHaveClass("is-expanded");
});
