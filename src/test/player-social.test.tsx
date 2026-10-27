import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerSocial, MessageList, ChatComposer } from "@/components/game/PlayerSocial";

const mocks = vi.hoisted(() => ({
  getPlayerSocialOverview: vi.fn(),
  searchPlayerProfiles: vi.fn(),
  getPlayerProfile: vi.fn(),
  sendFriendRequest: vi.fn(),
  respondToFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  blockPlayer: vi.fn(),
  unblockPlayer: vi.fn(),
  openPlayerConversation: vi.fn(),
  getSocialMessages: vi.fn(),
  sendSocialMessage: vi.fn(),
  reportPlayer: vi.fn(),
  subscribeToSocialMessages: vi.fn(),
  subscribeToFriendRequests: vi.fn(),
  subscribeToStatusPosts: vi.fn(),
  getFriendStatusPosts: vi.fn(),
  createPlayerStatus: vi.fn(),
  deletePlayerStatus: vi.fn(),
  leaveSocialChannel: vi.fn(),
  getThreadSummaries: vi.fn(),
  runThreadAction: vi.fn(),
  flushThreadActionQueue: vi.fn(),
  subscribeToInboxSummaries: vi.fn(),
}));

vi.mock("@/components/game/Avatar", () => ({ Avatar: () => <span>Avatar</span> }));
vi.mock("@/lib/game", () => ({
  q: {
    character: () => ({
      queryKey: ["character"],
      queryFn: async () => ({ id: "character-ade", current_location_id: "area-olaiya" }),
    }),
    locations: () => ({
      queryKey: ["locations"],
      queryFn: async () => [{ id: "area-olaiya", name: "Olaiya" }],
    }),
  },
}));
vi.mock("@/lib/player-social-service", () => mocks);
vi.mock("@/lib/thread-preferences", () => mocks);

function renderSocial(props: ComponentProps<typeof PlayerSocial> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PlayerSocial {...props} />
    </QueryClientProvider>,
  );
}

describe("real-player social panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlayerSocialOverview.mockResolvedValue({
      friends: [],
      incoming: [],
      outgoing: [],
      blocked: [],
      conversations: [],
    });
    mocks.searchPlayerProfiles.mockResolvedValue([
      {
        character_id: "character-ayo",
        player_name: "Ayo",
        gender: "female",
        appearance: {},
        level: 3,
        relationship: "none",
        request_id: null,
      },
    ]);
    mocks.getSocialMessages.mockResolvedValue([]);
    mocks.getFriendStatusPosts.mockResolvedValue([]);
    mocks.createPlayerStatus.mockResolvedValue({ id: "status-1" });
    mocks.deletePlayerStatus.mockResolvedValue({ ok: true });
    mocks.sendFriendRequest.mockResolvedValue({ status: "request_sent" });
    mocks.sendSocialMessage.mockResolvedValue({ id: "message-1" });
    mocks.subscribeToSocialMessages.mockReturnValue({});
    mocks.subscribeToFriendRequests.mockReturnValue({});
    mocks.subscribeToStatusPosts.mockReturnValue({});
    mocks.leaveSocialChannel.mockResolvedValue(undefined);
    mocks.getThreadSummaries.mockResolvedValue([]);
    mocks.runThreadAction.mockResolvedValue({ ok: true });
    mocks.flushThreadActionQueue.mockResolvedValue({ sent: 0, remaining: 0 });
    mocks.subscribeToInboxSummaries.mockReturnValue({ channel: {}, clear: vi.fn() });
  });

  it("filters the phone inbox by player name", async () => {
    mocks.getPlayerSocialOverview.mockImplementation(async () => ({
      friends: [],
      incoming: [],
      outgoing: [],
      blocked: [],
      conversations: [
        { id: "conversation-ayo", character_id: "character-ayo", player_name: "Ayo" },
        { id: "conversation-bola", character_id: "character-bola", player_name: "Bola" },
      ],
    }));

    renderSocial({ initialTab: "messages", phoneMode: true });
    expect(
      await screen.findByRole("button", { name: /Ayo/ }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search chats" }), {
      target: { value: "Bol" },
    });
    expect(screen.getByRole("button", { name: /Bola/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ayo/ })).not.toBeInTheDocument();
  }, 20_000);

  it("searches public player profiles and sends a friend request", async () => {
    renderSocial();
    fireEvent.change(screen.getByLabelText("Search player names"), {
      target: { value: "Ayo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(await screen.findByText("Ayo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add friend" }));
    await waitFor(() => expect(mocks.sendFriendRequest).toHaveBeenCalledWith("character-ayo"));
  });

  it("sends area messages through the persisted social service", async () => {
    renderSocial();
    fireEvent.click(screen.getByRole("tab", { name: "Messages" }));
    const composer = await screen.findByLabelText("Write an area message");
    await waitFor(() => expect(composer).not.toBeDisabled());
    fireEvent.change(composer, { target: { value: "Hello, neighbours!" } });
    expect(composer).toHaveValue("Hello, neighbours!");
    fireEvent.submit(composer.closest("form")!);
    await waitFor(() => expect(mocks.sendSocialMessage).toHaveBeenCalled());
    expect(mocks.sendSocialMessage.mock.calls[0]?.[0]).toEqual({
      channel: "area",
      body: "Hello, neighbours!",
      locationId: "area-olaiya",
    });
  });

  it("shows private conversations in phone mode and sends through the existing service", async () => {
    mocks.getPlayerSocialOverview.mockResolvedValue({
      friends: [],
      incoming: [],
      outgoing: [],
      blocked: [],
      conversations: [
        { id: "conversation-ayo", character_id: "character-ayo", player_name: "Ayo" },
      ],
    });
    renderSocial({ initialTab: "messages", phoneMode: true });

    expect(await screen.findByRole("button", { name: /Ayo/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ayo/ }));
    const composer = await screen.findByLabelText("Message Ayo");
    fireEvent.change(composer, { target: { value: "See you at the market" } });
    fireEvent.submit(composer.closest("form")!);

    await waitFor(() =>
      expect(mocks.sendSocialMessage.mock.calls[0]?.[0]).toEqual({
        channel: "private",
        body: "See you at the market",
        conversationId: "conversation-ayo",
      }),
    );
    expect(screen.getByRole("button", { name: "Back to chats" })).toBeInTheDocument();
  });
});

describe("phone message interactions", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
  });
  const messages = Array.from({ length: 120 }, (_, index) => ({
    id: "message-" + index,
    sender_character_id: "me",
    sender_name: "Me",
    channel: "private" as const,
    location_id: null,
    conversation_id: "thread",
    body: "Message " + index,
    message_type: "text" as const,
    voice_duration_ms: null,
    reply_to_message_id: null,
    reply: null,
    created_at: "2026-10-18T10:00:00Z",
  }));
  it("windows long histories and reaches older and newer messages", () => {
    const { container } = render(
      <MessageList
        messages={messages}
        ownCharacterId="me"
        phoneMode
        onReply={() => {}}
        onReport={() => {}}
      />,
    );
    expect(container.querySelectorAll("[data-message-id]").length).toBeLessThan(40);
    const history = screen.getByRole("list", { name: "Message history" });
    fireEvent.scroll(history, { target: { scrollTop: 17500 } });
    expect(screen.getByText("Message 119")).toBeInTheDocument();
    fireEvent.scroll(history, { target: { scrollTop: 0 } });
    expect(screen.getByText("Message 0")).toBeInTheDocument();
  });
  it("persists individual stars and filters the chat", () => {
    render(
      <MessageList
        messages={messages.slice(0, 2)}
        ownCharacterId="me"
        phoneMode
        onReply={() => {}}
        onReport={() => {}}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Star" })[0]!);
    expect(JSON.parse(localStorage.getItem("osun-message-stars:me")!)).toEqual(["message-0"]);
    fireEvent.click(screen.getByRole("button", { name: "Starred messages on this device" }));
    expect(screen.getByText("Message 0")).toBeInTheDocument();
    expect(screen.queryByText("Message 1")).not.toBeInTheDocument();
  });
  it("keeps the draft after a send failure", async () => {
    render(
      <ChatComposer
        label="Message Ayo"
        phoneMode
        onSend={async () => {
          throw new Error("offline");
        }}
      />,
    );
    const input = screen.getByLabelText("Message Ayo");
    fireEvent.change(input, { target: { value: "Keep my draft" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(input).toHaveValue("Keep my draft");
  });
  it("sends the selected quote id and clears the reply only after confirmation", async () => {
    let confirm!: () => void;
    const send = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          confirm = resolve;
        }),
    );
    const cancel = vi.fn();
    render(
      <ChatComposer
        label="Message Ayo"
        phoneMode
        onSend={send}
        replyTo={messages[0]!}
        onCancelReply={cancel}
      />,
    );
    const input = screen.getByLabelText("Message Ayo");
    expect(screen.getByText("Reply to Me")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Quoted response" } });
    fireEvent.submit(input.closest("form")!);
    expect(send).toHaveBeenCalledWith("Quoted response", "message-0");
    expect(cancel).not.toHaveBeenCalled();
    expect(input).toBeDisabled();
    confirm();
    await waitFor(() => expect(input).toHaveValue(""));
    expect(cancel).toHaveBeenCalledOnce();
  });
});
