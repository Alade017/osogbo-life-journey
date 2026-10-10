import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Search, ShieldBan, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/game/Avatar";
import { Button } from "@/components/ui/button";
import { q } from "@/lib/game";
import {
  blockPlayer,
  cancelFriendRequest,
  getPlayerProfile,
  getPlayerSocialOverview,
  getSocialMessages,
  leaveSocialChannel,
  openPlayerConversation,
  removeFriend,
  reportPlayer,
  respondToFriendRequest,
  searchPlayerProfiles,
  sendFriendRequest,
  sendSocialMessage,
  subscribeToSocialMessages,
  unblockPlayer,
  type SocialMessage,
  type SocialPlayer,
  type SocialReportCategory,
} from "@/lib/player-social-service";

type Tab = "players" | "messages" | "friends";
type ReportTarget = { id: string; name: string; messageId?: string };
type ActiveChat = { conversationId: string; characterId: string; name: string };

const REPORT_OPTIONS: Array<{ value: SocialReportCategory; label: string }> = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

function PlayerAvatar({ player }: { player: Pick<SocialPlayer, "appearance" | "gender"> }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-leaf/10">
      <Avatar
        appearance={
          player.appearance && typeof player.appearance === "object" ? player.appearance : {}
        }
        gender={player.gender}
        size={38}
      />
    </span>
  );
}

function PlayerRow({
  player,
  action,
  secondaryAction,
  status,
}: {
  player: Pick<SocialPlayer, "character_id" | "player_name" | "appearance" | "gender" | "level">;
  action?: { label: string; run: () => void; disabled?: boolean };
  secondaryAction?: { label: string; run: () => void; disabled?: boolean };
  status?: string;
}) {
  return (
    <article className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3">
      <PlayerAvatar player={player} />
      <div className="min-w-[120px] flex-1">
        <h3 className="font-display text-sm font-semibold">{player.player_name}</h3>
        <p className="text-xs text-muted-foreground">
          Level {player.level}
          {status ? " · " + status : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {secondaryAction && (
          <Button
            size="sm"
            variant="outline"
            disabled={secondaryAction.disabled}
            onClick={secondaryAction.run}
          >
            {secondaryAction.label}
          </Button>
        )}
        {action && (
          <Button size="sm" disabled={action.disabled} onClick={action.run}>
            {action.label}
          </Button>
        )}
      </div>
    </article>
  );
}

function MessageList({
  messages,
  ownCharacterId,
  onReport,
}: {
  messages: SocialMessage[];
  ownCharacterId?: string;
  onReport: (message: SocialMessage) => void;
}) {
  if (!messages.length)
    return (
      <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground">
        No messages yet. Say hello.
      </p>
    );
  return (
    <ol className="grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-border bg-background p-3">
      {messages.map((message) => (
        <li key={message.id} className="rounded-lg bg-card px-3 py-2 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <strong>
              {message.sender_character_id === ownCharacterId ? "You" : message.sender_name}
            </strong>
            <time className="text-[11px] text-muted-foreground">
              {new Intl.DateTimeFormat("en-NG", { hour: "2-digit", minute: "2-digit" }).format(
                new Date(message.created_at),
              )}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p>
          {message.sender_character_id !== ownCharacterId && (
            <button
              type="button"
              className="mt-1 text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => onReport(message)}
            >
              Report message
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

function ChatComposer({
  label,
  disabled,
  onSend,
}: {
  label: string;
  disabled?: boolean;
  onSend: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = body.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      await onSend(clean);
      setBody("");
    } finally {
      setSending(false);
    }
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-2">
      <label className="sr-only" htmlFor={label.replaceAll(" ", "-")}>
        {label}
      </label>
      <textarea
        id={label.replaceAll(" ", "-")}
        value={body}
        maxLength={500}
        rows={2}
        disabled={disabled || sending}
        onChange={(event) => setBody(event.target.value)}
        placeholder={label}
        className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{body.length}/500</span>
        <Button size="sm" type="submit" disabled={disabled || sending || !body.trim()}>
          <MessageCircle size={15} /> Send
        </Button>
      </div>
    </form>
  );
}

export function PlayerSocial({ initialPlayerId }: { initialPlayerId?: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("players");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportCategory, setReportCategory] = useState<SocialReportCategory>("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const characterQuery = useQuery(q.character());
  const locationsQuery = useQuery(q.locations());
  const character = characterQuery.data;
  const locationId = character?.current_location_id ?? undefined;
  const overviewQuery = useQuery({
    queryKey: ["playerSocialOverview"],
    queryFn: getPlayerSocialOverview,
  });
  const overview = overviewQuery.data;
  const searchQuery = useQuery({
    queryKey: ["playerSocialSearch", submittedQuery],
    queryFn: () => searchPlayerProfiles(submittedQuery),
    enabled: submittedQuery.length >= 2,
  });
  const initialProfileQuery = useQuery({
    queryKey: ["playerProfile", initialPlayerId],
    queryFn: () => getPlayerProfile(initialPlayerId!),
    enabled: !!initialPlayerId,
  });
  const areaMessagesQuery = useQuery({
    queryKey: ["socialMessages", "area", locationId],
    queryFn: () => getSocialMessages({ locationId: locationId! }),
    enabled: tab === "messages" && !!locationId,
  });
  const directMessagesQuery = useQuery({
    queryKey: ["socialMessages", "private", activeChat?.conversationId],
    queryFn: () => getSocialMessages({ conversationId: activeChat!.conversationId }),
    enabled: tab === "messages" && !!activeChat?.conversationId,
  });
  const areaMessages = areaMessagesQuery.data ?? [];
  const directMessages = directMessagesQuery.data ?? [];
  useEffect(() => {
    if (initialProfileQuery.data) {
      setSubmittedQuery("");
      setQuery(initialProfileQuery.data.player_name);
      setTab("players");
    }
  }, [initialProfileQuery.data]);

  useEffect(() => {
    if (tab !== "messages") return;
    const channels = [];
    if (locationId) {
      channels.push(
        subscribeToSocialMessages({ locationId }, () => {
          void qc.invalidateQueries({ queryKey: ["socialMessages", "area", locationId] });
        }),
      );
    }
    if (activeChat?.conversationId) {
      channels.push(
        subscribeToSocialMessages({ conversationId: activeChat.conversationId }, () => {
          void qc.invalidateQueries({
            queryKey: ["socialMessages", "private", activeChat.conversationId],
          });
        }),
      );
    }
    return () => {
      for (const channel of channels) void leaveSocialChannel(channel);
    };
  }, [activeChat?.conversationId, locationId, qc, tab]);

  const refreshSocial = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["playerSocialOverview"] }),
      qc.invalidateQueries({ queryKey: ["playerSocialSearch"] }),
      qc.invalidateQueries({ queryKey: ["playerProfile"] }),
    ]);
  const actionMutation = useMutation({
    mutationFn: async (action: {
      kind: "send" | "accept" | "reject" | "cancel" | "remove" | "block" | "unblock";
      id: string;
    }) => {
      switch (action.kind) {
        case "send":
          return sendFriendRequest(action.id);
        case "accept":
          return respondToFriendRequest(action.id, true);
        case "reject":
          return respondToFriendRequest(action.id, false);
        case "cancel":
          return cancelFriendRequest(action.id);
        case "remove":
          return removeFriend(action.id);
        case "block":
          return blockPlayer(action.id);
        case "unblock":
          return unblockPlayer(action.id);
      }
    },
    onSuccess: async () => {
      await refreshSocial();
      toast.success("Your player social list is up to date.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const reportMutation = useMutation({
    mutationFn: reportPlayer,
    onSuccess: () => {
      setReportTarget(null);
      setReportDetails("");
      toast.success("Report sent. It is private to you and the moderation team.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const openChatMutation = useMutation({
    mutationFn: openPlayerConversation,
    onSuccess: async (result, characterId) => {
      const friend = overview?.friends.find((item) => item.character_id === characterId);
      const searchProfile = searchQuery.data?.find((item) => item.character_id === characterId);
      const initialProfile =
        initialProfileQuery.data?.character_id === characterId ? initialProfileQuery.data : null;
      const target = friend ?? searchProfile ?? initialProfile;
      if (!target) return;
      setActiveChat({
        conversationId: result.id,
        characterId,
        name: target.player_name,
      });
      setTab("messages");
      await refreshSocial();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const sendMutation = useMutation({
    mutationFn: sendSocialMessage,
    onSuccess: (_result, variables) => {
      const key =
        variables.channel === "area"
          ? ["socialMessages", "area", variables.locationId]
          : ["socialMessages", "private", variables.conversationId];
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const runMessage = async (body: string, direct = false) => {
    if (direct && activeChat) {
      await sendMutation.mutateAsync({
        channel: "private",
        body,
        conversationId: activeChat.conversationId,
      });
    } else if (locationId) {
      await sendMutation.mutateAsync({ channel: "area", body, locationId });
    }
  };
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = query.trim();
    if (clean.length < 2) {
      toast.message("Enter at least two characters to search players.");
      return;
    }
    setSubmittedQuery(clean);
  };

  return (
    <section className="game-panel space-y-4 p-4 sm:p-5" aria-labelledby="player-social-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary">
            <Users size={15} /> REAL PLAYERS
          </p>
          <h2 id="player-social-title" className="font-display text-xl font-semibold">
            Meet players
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Search public character profiles, make friends, and chat with players around the city.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Player social sections">
          {(
            [
              ["players", "Find players"],
              ["messages", "Messages"],
              ["friends", "Friends & safety"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={tab === value ? "default" : "outline"}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
            >
              {label}
              {value === "friends" && !!overview?.incoming.length && (
                <span className="ml-1 rounded-full bg-card px-1.5 text-xs text-foreground">
                  {overview.incoming.length}
                </span>
              )}
            </Button>
          ))}
        </div>
      </header>

      {tab === "players" && (
        <div className="grid gap-4">
          <form onSubmit={submitSearch} className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="player-search">
              Search player names
            </label>
            <input
              id="player-search"
              value={query}
              maxLength={24}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search player names"
              className="min-h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <Button type="submit" disabled={searchQuery.isFetching}>
              <Search size={16} /> Search
            </Button>
          </form>
          {initialPlayerId && initialProfileQuery.isPending && (
            <p className="text-sm text-muted-foreground" role="status">
              Loading player profile…
            </p>
          )}
          {initialProfileQuery.error && (
            <p className="text-sm text-destructive" role="alert">
              {initialProfileQuery.error.message}
            </p>
          )}
          {initialProfileQuery.data &&
            !searchQuery.data?.some((item) => item.character_id === initialPlayerId) && (
              <div className="grid gap-2">
                <PlayerRow
                  player={initialProfileQuery.data}
                  action={
                    initialProfileQuery.data.relationship === "none"
                      ? {
                          label: "Add friend",
                          run: () =>
                            actionMutation.mutate({
                              kind: "send",
                              id: initialProfileQuery.data!.character_id,
                            }),
                          disabled: actionMutation.isPending,
                        }
                      : initialProfileQuery.data.relationship === "request_received" &&
                          initialProfileQuery.data.request_id
                        ? {
                            label: "Accept request",
                            run: () =>
                              actionMutation.mutate({
                                kind: "accept",
                                id: initialProfileQuery.data!.request_id!,
                              }),
                            disabled: actionMutation.isPending,
                          }
                        : initialProfileQuery.data.relationship === "friends"
                          ? {
                              label: "Message",
                              run: () =>
                                openChatMutation.mutate(initialProfileQuery.data!.character_id),
                              disabled: openChatMutation.isPending,
                            }
                          : { label: "Request sent", run: () => {}, disabled: true }
                  }
                  secondaryAction={{
                    label: "Block",
                    run: () =>
                      actionMutation.mutate({
                        kind: "block",
                        id: initialProfileQuery.data!.character_id,
                      }),
                    disabled: actionMutation.isPending,
                  }}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-2"
                    onClick={() =>
                      setReportTarget({
                        id: initialProfileQuery.data!.character_id,
                        name: initialProfileQuery.data!.player_name,
                      })
                    }
                  >
                    Report player
                  </button>
                </div>
              </div>
            )}
          {searchQuery.error && (
            <p className="text-sm text-destructive" role="alert">
              {searchQuery.error.message}
            </p>
          )}
          {submittedQuery && searchQuery.data?.length === 0 && (
            <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground">
              No searchable players matched “{submittedQuery}”.
            </p>
          )}
          {!!searchQuery.data?.length && (
            <div className="grid gap-2" aria-label="Player search results">
              {searchQuery.data.map((profile) => (
                <div key={profile.character_id} className="grid gap-2">
                  <PlayerRow
                    player={profile}
                    status={profile.relationship === "friends" ? "Friend" : undefined}
                    action={
                      profile.relationship === "none"
                        ? {
                            label: "Add friend",
                            run: () =>
                              actionMutation.mutate({ kind: "send", id: profile.character_id }),
                            disabled: actionMutation.isPending,
                          }
                        : profile.relationship === "request_sent"
                          ? { label: "Request sent", run: () => {}, disabled: true }
                          : profile.relationship === "request_received" && profile.request_id
                            ? {
                                label: "Accept request",
                                run: () =>
                                  actionMutation.mutate({
                                    kind: "accept",
                                    id: profile.request_id!,
                                  }),
                                disabled: actionMutation.isPending,
                              }
                            : {
                                label: "Message",
                                run: () => openChatMutation.mutate(profile.character_id),
                                disabled: openChatMutation.isPending,
                              }
                    }
                    secondaryAction={{
                      label: "Block",
                      run: () => actionMutation.mutate({ kind: "block", id: profile.character_id }),
                      disabled: actionMutation.isPending,
                    }}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline underline-offset-2"
                      onClick={() =>
                        setReportTarget({ id: profile.character_id, name: profile.player_name })
                      }
                    >
                      Report player
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "messages" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section
            className="grid content-start gap-3 rounded-2xl border border-border p-3 sm:p-4"
            aria-labelledby="area-chat-title"
          >
            <div>
              <h3 id="area-chat-title" className="font-display font-semibold">
                Area chat
              </h3>
              <p className="text-xs text-muted-foreground">
                {locationsQuery.data?.find((location) => location.id === locationId)?.name ??
                  "Current district"}{" "}
                · visible to players in this area
              </p>
            </div>
            {!locationId ? (
              <p className="text-sm text-muted-foreground">Your current area is still loading.</p>
            ) : areaMessagesQuery.error ? (
              <p className="text-sm text-destructive" role="alert">
                {areaMessagesQuery.error.message}
              </p>
            ) : (
              <MessageList
                messages={areaMessages}
                ownCharacterId={character?.id}
                onReport={(message) =>
                  setReportTarget({
                    id: message.sender_character_id,
                    name: message.sender_name,
                    messageId: message.id,
                  })
                }
              />
            )}
            <ChatComposer
              label="Write an area message"
              disabled={!locationId || sendMutation.isPending}
              onSend={(body) => runMessage(body)}
            />
          </section>

          <section
            className="grid content-start gap-3 rounded-2xl border border-border p-3 sm:p-4"
            aria-labelledby="private-chat-title"
          >
            <div>
              <h3 id="private-chat-title" className="font-display font-semibold">
                {activeChat ? "Private chat with " + activeChat.name : "Private messages"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Private chats are available between friends.
              </p>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Friend conversations">
              {(overview?.conversations ?? []).map((conversation) => (
                <Button
                  key={conversation.id}
                  type="button"
                  size="sm"
                  variant={activeChat?.conversationId === conversation.id ? "default" : "outline"}
                  onClick={() => {
                    setActiveChat({
                      conversationId: conversation.id,
                      characterId: conversation.character_id,
                      name: conversation.player_name,
                    });
                    setTab("messages");
                  }}
                >
                  {conversation.player_name}
                </Button>
              ))}
            </div>
            {activeChat ? (
              <>
                {directMessagesQuery.error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {directMessagesQuery.error.message}
                  </p>
                ) : (
                  <MessageList
                    messages={directMessages}
                    ownCharacterId={character?.id}
                    onReport={(message) =>
                      setReportTarget({
                        id: message.sender_character_id,
                        name: message.sender_name,
                        messageId: message.id,
                      })
                    }
                  />
                )}
                <ChatComposer
                  label={"Message " + activeChat.name}
                  disabled={sendMutation.isPending}
                  onSend={(body) => runMessage(body, true)}
                />
              </>
            ) : (
              <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground">
                Choose a friend to open a private chat.
              </p>
            )}
          </section>
        </div>
      )}

      {tab === "friends" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="grid content-start gap-2" aria-labelledby="incoming-requests-title">
            <h3 id="incoming-requests-title" className="font-display font-semibold">
              Friend requests
            </h3>
            {overviewQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading requests…</p>
            ) : overviewQuery.error ? (
              <p className="text-sm text-destructive" role="alert">
                {overviewQuery.error.message}
              </p>
            ) : !overview?.incoming.length ? (
              <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground">
                No incoming requests.
              </p>
            ) : (
              overview.incoming.map((request) => (
                <PlayerRow
                  key={request.id}
                  player={request}
                  action={{
                    label: "Accept",
                    run: () => actionMutation.mutate({ kind: "accept", id: request.id }),
                    disabled: actionMutation.isPending,
                  }}
                  secondaryAction={{
                    label: "Decline",
                    run: () => actionMutation.mutate({ kind: "reject", id: request.id }),
                    disabled: actionMutation.isPending,
                  }}
                />
              ))
            )}
            {!!overview?.outgoing.length && (
              <div className="mt-3 grid gap-2">
                <h4 className="text-sm font-semibold">Sent requests</h4>
                {overview.outgoing.map((request) => (
                  <PlayerRow
                    key={request.id}
                    player={request}
                    status="Awaiting response"
                    action={{
                      label: "Cancel",
                      run: () => actionMutation.mutate({ kind: "cancel", id: request.id }),
                      disabled: actionMutation.isPending,
                    }}
                  />
                ))}
              </div>
            )}
          </section>
          <section className="grid content-start gap-2" aria-labelledby="friends-list-title">
            <h3 id="friends-list-title" className="font-display font-semibold">
              Friends
            </h3>
            {overview?.friends.length ? (
              overview.friends.map((friend) => (
                <PlayerRow
                  key={friend.character_id}
                  player={friend}
                  action={{
                    label: "Message",
                    run: () => openChatMutation.mutate(friend.character_id),
                    disabled: openChatMutation.isPending,
                  }}
                  secondaryAction={{
                    label: "Remove",
                    run: () => actionMutation.mutate({ kind: "remove", id: friend.character_id }),
                    disabled: actionMutation.isPending,
                  }}
                />
              ))
            ) : (
              <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground">
                Your friends list is empty. Search players to meet someone.
              </p>
            )}
            {!!overview?.blocked.length && (
              <div className="mt-3 grid gap-2">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldBan size={15} /> Blocked players
                </h4>
                {overview.blocked.map((blocked) => (
                  <div
                    key={blocked.character_id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-3 text-sm"
                  >
                    <span>{blocked.player_name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        actionMutation.mutate({ kind: "unblock", id: blocked.character_id })
                      }
                    >
                      Unblock
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {reportTarget && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-player-title"
            className="game-panel w-full max-w-lg space-y-3 p-5 shadow-xl"
          >
            <div>
              <h3 id="report-player-title" className="font-display text-lg font-semibold">
                Report {reportTarget.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                Reports are private and are visible to the moderation team.
              </p>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              Reason
              <select
                value={reportCategory}
                onChange={(event) => setReportCategory(event.target.value as SocialReportCategory)}
                className="min-h-10 rounded-xl border border-border bg-background px-3"
              >
                {REPORT_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Details (optional)
              <textarea
                value={reportDetails}
                maxLength={1000}
                rows={3}
                onChange={(event) => setReportDetails(event.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReportTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={reportMutation.isPending}
                onClick={() =>
                  reportMutation.mutate({
                    targetCharacterId: reportTarget.id,
                    category: reportCategory,
                    details: reportDetails,
                    messageId: reportTarget.messageId,
                  })
                }
              >
                Send report
              </Button>
            </div>
          </section>
        </div>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <UserPlus size={14} /> Public profiles show character details only. Exact location is not
        shown in search.
      </p>
    </section>
  );
}
