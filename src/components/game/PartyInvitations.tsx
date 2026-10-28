import { useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  invitationKey,
  listPartyInvitations,
  performInvitation,
  type InvitationIntent,
} from "@/lib/party-invitation-service";
import { searchPlayerProfiles } from "@/lib/player-social-service";

const button =
  "min-h-11 rounded-full border border-border px-3 text-sm font-semibold disabled:opacity-50";
const eventTime = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));

export function HostPartyInvitations({
  accountId,
  eventId,
}: {
  accountId: string;
  eventId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-2">
      <button type="button" className={button} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide invitations" : "Invite players and view guests"}
      </button>
      {open && (
        <PartyInvitations key={`${accountId}:${eventId}`} accountId={accountId} eventId={eventId} />
      )}
    </div>
  );
}

export function PartyInvitations({ accountId, eventId }: { accountId: string; eventId?: string }) {
  const client = useQueryClient();
  const alive = useRef(true),
    busy = useRef(false);
  const request = useRef<{ intent: InvitationIntent; id: string } | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    alive.current = true;
    const network = () => setOnline(navigator.onLine);
    const visibility = () => setVisible(document.visibilityState !== "hidden");
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      alive.current = false;
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const invitations = useInfiniteQuery({
    queryKey: invitationKey(accountId, eventId),
    queryFn: ({ pageParam }) => listPartyInvitations(accountId, eventId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: !!accountId && online && visible,
    retry: false,
    refetchInterval: online && visible ? 30_000 : false,
    refetchOnWindowFocus: true,
  });
  const rows = invitations.data?.pages.flatMap((page) => page.items) ?? [];
  const players = useQuery({
    queryKey: ["partyInvitationSearch", accountId, eventId, search],
    queryFn: () => searchPlayerProfiles(search),
    enabled: !!eventId && search.length >= 2 && online && visible,
    retry: false,
  });
  const action = useMutation({
    mutationFn: ({ intent, id }: { intent: InvitationIntent; id: string }) =>
      performInvitation(accountId, intent, id),
    networkMode: "always",
    retry: false,
    onSuccess: async (result, variables) => {
      request.current = null;
      if (!alive.current) return;
      // Only a validated RPC confirmation may update known rows. A failed refresh
      // must not turn a confirmed acceptance back into an actionable pending card.
      client.setQueriesData<InfiniteData<Awaited<ReturnType<typeof listPartyInvitations>>>>(
        { queryKey: ["partyInvitations", accountId] },
        (current) =>
          current && {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.map((row) =>
                row.id === result.invitationId
                  ? {
                      ...row,
                      status: result.status,
                      isGuest: result.status === "accepted",
                      canRespond: result.status === "pending" && row.canRespond,
                    }
                  : row,
              ),
            })),
          },
      );
      await Promise.all([
        client.invalidateQueries({ queryKey: ["partyInvitations", accountId] }),
        client.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      if (alive.current && !result.duplicate)
        toast.success(
          variables.intent.kind === "send"
            ? result.isNew
              ? "Invitation sent."
              : `Invitation already ${result.status}.`
            : `Invitation ${result.status}.`,
        );
    },
    onError: () => {
      if (alive.current && navigator.onLine) void invitations.refetch();
    },
    onSettled: () => {
      busy.current = false;
    },
  });
  const pending = request.current;
  const recovered =
    !!pending &&
    rows.some((row) =>
      pending.intent.kind === "send"
        ? row.eventId === pending.intent.eventId &&
          row.recipientCharacterId === pending.intent.recipientCharacterId
        : row.id === pending.intent.invitationId &&
          row.status === pending.intent.decision &&
          (row.status !== "accepted" || row.isGuest),
    );
  const { isError: actionFailed, reset: resetAction } = action;
  useEffect(() => {
    if (recovered && actionFailed) {
      request.current = null;
      resetAction();
    }
  }, [recovered, actionFailed, resetAction]);
  const submit = (intent: InvitationIntent, retry = false) => {
    if (busy.current || !online || !navigator.onLine || (request.current && !retry)) return;
    const command =
      retry && request.current ? request.current : { intent, id: crypto.randomUUID() };
    request.current = command;
    busy.current = true;
    action.mutate(command);
  };
  return (
    <section
      className="game-panel grid min-w-0 gap-3 p-3"
      aria-label={eventId ? "Event invitations and guests" : "Your party invitations"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">
          {eventId ? "Invitations and guests" : "Party invitations"}
        </h2>
        <button
          type="button"
          className={button}
          disabled={!online || invitations.isFetching}
          onClick={() => void invitations.refetch()}
        >
          Refresh invitations
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Accepting confirms a guest-list place. Travel and live event contributions stay separate.
      </p>
      {!online && (
        <p role="status">Offline. Cached invitations are shown; nothing will be queued.</p>
      )}
      {online && invitations.isPending && <p role="status">Loading invitations…</p>}
      {invitations.isError && (
        <div role="alert">
          <p>{invitations.error.message}</p>
          <button
            type="button"
            className={button}
            disabled={!online}
            onClick={() => void invitations.refetch()}
          >
            Retry invitations
          </button>
        </div>
      )}
      {eventId && (
        <form
          className="grid min-w-0 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = query.trim();
            if (!online || !navigator.onLine || next.length < 2) return;
            if (next === search) void players.refetch();
            else setSearch(next);
          }}
        >
          <label className="grid gap-1 text-sm">
            Find a player
            <input
              className="min-h-11 min-w-0 rounded-lg border border-border bg-card px-3"
              maxLength={60}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="submit" className={button} disabled={!online || query.trim().length < 2}>
            Find players
          </button>
          {players.isFetching && <p role="status">Finding players…</p>}
          {players.isError && <p role="alert">Players could not load. Search again to retry.</p>}
          {search.length >= 2 && players.isSuccess && players.data.length === 0 && (
            <p>No matching players.</p>
          )}
          {players.data?.map((player) => (
            <div
              key={player.character_id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2"
            >
              <span style={{ overflowWrap: "anywhere" }}>{player.player_name}</span>
              <button
                type="button"
                className={button}
                disabled={!online || action.isPending || !!request.current || invitations.isError}
                onClick={() =>
                  submit({ kind: "send", eventId, recipientCharacterId: player.character_id })
                }
              >
                Invite {player.player_name}
              </button>
            </div>
          ))}
        </form>
      )}
      {action.isPending && <p role="status">Confirming invitation…</p>}
      {action.isError && !recovered && (
        <div role="alert">
          <p>{action.error.message}</p>
          <button
            type="button"
            className={button}
            disabled={!online || action.isPending}
            onClick={() => {
              if (request.current) submit(request.current.intent, true);
            }}
          >
            Retry confirmation
          </button>
          <button
            type="button"
            className={button}
            onClick={() => {
              request.current = null;
              action.reset();
            }}
          >
            Dismiss retry
          </button>
        </div>
      )}
      {!invitations.isPending && !invitations.isError && rows.length === 0 && (
        <p role="status">{eventId ? "No invitations sent yet." : "No party invitations yet."}</p>
      )}
      <ul
        className="grid min-w-0 gap-3"
        aria-label={eventId ? "Invitation responses and confirmed guests" : "Received invitations"}
      >
        {rows.map((row) => (
          <li
            key={row.id}
            className="grid min-w-0 gap-2 rounded-xl border border-border p-3"
            style={{ overflowWrap: "anywhere" }}
          >
            <h3 className="font-semibold">{row.title}</h3>
            <p className="text-sm">
              {eventId ? `Player: ${row.recipientName}` : `Host: ${row.hostName}`}
            </p>
            <p className="text-xs">
              {row.venue} · {eventTime(row.startsAt)} (Lagos)
            </p>
            <p className="text-sm">
              {row.isGuest ? "Confirmed guest" : row.status} · {row.phase}
            </p>
            {row.status === "pending" && !row.canRespond && !eventId && (
              <p className="text-xs">
                This invitation cannot currently be answered. Refresh for the latest state.
              </p>
            )}
            {!eventId && row.canRespond && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={!online || action.isPending || !!request.current}
                  onClick={() =>
                    submit({
                      kind: "respond",
                      eventId: row.eventId,
                      invitationId: row.id,
                      decision: "accepted",
                    })
                  }
                >
                  Accept {row.title}
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={!online || action.isPending || !!request.current}
                  onClick={() =>
                    submit({
                      kind: "respond",
                      eventId: row.eventId,
                      invitationId: row.id,
                      decision: "declined",
                    })
                  }
                >
                  Decline {row.title}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {invitations.hasNextPage && (
        <button
          type="button"
          className={button}
          disabled={!online || invitations.isFetching}
          onClick={() => void invitations.fetchNextPage()}
        >
          Load more invitations
        </button>
      )}
    </section>
  );
}
