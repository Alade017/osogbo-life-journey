import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  MessageCircle,
  Mic,
  CircleDashed,
  BellOff,
  Check,
  CheckCheck,
  Palette,
  Pin,
  Plus,
  Paperclip,
  Reply,
  Search,
  Send,
  ShieldBan,
  Smile,
  Star,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useMessageWindow } from "@/hooks/use-message-window";
import { Avatar } from "@/components/game/Avatar";
import type { Appearance } from "@/components/game/Avatar";
import { FormattedMessage, MessageFormattingToolbar } from "@/components/game/MessageFormatting";
import { VoiceNotePlayer, VoiceNoteRecorder } from "@/components/game/VoiceNotes";
import { Button } from "@/components/ui/button";
import { q } from "@/lib/game";
import { supabase } from "@/integrations/supabase/client";
import { playGameSound } from "@/lib/game-audio";
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
  createPlayerStatus,
  deletePlayerStatus,
  getFriendStatusPosts,
  subscribeToStatusPosts,
  subscribeToSocialMessages,
  subscribeToFriendRequests,
  unblockPlayer,
  type SocialMessage,
  type SocialPlayer,
  type SocialReportCategory,
  type StatusTheme,
} from "@/lib/player-social-service";
import {
  flushThreadActionQueue,
  getThreadSummaries,
  runThreadAction,
  subscribeToInboxSummaries,
  type MuteDuration,
  type ThreadCommand,
  type ThreadSummary,
} from "@/lib/thread-preferences";

type Tab = "players" | "messages" | "friends" | "status" | "settings";
type ReportTarget = { id: string; name: string; messageId?: string };
type ActiveChat = { conversationId: string; characterId: string; name: string };
type InboxConversation = SocialPlayer & {
  id: string;
  lastActivity?: string;
  preview?: string;
  unreadCount?: number;
  pinnedAt?: string | null;
  mutedUntil?: string | null;
  starredAt?: string | null;
};
type InboxFilter = "all" | "unread" | "groups";

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
          player.appearance &&
          typeof player.appearance === "object" &&
          !Array.isArray(player.appearance)
            ? (player.appearance as Appearance)
            : {}
        }
        gender={player.gender}
        size={38}
      />
    </span>
  );
}

function formatConversationTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat("en-NG", {
    ...(sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }),
    timeZone: "Africa/Lagos",
  }).format(date);
}

/** Fixed-height windowing keeps a large inbox inexpensive on low-end phones. */
function VirtualConversationList({
  conversations,
  onOpen,
  onMenu,
  onLongPress,
  onCancelLongPress,
}: {
  conversations: InboxConversation[];
  onOpen: (conversation: InboxConversation) => void;
  onMenu: (conversation: InboxConversation) => void;
  onLongPress: (conversation: InboxConversation) => void;
  onCancelLongPress: () => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const rowHeight = 76;
  const viewportHeight = 380;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
  const end = Math.min(conversations.length, start + Math.ceil(viewportHeight / rowHeight) + 8);
  const visible = conversations.slice(start, end);
  return (
    <div
      className="phone-conversation-list phone-conversation-list-virtual"
      role="region"
      aria-label="Conversations"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div
        className="phone-conversation-list-spacer"
        style={{ height: conversations.length * rowHeight }}
      >
        <div
          className="phone-conversation-list-window"
          style={{ transform: `translateY(${start * rowHeight}px)` }}
        >
          {visible.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              className="phone-conversation"
              onClick={() => onOpen(conversation)}
              onContextMenu={(event) => {
                event.preventDefault();
                onMenu(conversation);
              }}
              onPointerDown={(event) => {
                if (event.pointerType !== "mouse") onLongPress(conversation);
              }}
              onPointerUp={onCancelLongPress}
              onPointerCancel={onCancelLongPress}
              onPointerMove={onCancelLongPress}
            >
              <PlayerAvatar player={conversation} />
              <span className="phone-conversation-copy">
                <strong>
                  {conversation.player_name}
                  {conversation.starredAt && <Star size={12} aria-label="Starred chat" />}
                </strong>
                <small>{conversation.preview || "Private conversation"}</small>
              </span>
              <span className="phone-conversation-status">
                <time>{formatConversationTime(conversation.lastActivity)}</time>
                {conversation.mutedUntil && <BellOff size={13} aria-label="Muted chat" />}
                {(conversation.unreadCount ?? 0) > 0 && (
                  <span aria-label={`${conversation.unreadCount} unread messages`}>
                    {(conversation.unreadCount ?? 0) > 99 ? "99+" : conversation.unreadCount}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
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
  status?: string | undefined;
}) {
  return (
    <article className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3">
      <PlayerAvatar player={player} />
      <div className="min-w-[120px] flex-1">
        <h3 className="font-display text-sm font-semibold">{player.player_name}</h3>
        <p className="text-xs text-muted-foreground">
          Level {player.level}
          {status ? ", " + status : ""}
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

export function MessageList({
  messages,
  ownCharacterId,
  onReport,
  onReply,
  phoneMode = false,
}: {
  messages: SocialMessage[];
  ownCharacterId?: string | undefined;
  onReport: (message: SocialMessage) => void;
  onReply: (message: SocialMessage) => void;
  phoneMode?: boolean;
}) {
  const [starred, setStarred] = useState<string[]>([]);
  const [starredOnly, setStarredOnly] = useState(false);
  const starKey = "osun-message-stars:" + (ownCharacterId ?? "guest");
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(starKey) ?? "[]");
      setStarred(
        Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [],
      );
    } catch {
      setStarred([]);
    }
  }, [starKey]);
  const toggleStar = (id: string) => {
    const next = starred.includes(id) ? starred.filter((value) => value !== id) : [...starred, id];
    setStarred(next);
    try {
      localStorage.setItem(starKey, JSON.stringify(next));
    } catch {
      /* Session stars remain available. */
    }
  };
  const filteredMessages = starredOnly
    ? messages.filter((message) => starred.includes(message.id))
    : messages;
  const windowed = useMessageWindow(
    filteredMessages.map((message) => message.id),
    phoneMode,
  );
  const listRef = windowed.ref;
  const visibleMessages = filteredMessages.slice(windowed.first, windowed.last);
  useEffect(() => {
    if (phoneMode && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, phoneMode, listRef]);
  if (!messages.length)
    return (
      <p
        className={
          phoneMode
            ? "phone-chat-empty"
            : "rounded-xl bg-background p-4 text-sm text-muted-foreground"
        }
      >
        No messages yet. Say hello.
      </p>
    );
  return (
    <>
      {phoneMode && (
        <button
          type="button"
          className="phone-star-filter"
          aria-pressed={starredOnly}
          onClick={() => setStarredOnly((value) => !value)}
        >
          <Star size={16} aria-hidden="true" />{" "}
          {starredOnly ? "Show all messages" : "Starred messages on this device"}
        </button>
      )}
      <ol
        ref={listRef}
        aria-label="Message history"
        className={
          phoneMode
            ? "phone-message-history"
            : "grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-border bg-background p-3"
        }
      >
        {windowed.before > 0 && (
          <li
            aria-hidden="true"
            className="message-window-spacer"
            style={{ height: windowed.before }}
          />
        )}
        {starredOnly && !visibleMessages.length && (
          <li className="phone-chat-empty">No starred messages in this chat.</li>
        )}
        {visibleMessages.map((message) => (
          <li
            key={message.id}
            data-message-id={message.id}
            className={`${phoneMode ? "phone-message-bubble" : "rounded-lg bg-card px-3 py-2 text-sm"} ${message.sender_character_id === ownCharacterId ? "is-own" : "is-other"}`}
          >
            {!phoneMode && (
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong>
                  {message.sender_character_id === ownCharacterId ? "You" : message.sender_name}
                </strong>
              </div>
            )}
            {message.reply && (
              <blockquote className="message-reply-quote">
                <strong>{message.reply.senderName}</strong>
                {message.reply.messageType === "voice" ? (
                  <span>
                    <Mic aria-hidden="true" /> Voice note ·{" "}
                    {Math.max(1, Math.round((message.reply.voiceDurationMs ?? 0) / 1000))}s
                  </span>
                ) : (
                  <span>{message.reply.body.slice(0, 100)}</span>
                )}
              </blockquote>
            )}
            {message.message_type === "voice" && message.voice_duration_ms ? (
              <VoiceNotePlayer messageId={message.id} durationMs={message.voice_duration_ms} />
            ) : (
              <p className="whitespace-pre-wrap break-words">
                <FormattedMessage body={message.body} />
              </p>
            )}
            <time
              className={
                phoneMode
                  ? "phone-message-time"
                  : "mt-1 block text-right text-[11px] text-muted-foreground"
              }
            >
              {new Intl.DateTimeFormat("en-NG", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Africa/Lagos",
              }).format(new Date(message.created_at))}
              {phoneMode && message.sender_character_id === ownCharacterId && (
                <Check className="phone-message-ticks" aria-label="Message sent" />
              )}
            </time>
            <span className="message-actions">
              <button
                type="button"
                aria-pressed={starred.includes(message.id)}
                onClick={() => toggleStar(message.id)}
              >
                <Star aria-hidden="true" /> {starred.includes(message.id) ? "Unstar" : "Star"}
              </button>
              <button type="button" onClick={() => onReply(message)}>
                <Reply aria-hidden="true" /> Reply
              </button>
              {message.sender_character_id !== ownCharacterId && (
                <button type="button" onClick={() => onReport(message)}>
                  Report
                </button>
              )}
            </span>
          </li>
        ))}
        {windowed.after > 0 && (
          <li
            aria-hidden="true"
            className="message-window-spacer"
            style={{ height: windowed.after }}
          />
        )}
      </ol>
    </>
  );
}

export function ChatComposer({
  label,
  disabled,
  onSend,
  replyTo,
  onCancelReply,
  phoneMode = false,
}: {
  label: string;
  disabled?: boolean;
  onSend: (body: string, replyToMessageId?: string) => Promise<void>;
  replyTo?: SocialMessage | null;
  onCancelReply?: () => void;
  phoneMode?: boolean;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = body.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      await onSend(clean, replyTo?.id);
      setBody("");
      onCancelReply?.();
    } catch {
      // The mutation exposes a player-facing error; preserve the draft for a retry.
    } finally {
      setSending(false);
    }
  };
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className={phoneMode ? "phone-chat-composer" : "grid gap-2"}
    >
      {replyTo && (
        <div className="message-composer-reply" role="status">
          <span>
            <strong>Reply to {replyTo.sender_name}</strong>
            <small>
              {replyTo.message_type === "voice"
                ? `Voice note · ${Math.max(1, Math.round((replyTo.voice_duration_ms ?? 0) / 1000))}s`
                : replyTo.body.slice(0, 100)}
            </small>
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply">
            <X aria-hidden="true" />
          </button>
        </div>
      )}
      {!phoneMode && (
        <MessageFormattingToolbar
          textareaRef={textareaRef}
          value={body}
          onChange={setBody}
          disabled={disabled || sending}
        />
      )}
      <label className="sr-only" htmlFor={label.replaceAll(" ", "-")}>
        {label}
      </label>
      <textarea
        ref={textareaRef}
        id={label.replaceAll(" ", "-")}
        value={body}
        maxLength={1000}
        rows={phoneMode ? 1 : 2}
        disabled={disabled || sending}
        onChange={(event) => setBody(event.target.value)}
        placeholder={label}
        className={
          phoneMode
            ? "phone-chat-input"
            : "w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        }
      />
      <span className="message-character-count" aria-live="polite">
        {body.length}/1000
      </span>
      {phoneMode ? (
        <div className="phone-chat-input-actions">
          <button
            type="button"
            className="phone-chat-utility"
            aria-label="Add emoji"
            disabled={disabled || sending}
            onClick={() => {
              setBody((value) => `${value}${value ? " " : ""}🙂`);
              textareaRef.current?.focus();
            }}
          >
            <Smile size={18} />
          </button>
          <button
            type="button"
            className="phone-chat-utility"
            aria-label="Attach file"
            disabled
            title="Attachments are coming soon"
          >
            <Paperclip size={18} />
          </button>
          <button
            type="button"
            className="phone-chat-utility"
            aria-label="Open camera"
            disabled
            title="Camera messages are coming soon"
          >
            <Camera size={18} />
          </button>
          <Button
            className="phone-chat-send"
            size="icon"
            type="submit"
            aria-label="Send message"
            disabled={disabled || sending || !body.trim()}
          >
            <Send size={17} />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span />
          <Button size="sm" type="submit" disabled={disabled || sending || !body.trim()}>
            <MessageCircle size={15} /> Send
          </Button>
        </div>
      )}
    </form>
  );
}

export function PlayerSocial({
  initialPlayerId,
  initialTab = "players",
  phoneMode = false,
}: {
  initialPlayerId?: string | undefined;
  initialTab?: Tab;
  phoneMode?: boolean;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [phoneMessageMode] = useState<"private" | "area">("private");
  const [query, setQuery] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all");
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearch, setInChatSearch] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportCategory, setReportCategory] = useState<SocialReportCategory>("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [statusBody, setStatusBody] = useState("");
  const [statusTheme, setStatusTheme] = useState<StatusTheme>("leaf");
  const [messageTheme, setMessageTheme] = useState("porcelain");
  useEffect(() => {
    try {
      setMessageTheme(localStorage.getItem("osogbo-message-theme") ?? "porcelain");
    } catch {
      /* Default theme. */
    }
  }, []);
  const [threadMenu, setThreadMenu] = useState<InboxConversation | null>(null);
  const [replyTarget, setReplyTarget] = useState<SocialMessage | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const characterQuery = useQuery(q.character());
  const locationsQuery = useQuery(q.locations());
  const character = characterQuery.data;
  const locationId = character?.current_location_id ?? undefined;
  const overviewQuery = useQuery({
    queryKey: ["playerSocialOverview"],
    queryFn: getPlayerSocialOverview,
  });
  const overview = overviewQuery.data;
  const threadQuery = useQuery({
    queryKey: ["socialThreadSummaries"],
    queryFn: getThreadSummaries,
    enabled: phoneMode,
    retry: false,
  });
  const accountQuery = useQuery({
    queryKey: ["socialAccountId"],
    enabled: phoneMode,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error ?? new Error("Sign in to load chats.");
      return data.user.id;
    },
  });
  const statusQuery = useQuery({
    queryKey: ["playerStatusPosts"],
    queryFn: getFriendStatusPosts,
    enabled: phoneMode,
  });
  const friendIds = useMemo(
    () => (overview?.friends ?? []).map((friend) => friend.character_id),
    [overview?.friends],
  );
  const friendPresence = useQuery({
    queryKey: ["friendPresence", friendIds],
    enabled: friendIds.length > 0,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_online_presence")
        .select("character_id,seen_at")
        .in("character_id", friendIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const isFriendOnline = (id: string) => {
    const seenAt = friendPresence.data?.find((row) => row.character_id === id)?.seen_at;
    return !!seenAt && Date.now() - new Date(seenAt).getTime() < 60000;
  };
  const inboxConversations = useMemo<InboxConversation[]>(() => {
    if (threadQuery.data?.length) return threadQuery.data;
    return (overview?.conversations ?? []).map((conversation) => ({
      ...conversation,
      preview: "Private conversation",
      unreadCount: 0,
      pinnedAt: null,
      mutedUntil: null,
      starredAt: null,
    }));
  }, [overview?.conversations, threadQuery.data]);
  const visibleConversations = useMemo(() => {
    const filter = conversationSearch.trim().toLocaleLowerCase();
    return inboxConversations.filter((conversation) =>
      conversation.player_name.toLocaleLowerCase().includes(filter),
    );
  }, [conversationSearch, inboxConversations]);
  const pinnedConversations = useMemo(
    () => visibleConversations.filter((conversation) => conversation.pinnedAt),
    [visibleConversations],
  );
  const regularConversations = useMemo(
    () => visibleConversations.filter((conversation) => !conversation.pinnedAt),
    [visibleConversations],
  );
  const filteredConversations = useMemo(() => {
    if (inboxFilter === "unread")
      return [...pinnedConversations, ...regularConversations].filter(
        (conversation) => (conversation.unreadCount ?? 0) > 0,
      );
    if (inboxFilter === "groups") return [];
    return [...pinnedConversations, ...regularConversations];
  }, [inboxFilter, pinnedConversations, regularConversations]);
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
  const activeChatPlayer =
    overview?.conversations.find(
      (conversation) => conversation.character_id === activeChat?.characterId,
    ) ??
    overview?.friends.find((friend) => friend.character_id === activeChat?.characterId) ??
    (initialProfileQuery.data?.character_id === activeChat?.characterId
      ? initialProfileQuery.data
      : undefined);
  const areaMessagesQuery = useQuery({
    queryKey: ["socialMessages", "area", locationId],
    queryFn: () => getSocialMessages({ locationId: locationId! }),
    enabled: tab === "messages" && !phoneMode && !!locationId,
  });
  const directMessagesQuery = useQuery({
    queryKey: ["socialMessages", "private", activeChat?.conversationId],
    queryFn: () => getSocialMessages({ conversationId: activeChat!.conversationId }),
    enabled: tab === "messages" && !!activeChat?.conversationId,
  });
  const areaMessages = useMemo(() => areaMessagesQuery.data ?? [], [areaMessagesQuery.data]);
  const directMessages = useMemo(() => directMessagesQuery.data ?? [], [directMessagesQuery.data]);
  const displayedDirectMessages = useMemo(() => {
    const filter = inChatSearch.trim().toLocaleLowerCase();
    if (!filter) return directMessages;
    return directMessages.filter((message) => message.body.toLocaleLowerCase().includes(filter));
  }, [directMessages, inChatSearch]);
  const lastMessageIds = useRef<{ area: string | null; direct: string | null }>({
    area: null,
    direct: null,
  });
  useEffect(() => {
    const latestArea = areaMessages[areaMessages.length - 1];
    const latestDirect = directMessages[directMessages.length - 1];
    const previous = lastMessageIds.current;
    if (
      latestArea &&
      previous.area &&
      latestArea.id !== previous.area &&
      latestArea.sender_character_id !== character?.id
    )
      playGameSound("message");
    if (
      latestDirect &&
      previous.direct &&
      latestDirect.id !== previous.direct &&
      latestDirect.sender_character_id !== character?.id
    )
      playGameSound("message");
    lastMessageIds.current = {
      area: latestArea?.id ?? previous.area,
      direct: latestDirect?.id ?? previous.direct,
    };
  }, [areaMessages, directMessages, character?.id]);
  useEffect(() => {
    if (initialProfileQuery.data) {
      setSubmittedQuery("");
      setQuery(initialProfileQuery.data.player_name);
      setTab("players");
    }
  }, [initialProfileQuery.data]);

  useEffect(() => {
    if (tab !== "messages") return;
    const channels: Array<ReturnType<typeof subscribeToSocialMessages>> = [];
    if (locationId && !phoneMode) {
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
  }, [activeChat?.conversationId, locationId, phoneMode, qc, tab]);

  useEffect(() => {
    const channel = subscribeToFriendRequests(() => {
      void qc.invalidateQueries({ queryKey: ["playerSocialOverview"] });
      void qc.invalidateQueries({ queryKey: ["playerSocialSearch"] });
    });
    return () => {
      void leaveSocialChannel(channel);
    };
  }, [qc]);
  useEffect(() => {
    if (!phoneMode) return;
    const channel = subscribeToStatusPosts(
      () => void qc.invalidateQueries({ queryKey: ["playerStatusPosts"] }),
    );
    return () => {
      void leaveSocialChannel(channel);
    };
  }, [phoneMode, qc]);
  useEffect(() => {
    if (!phoneMode || !accountQuery.data) return;
    const subscription = subscribeToInboxSummaries(accountQuery.data, () => {
      void qc.invalidateQueries({ queryKey: ["socialThreadSummaries"] });
    });
    const reconnect = () => {
      void flushThreadActionQueue((message) =>
        toast.error(message === "PIN_LIMIT_REACHED" ? "You can pin up to three chats." : message),
      ).then(() => qc.invalidateQueries({ queryKey: ["socialThreadSummaries"] }));
    };
    window.addEventListener("online", reconnect);
    if (navigator.onLine) reconnect();
    return () => {
      subscription.clear();
      void leaveSocialChannel(subscription.channel);
      window.removeEventListener("online", reconnect);
    };
  }, [accountQuery.data, phoneMode, qc]);
  useEffect(() => {
    const refreshMessagingState = () => {
      if (document.visibilityState === "hidden") return;
      void qc.invalidateQueries({ queryKey: ["playerSocialOverview"] });
      void qc.invalidateQueries({ queryKey: ["socialThreadSummaries"] });
      if (locationId)
        void qc.invalidateQueries({ queryKey: ["socialMessages", "area", locationId] });
      if (activeChat?.conversationId)
        void qc.invalidateQueries({
          queryKey: ["socialMessages", "private", activeChat.conversationId],
        });
    };
    window.addEventListener("online", refreshMessagingState);
    document.addEventListener("visibilitychange", refreshMessagingState);
    return () => {
      window.removeEventListener("online", refreshMessagingState);
      document.removeEventListener("visibilitychange", refreshMessagingState);
    };
  }, [activeChat?.conversationId, locationId, qc]);

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
    onError: (error: Error) => {
      const message =
        error.message === "MESSAGE_DELIVERY_UNCONFIRMED"
          ? "Your connection dropped before delivery could be confirmed. Your draft is still here."
          : error.message;
      toast.error(message);
    },
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
      setReplyTarget(null);
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
  const statusMutation = useMutation({
    mutationFn: ({ body, theme }: { body: string; theme: StatusTheme }) =>
      createPlayerStatus(body, theme),
    onSuccess: async () => {
      setStatusBody("");
      toast.success("Your status is live for 24 hours.");
      await qc.invalidateQueries({ queryKey: ["playerStatusPosts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const threadMutation = useMutation({
    mutationFn: ({
      threadId,
      command,
      duration,
    }: {
      threadId: string;
      command: ThreadCommand;
      duration?: MuteDuration;
    }) => runThreadAction(threadId, command, duration),
    onMutate: async ({ threadId, command }) => {
      await qc.cancelQueries({ queryKey: ["socialThreadSummaries"] });
      const previous = qc.getQueryData<ThreadSummary[]>(["socialThreadSummaries"]);
      qc.setQueryData<ThreadSummary[]>(["socialThreadSummaries"], (current = []) =>
        current.map((thread) => {
          if (thread.id !== threadId) return thread;
          if (command === "pin") return { ...thread, pinnedAt: thread.pinnedAt ?? "pending" };
          if (command === "unpin") return { ...thread, pinnedAt: null };
          if (command === "star") return { ...thread, starredAt: thread.starredAt ?? "pending" };
          if (command === "unstar") return { ...thread, starredAt: null };
          if (command === "read") return { ...thread, unreadCount: 0 };
          return thread;
        }),
      );
      return { previous };
    },
    onSuccess: (result) => {
      if (result && "queued" in result)
        toast.message("Chat preference queued until you reconnect.");
      else void qc.invalidateQueries({ queryKey: ["socialThreadSummaries"] });
      setThreadMenu(null);
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) qc.setQueryData(["socialThreadSummaries"], context.previous);
      toast.error(
        error.message === "PIN_LIMIT_REACHED" ? "You can pin up to three chats." : error.message,
      );
    },
  });
  const deleteStatusMutation = useMutation({
    mutationFn: deletePlayerStatus,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playerStatusPosts"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const runMessage = async (body: string, direct = false, replyToMessageId?: string) => {
    if (direct && activeChat) {
      await sendMutation.mutateAsync({
        channel: "private",
        body,
        conversationId: activeChat.conversationId,
        ...(replyToMessageId ? { replyToMessageId } : {}),
      });
    } else if (locationId) {
      await sendMutation.mutateAsync({
        channel: "area",
        body,
        locationId,
        ...(replyToMessageId ? { replyToMessageId } : {}),
      });
    }
  };
  const openConversation = (conversation: InboxConversation) => {
    setReplyTarget(null);
    setActiveChat({
      conversationId: conversation.id,
      characterId: conversation.character_id,
      name: conversation.player_name,
    });
    if (conversation.unreadCount)
      threadMutation.mutate({ threadId: conversation.id, command: "read" });
  };
  const beginLongPress = (conversation: InboxConversation) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => setThreadMenu(conversation), 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
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
    <section
      className={phoneMode ? "phone-messenger" : "game-panel space-y-4 p-4 sm:p-5"}
      data-message-theme={phoneMode ? messageTheme : undefined}
      aria-labelledby={phoneMode ? undefined : "player-social-title"}
      aria-label={phoneMode ? "Phone messages" : undefined}
    >
      {!phoneMode && (
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
      )}

      {tab === "players" && (
        <div className={phoneMode ? "phone-new-chat-panel" : "grid gap-4"}>
          {phoneMode && (
            <div className="phone-new-chat-heading">
              <button
                type="button"
                className="phone-icon-button"
                aria-label="Back to chats"
                onClick={() => setTab("messages")}
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h3 className="font-display font-semibold">New message</h3>
                <p className="text-xs text-muted-foreground">Choose a friend or find a player.</p>
              </div>
            </div>
          )}
          <form
            onSubmit={submitSearch}
            className={phoneMode ? "phone-player-search" : "flex flex-wrap gap-2"}
          >
            <label className="sr-only" htmlFor="player-search">
              Search player names
            </label>
            {phoneMode && <Search size={17} aria-hidden="true" />}
            <input
              id="player-search"
              value={query}
              maxLength={24}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search player names"
              className={
                phoneMode
                  ? "phone-player-search-input"
                  : "min-h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              }
            />
            {phoneMode ? (
              <button type="submit" className="phone-search-submit" aria-label="Search players">
                <Search size={16} />
              </button>
            ) : (
              <Button type="submit" disabled={searchQuery.isFetching}>
                <Search size={16} /> Search
              </Button>
            )}
          </form>
          {phoneMode && (
            <section className="phone-contact-section" aria-label="Friends you can message">
              <h4>Friends</h4>
              {overview?.friends.length ? (
                <div className="phone-contact-list">
                  {overview.friends.map((friend) => (
                    <button
                      type="button"
                      className="phone-contact-row"
                      key={friend.character_id}
                      onClick={() => openChatMutation.mutate(friend.character_id)}
                      disabled={openChatMutation.isPending}
                    >
                      <PlayerAvatar player={friend} />
                      <span className="phone-contact-copy">
                        <strong>{friend.player_name}</strong>
                        <small>
                          {isFriendOnline(friend.character_id) ? "Online" : "Offline"}. Start a
                          private chat.
                        </small>
                      </span>
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="phone-contact-empty">
                  Friends you can message will appear here. Meet players in People first.
                </p>
              )}
            </section>
          )}
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

      {tab === "messages" &&
        (phoneMode ? (
          <div className="phone-message-content">
            {phoneMessageMode === "area" ? (
              <section className="phone-chat-panel" aria-label="Area chat">
                <p className="phone-chat-subtitle">
                  {locationsQuery.data?.find((location) => location.id === locationId)?.name ??
                    "Current district"}
                  . Messages visible to players in this area
                </p>
                {!locationId ? (
                  <p className="text-sm text-muted-foreground">
                    Your current area is still loading.
                  </p>
                ) : areaMessagesQuery.error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {areaMessagesQuery.error?.message ?? "Area messages could not be loaded."}
                  </p>
                ) : (
                  <MessageList
                    messages={areaMessages}
                    ownCharacterId={character?.id}
                    onReply={setReplyTarget}
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
                  onSend={(body, replyId) => runMessage(body, false, replyId)}
                  replyTo={replyTarget}
                  onCancelReply={() => setReplyTarget(null)}
                />
              </section>
            ) : activeChat ? (
              <section
                className="phone-chat-panel"
                aria-label={`Private chat with ${activeChat.name}`}
              >
                <header className="phone-thread-header">
                  <button
                    type="button"
                    className="phone-thread-back"
                    onClick={() => {
                      setReplyTarget(null);
                      setActiveChat(null);
                    }}
                    aria-label="Back to chats"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  {activeChatPlayer ? (
                    <PlayerAvatar player={activeChatPlayer} />
                  ) : (
                    <span className="phone-conversation-avatar" aria-hidden="true">
                      {activeChat.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="phone-thread-person">
                    <strong>{activeChat.name}</strong>
                    <small>Private chat</small>
                  </div>
                  <button
                    type="button"
                    className="phone-thread-search-toggle"
                    aria-label={inChatSearchOpen ? "Close message search" : "Search messages"}
                    aria-pressed={inChatSearchOpen}
                    onClick={() => {
                      setInChatSearchOpen((open) => !open);
                      if (inChatSearchOpen) setInChatSearch("");
                    }}
                  >
                    <Search size={17} />
                  </button>
                </header>
                {inChatSearchOpen && (
                  <label className="phone-thread-search">
                    <Search size={15} aria-hidden="true" />
                    <span className="sr-only">Search messages in this chat</span>
                    <input
                      autoFocus
                      type="search"
                      value={inChatSearch}
                      onChange={(event) => setInChatSearch(event.target.value)}
                      placeholder="Search messages"
                    />
                  </label>
                )}
                {directMessagesQuery.error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {directMessagesQuery.error.message}
                  </p>
                ) : (
                  <MessageList
                    messages={displayedDirectMessages}
                    ownCharacterId={character?.id}
                    phoneMode
                    onReply={setReplyTarget}
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
                  label={`Message ${activeChat.name}`}
                  disabled={sendMutation.isPending}
                  onSend={(body, replyId) => runMessage(body, true, replyId)}
                  replyTo={replyTarget}
                  onCancelReply={() => setReplyTarget(null)}
                  phoneMode
                />
                <VoiceNoteRecorder
                  threadId={activeChat.conversationId}
                  disabled={sendMutation.isPending}
                  onSent={() =>
                    void qc.invalidateQueries({
                      queryKey: ["socialMessages", "private", activeChat.conversationId],
                    })
                  }
                />
              </section>
            ) : (
              <section className="phone-chat-panel" aria-label="Private chats">
                <div className="phone-inbox-heading">
                  <div>
                    <h3>Chats</h3>
                    <p>Messages with your friends</p>
                  </div>
                  <button
                    type="button"
                    className="phone-new-message-button"
                    onClick={() => {
                      setQuery("");
                      setSubmittedQuery("");
                      setTab("players");
                    }}
                    aria-label="New message"
                  >
                    <Plus size={19} />
                  </button>
                </div>
                <label className="phone-inbox-search">
                  <Search size={16} aria-hidden="true" />
                  <span className="sr-only">Search chats</span>
                  <input
                    type="search"
                    value={conversationSearch}
                    onChange={(event) => setConversationSearch(event.target.value)}
                    placeholder="Search chats"
                  />
                </label>
                <div className="phone-inbox-filters" role="group" aria-label="Chat filters">
                  {(["all", "unread", "groups"] as const).map((filter) => (
                    <button
                      type="button"
                      key={filter}
                      className={inboxFilter === filter ? "is-active" : undefined}
                      aria-pressed={inboxFilter === filter}
                      onClick={() => setInboxFilter(filter)}
                    >
                      {filter === "all" ? "All" : filter === "unread" ? "Unread" : "Groups"}
                    </button>
                  ))}
                </div>
                {overviewQuery.isPending ? (
                  <p className="text-sm text-muted-foreground">Loading your chats…</p>
                ) : overviewQuery.error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {overviewQuery.error.message}
                  </p>
                ) : filteredConversations.length ? (
                  <VirtualConversationList
                    conversations={filteredConversations}
                    onOpen={openConversation}
                    onMenu={setThreadMenu}
                    onLongPress={beginLongPress}
                    onCancelLongPress={cancelLongPress}
                  />
                ) : (
                  <p className="phone-inbox-state">
                    {inboxFilter === "groups"
                      ? "Group chats will appear here when groups are available."
                      : "No matching chats yet. Start one from a friend's profile in Social."}
                  </p>
                )}
              </section>
            )}
          </div>
        ) : (
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
                    "Current district"}
                  . Visible to players in this area
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
                  onReply={setReplyTarget}
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
                onSend={(body, replyId) => runMessage(body, false, replyId)}
                replyTo={replyTarget}
                onCancelReply={() => setReplyTarget(null)}
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
                      setReplyTarget(null);
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
                      onReply={setReplyTarget}
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
                    onSend={(body, replyId) => runMessage(body, true, replyId)}
                    replyTo={replyTarget}
                    onCancelReply={() => setReplyTarget(null)}
                  />
                </>
              ) : (
                <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground">
                  Choose a friend to open a private chat.
                </p>
              )}
            </section>
          </div>
        ))}

      {phoneMode && tab === "status" && (
        <section className="phone-status-page scrollbar-hidden" aria-label="Player statuses">
          <header>
            <div>
              <h3>Status</h3>
              <p>Share an update with friends for 24 hours.</p>
            </div>
            <CircleDashed size={22} />
          </header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              statusMutation.mutate({ body: statusBody.trim(), theme: statusTheme });
            }}
          >
            <label htmlFor="player-status-body">New status</label>
            <textarea
              id="player-status-body"
              maxLength={280}
              rows={4}
              value={statusBody}
              onChange={(event) => setStatusBody(event.target.value)}
              placeholder="What’s happening in your Osun Life?"
            />
            <div className="phone-status-themes" aria-label="Status background">
              {(["porcelain", "leaf", "ink", "sunset"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`status-theme-${value}`}
                  aria-label={`${value} status theme`}
                  aria-pressed={statusTheme === value}
                  onClick={() => setStatusTheme(value)}
                />
              ))}
            </div>
            <Button type="submit" disabled={!statusBody.trim() || statusMutation.isPending}>
              {statusMutation.isPending ? "Posting…" : "Post status"}
            </Button>
          </form>
          <div className="phone-status-feed">
            {statusQuery.isPending ? (
              <p>Loading statuses…</p>
            ) : statusQuery.error ? (
              <p role="alert">{statusQuery.error.message}</p>
            ) : statusQuery.data?.length ? (
              statusQuery.data.map((post) => (
                <article key={post.id} className={`phone-status-card status-theme-${post.theme}`}>
                  <div>
                    <strong>{post.isOwn ? "Your status" : post.playerName}</strong>
                    <time>
                      {new Intl.DateTimeFormat("en-NG", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Africa/Lagos",
                      }).format(new Date(post.createdAt))}
                    </time>
                  </div>
                  <p>{post.body}</p>
                  {post.isOwn && (
                    <button type="button" onClick={() => deleteStatusMutation.mutate(post.id)}>
                      Delete status
                    </button>
                  )}
                </article>
              ))
            ) : (
              <p className="phone-inbox-state">No active statuses. Post the first update.</p>
            )}
          </div>
        </section>
      )}

      {phoneMode && tab === "settings" && (
        <section className="phone-theme-page">
          <header>
            <Palette size={22} />
            <div>
              <h3>Chat theme</h3>
              <p>Choose how Messages looks on this device.</p>
            </div>
          </header>
          <div className="phone-theme-options">
            {[
              { id: "porcelain", label: "Porcelain" },
              { id: "leaf", label: "Leaf green" },
              { id: "ink", label: "Night ink" },
              { id: "warm", label: "Warm cream" },
            ].map((choice) => (
              <button
                key={choice.id}
                type="button"
                aria-pressed={messageTheme === choice.id}
                onClick={() => {
                  setMessageTheme(choice.id);
                  try {
                    localStorage.setItem("osogbo-message-theme", choice.id);
                  } catch {
                    /* Session theme remains available. */
                  }
                }}
              >
                <span className={`message-theme-swatch theme-${choice.id}`} />
                <strong>{choice.label}</strong>
                {messageTheme === choice.id && <small>Selected</small>}
              </button>
            ))}
          </div>
        </section>
      )}

      {phoneMode && !activeChat && (
        <nav className="phone-message-nav" aria-label="Messages navigation">
          <button
            type="button"
            className={tab === "messages" ? "is-active" : ""}
            aria-current={tab === "messages" ? "page" : undefined}
            onClick={() => {
              setActiveChat(null);
              setTab("messages");
            }}
          >
            <MessageCircle size={18} aria-hidden="true" />
            <span>Chats</span>
          </button>
          <button
            type="button"
            className={tab === "players" ? "is-active" : ""}
            aria-current={tab === "players" ? "page" : undefined}
            onClick={() => setTab("players")}
          >
            <Users size={18} aria-hidden="true" />
            <span>People</span>
          </button>
          <button
            type="button"
            className={tab === "status" ? "is-active" : ""}
            aria-current={tab === "status" ? "page" : undefined}
            onClick={() => setTab("status")}
          >
            <CircleDashed size={18} aria-hidden="true" />
            <span>Status</span>
          </button>
          <button
            type="button"
            className={tab === "settings" ? "is-active" : ""}
            aria-current={tab === "settings" ? "page" : undefined}
            onClick={() => setTab("settings")}
          >
            <Palette size={18} aria-hidden="true" />
            <span>Theme</span>
          </button>
        </nav>
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
                <div key={friend.character_id} className="grid gap-1">
                  <PlayerRow
                    player={friend}
                    status={isFriendOnline(friend.character_id) ? "Online" : "Offline"}
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
                  <Link
                    className="px-3 text-xs text-primary underline"
                    to="/home"
                    search={{ visit: friend.character_id }}
                  >
                    Visit saved home
                  </Link>
                </div>
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

      {phoneMode && threadMenu && (
        <div
          className="phone-thread-menu-backdrop"
          role="presentation"
          onClick={() => setThreadMenu(null)}
        >
          <section
            className="phone-thread-menu"
            role="menu"
            aria-label={`Actions for ${threadMenu.player_name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <strong>{threadMenu.player_name}</strong>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                threadMutation.mutate({
                  threadId: threadMenu.id,
                  command: threadMenu.pinnedAt ? "unpin" : "pin",
                })
              }
            >
              <Pin aria-hidden="true" /> {threadMenu.pinnedAt ? "Unpin chat" : "Pin chat"}
            </button>
            <p>Mute</p>
            <div className="phone-thread-mute-options">
              {threadMenu.mutedUntil && (
                <button
                  type="button"
                  onClick={() =>
                    threadMutation.mutate({ threadId: threadMenu.id, command: "unmute" })
                  }
                >
                  Unmute
                </button>
              )}
              {(["8h", "1w", "always"] as const).map((duration) => (
                <button
                  type="button"
                  key={duration}
                  onClick={() =>
                    threadMutation.mutate({ threadId: threadMenu.id, command: "mute", duration })
                  }
                >
                  {duration === "8h" ? "8 hours" : duration === "1w" ? "1 week" : "Always"}
                </button>
              ))}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => threadMutation.mutate({ threadId: threadMenu.id, command: "read" })}
            >
              <CheckCheck aria-hidden="true" /> Mark as read
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                threadMutation.mutate({
                  threadId: threadMenu.id,
                  command: threadMenu.starredAt ? "unstar" : "star",
                })
              }
            >
              <Star aria-hidden="true" /> {threadMenu.starredAt ? "Unstar thread" : "Star thread"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                actionMutation.mutate({ kind: "block", id: threadMenu.character_id });
                setThreadMenu(null);
              }}
            >
              <ShieldBan aria-hidden="true" /> Block player
            </button>
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
                    ...(reportTarget.messageId ? { messageId: reportTarget.messageId } : {}),
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
