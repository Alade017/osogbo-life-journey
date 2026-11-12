import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroupChats, type GroupFriend } from "@/components/game/GroupChats";

const service = vi.hoisted(() => ({
  fetchSocialGroups: vi.fn(),
  fetchSocialGroupMessages: vi.fn(),
  createSocialGroup: vi.fn(),
  sendSocialGroupMessage: vi.fn(),
  leaveSocialGroup: vi.fn(),
  setGroupPrefs: vi.fn(),
  toggleGroupReaction: vi.fn(),
  getGroupMediaUrl: vi.fn(),
  sendGroupVoice: vi.fn(),
  sendGroupPicture: vi.fn(),
  GROUP_REACTIONS: ["👍", "❤️", "😂", "😮", "🙏"],
}));

vi.mock("@/lib/social-groups", () => service);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const friends: GroupFriend[] = [
  { character_id: "friend-1", player_name: "Tunde" },
  { character_id: "friend-2", player_name: "Ife" },
];

function renderGroups() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GroupChats friends={friends} />
    </QueryClientProvider>,
  );
}

describe("group chats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.fetchSocialGroups.mockResolvedValue([]);
    service.createSocialGroup.mockResolvedValue({ id: "group-9", name: "Market crew" });
  });

  it("shows an empty state, then opens the create form", async () => {
    renderGroups();
    expect(await screen.findByText(/No groups yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New group" }));
    expect(screen.getByRole("button", { name: "Create group" })).toBeDisabled();
  });

  it("creates a group only with a name and at least one friend", async () => {
    renderGroups();
    await screen.findByText(/No groups yet/i);
    fireEvent.click(screen.getByRole("button", { name: "New group" }));

    const create = screen.getByRole("button", { name: "Create group" });
    fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: "  Market crew " } });
    expect(create).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Tunde" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Ife" }));
    expect(create).toBeEnabled();
    fireEvent.click(create);

    await waitFor(() =>
      expect(service.createSocialGroup).toHaveBeenCalledWith("Market crew", [
        "friend-1",
        "friend-2",
      ]),
    );
  });

  it("lists existing groups with their last message", async () => {
    service.fetchSocialGroups.mockResolvedValue([
      {
        id: "group-1",
        name: "Market crew",
        memberCount: 3,
        memberNames: ["Me", "Tunde", "Ife"],
        lastBody: "See you at the market",
        lastMessageAt: "2026-11-10T02:00:00Z",
      },
    ]);
    renderGroups();
    expect(await screen.findByText("Market crew")).toBeInTheDocument();
    expect(screen.getByText("See you at the market")).toBeInTheDocument();
  });

  it("pins and mutes a group through the server preference", async () => {
    service.fetchSocialGroups.mockResolvedValue([
      {
        id: "group-1",
        name: "Market crew",
        memberCount: 3,
        memberNames: ["Me", "Tunde", "Ife"],
        lastBody: null,
        lastMessageAt: "2026-11-10T02:00:00Z",
        pinned: false,
        muted: false,
      },
    ]);
    service.setGroupPrefs.mockResolvedValue({ pinned: true, muted: false });
    renderGroups();
    fireEvent.click(await screen.findByRole("button", { name: "Pin Market crew" }));
    await waitFor(() => expect(service.setGroupPrefs).toHaveBeenCalledWith("group-1", true, false));
  });

  it("shows a muted group with its unmute control", async () => {
    service.fetchSocialGroups.mockResolvedValue([
      {
        id: "group-2",
        name: "Quiet",
        memberCount: 2,
        memberNames: ["Me", "Ife"],
        lastBody: "Hi",
        lastMessageAt: "2026-11-10T02:00:00Z",
        pinned: false,
        muted: true,
      },
    ]);
    renderGroups();
    expect(await screen.findByRole("button", { name: "Unmute Quiet" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
