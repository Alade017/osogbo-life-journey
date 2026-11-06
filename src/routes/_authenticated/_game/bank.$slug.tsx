import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Landmark, Users, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { BankLobbyScene } from "@/components/3d/BankLobbyScene";
import { EmptyState, LoadingState } from "@/components/game/ui";
import { supabase } from "@/integrations/supabase/client";
import { amountError } from "@/lib/economy-service";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import type { Appearance } from "@/game/avatar-appearance";
import { BANK_BRANCH_STAFF, isBankSlug } from "@/lib/bank-branch-data";

type NetworkConnection = EventTarget & {
  effectiveType?: string;
  saveData?: boolean;
};
type BankPresence = { characterId?: string; name?: string };
type LobbyPlayer = { characterId: string; name: string };
type LobbyNetworkStatus = "connecting" | "connected" | "offline" | "error";

function readNetworkStatus() {
  if (typeof navigator === "undefined") return { online: true, limited: false };
  const connection = (navigator as Navigator & { connection?: NetworkConnection }).connection;
  return {
    online: navigator.onLine,
    limited:
      connection?.saveData === true ||
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g",
  };
}

function useBankPresence(locationId: string | undefined, characterId: string | undefined) {
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [status, setStatus] = useState<LobbyNetworkStatus>("connecting");
  const [online, setOnline] = useState(() => readNetworkStatus().online);

  useEffect(() => {
    const connection = () => setOnline(readNetworkStatus().online);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, []);

  useEffect(() => {
    if (!locationId || !online) {
      setPlayers([]);
      setStatus("offline");
      return;
    }

    let active = true;
    const channel = supabase.channel(`people-area:${locationId}`);
    const sync = () => {
      if (!active) return;
      const state = channel.presenceState<BankPresence>();
      const unique = new Map<string, LobbyPlayer>();
      Object.entries(state).forEach(([key, entries]) => {
        const presence = entries[0];
        const id = presence?.characterId ?? key;
        if (id === characterId || !presence?.name) return;
        unique.set(id, { characterId: id, name: presence.name });
      });
      setPlayers([...unique.values()].sort((left, right) => left.name.localeCompare(right.name)));
    };
    channel.on("presence", { event: "sync" }, sync);
    channel.subscribe((channelStatus) => {
      if (!active) return;
      if (channelStatus === "SUBSCRIBED") {
        setStatus("connected");
        sync();
      } else if (channelStatus === "CHANNEL_ERROR" || channelStatus === "TIMED_OUT") {
        setStatus("error");
      } else if (channelStatus === "CLOSED") {
        setStatus("offline");
      }
    });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
      setPlayers([]);
    };
  }, [characterId, locationId, online]);

  return { players, status, online };
}

export const Route = createFileRoute("/_authenticated/_game/bank/$slug")({
  head: () => pageMeta("Bank branch", "Visit a named Osogbo bank branch and meet its visitors."),
  component: BankPage,
});

function BankPage() {
  const { slug } = Route.useParams();
  const [network, setNetwork] = useState(readNetworkStatus);
  const [interaction, setInteraction] = useState("");
  const [selectedService, setSelectedService] = useState<"teller" | "atm" | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [serviceMessage, setServiceMessage] = useState("");
  const { data: character, isLoading: characterLoading } = useQuery(q.character());
  const locations = useQuery(q.locations());
  const profile = useQuery(q.profile());
  const bank = locations.data?.find(
    (location) => location.slug === slug && location.type === "bank" && location.is_active,
  );
  const atBranch = !!bank && character?.current_location_id === bank.id;
  const presence = useBankPresence(atBranch ? bank.id : undefined, character?.id);
  const bankAccount = useQuery({ ...q.bankAccount(), enabled: atBranch && network.online });
  const wallet = useQuery({ ...q.wallet(), enabled: atBranch && network.online });
  const validSlug = isBankSlug(slug);

  useEffect(() => {
    setInteraction("");
    setSelectedService(null);
    setTransferAmount("");
    setServiceMessage("");
  }, [slug]);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: NetworkConnection }).connection;
    const update = () => setNetwork(readNetworkStatus());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    connection?.addEventListener("change", update);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      connection?.removeEventListener("change", update);
    };
  }, []);

  const openAccount = useGameAction(rpc.openBankAccount, {
    onSuccess: (account) => {
      setServiceMessage(
        `Account ${account.account_number} is open at ${account.branch_name}. Your existing bank balance is available here.`,
      );
      toast.success("Your bank account is open.");
    },
    onError: (error) => setServiceMessage(error.message),
  });
  const deposit = useGameAction(rpc.depositCash, {
    onSuccess: () => {
      setTransferAmount("");
      setServiceMessage("Deposit confirmed by the bank.");
      toast.success("Cash deposited into your bank account.");
    },
    onError: (error) => setServiceMessage(error.message),
  });
  const withdraw = useGameAction(rpc.withdrawCash, {
    onSuccess: () => {
      setTransferAmount("");
      setServiceMessage("Withdrawal confirmed by the bank.");
      toast.success("Cash withdrawn from your bank account.");
    },
    onError: (error) => setServiceMessage(error.message),
  });

  function interact(place: "teller" | "atm" | "seat") {
    if (place === "atm") {
      setSelectedService("atm");
      setInteraction("");
      setServiceMessage("");
      return;
    }
    if (place === "seat") {
      setSelectedService(null);
      setInteraction(
        "You take a seat in the waiting area. Click any clear part of the floor to walk.",
      );
      return;
    }
    setSelectedService("teller");
    setInteraction("");
    setServiceMessage("");
  }

  if (characterLoading || locations.isLoading) return <LoadingState />;

  if (!validSlug || !bank) {
    const availableBanks = locations.data?.filter(
      (location) => location.type === "bank" && location.is_active,
    );
    return (
      <div className="space-y-5">
        <EmptyState
          title="Choose one of Osogbo's bank branches"
          body="Each branch has its own lobby, tellers, queue and live visitors."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {(availableBanks ?? []).map((location) => (
            <Link
              key={location.id}
              to="/bank/$slug"
              params={{ slug: location.slug }}
              className="game-panel block p-4 font-bold text-primary"
            >
              Enter {location.name}
            </Link>
          ))}
          {!availableBanks?.length && (
            <p role="alert" className="text-sm text-destructive">
              Bank branches could not be loaded. Try again when online.
            </p>
          )}
        </div>
        <Link
          to="/map"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Return to the city map
        </Link>
      </div>
    );
  }

  const appearance =
    character?.appearance && typeof character.appearance === "object"
      ? (character.appearance as Appearance)
      : {};
  return (
    <div className="space-y-4">
      <Link
        to="/location/$slug"
        params={{ slug }}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to {bank.name} district
      </Link>

      <header className="game-panel game-panel-accent flex flex-wrap items-center justify-between gap-4 p-5 md:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {bank.type} branch
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">{bank.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{bank.description}</p>
        </div>
        {atBranch ? (
          <a
            href="#branch-services"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-edge bg-primary px-4 py-2 font-bold text-primary-foreground"
          >
            <Landmark size={17} aria-hidden="true" />
            Open account services
          </a>
        ) : (
          <Link
            to="/wallet"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-edge bg-primary px-4 py-2 font-bold text-primary-foreground"
          >
            <Landmark size={17} aria-hidden="true" />
            Wallet overview
          </Link>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
        {atBranch ? (
          <span className="font-bold text-emerald-700" role="status">
            You are at {bank.name}
          </span>
        ) : (
          <span role="status">
            You are not at this branch.{" "}
            <Link
              to="/location/$slug"
              params={{ slug }}
              className="font-bold text-primary underline"
            >
              Travel to {bank.name}
            </Link>{" "}
            to use its services.
          </span>
        )}
        {!network.online ? (
          <span
            className="inline-flex items-center gap-1.5 font-semibold text-destructive"
            role="status"
          >
            <WifiOff size={16} aria-hidden="true" /> Offline: bank services and live visitors are
            unavailable.
          </span>
        ) : network.limited ? (
          <span
            className="inline-flex items-center gap-1.5 font-semibold text-amber-700"
            role="status"
          >
            <Wifi size={16} aria-hidden="true" /> Low network: account services and live visitors
            need a server response.
          </span>
        ) : null}
      </div>

      {atBranch ? (
        <>
          <BankLobbyScene
            key={slug}
            branch={slug}
            bankName={bank.name}
            players={presence.players}
            playerName={character?.name ?? "Your character"}
            appearance={appearance}
            gender={character?.gender ?? "nonbinary"}
            reducedMotion={profile.data?.reduced_motion ?? false}
            onInteract={interact}
          />
          <p className="text-xs text-muted-foreground">
            Walk around by clicking an open floor tile. Click a teller, waiting seat or ATM to
            interact.
          </p>
        </>
      ) : (
        <section className="game-panel space-y-3 border-l-4 border-l-primary p-5">
          <h2 className="font-display text-xl font-bold">Travel to enter the branch</h2>
          <p className="text-sm text-muted-foreground">
            The 3D lobby, tellers, ATM, and live visitors become available when your character
            arrives at {bank.name}.
          </p>
          <Link
            to="/location/$slug"
            params={{ slug }}
            className="inline-flex min-h-10 items-center rounded-lg border-2 border-edge bg-primary px-4 py-2 font-bold text-primary-foreground"
          >
            Travel to {bank.name}
          </Link>
        </section>
      )}

      {atBranch && (
        <section
          id="branch-services"
          className="game-panel space-y-4 p-4 md:p-5"
          aria-labelledby="branch-services-title"
        >
          <div className="flex items-center gap-2">
            <Landmark size={19} className="text-primary" aria-hidden="true" />
            <h2 id="branch-services-title" className="font-display text-xl font-bold">
              {selectedService === "atm"
                ? "ATM services"
                : selectedService === "teller"
                  ? "Teller counter"
                  : "Your bank account"}
            </h2>
          </div>
          {!selectedService ? (
            <p className="text-sm text-muted-foreground">
              Speak with a teller to open an account or use the ATM for cash services.
            </p>
          ) : bankAccount.isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Checking your account…
            </p>
          ) : bankAccount.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Account details could not be loaded: {bankAccount.error.message}
            </p>
          ) : !bankAccount.data ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {selectedService === "teller"
                  ? "A teller can open your personal account here. Your account number will stay with you when you visit other branches."
                  : "Open an account with a teller before using the ATM."}
              </p>
              {selectedService === "teller" && (
                <button
                  type="button"
                  disabled={!network.online || openAccount.isPending}
                  onClick={() => {
                    setServiceMessage("");
                    openAccount.mutate();
                  }}
                  className="min-h-10 rounded-lg border-2 border-edge bg-primary px-4 py-2 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {openAccount.isPending ? "Opening account…" : "Open a bank account"}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Account number
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold">
                    {bankAccount.data.account_number}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Bank balance
                  </p>
                  <p className="mt-1 font-display text-lg font-bold">
                    {wallet.isLoading ? "Loading…" : formatNaira(wallet.data?.bank_balance)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Account opened at {bankAccount.data.branch_name}. Transfers are confirmed by the
                game server and take 3 in-game minutes.
              </p>
              {wallet.isError && (
                <p role="alert" className="text-sm text-destructive">
                  Your balance could not be loaded: {wallet.error.message}
                </p>
              )}
              <div className="space-y-3">
                <label className="block text-sm font-semibold" htmlFor="branch-transfer-amount">
                  Transfer amount
                </label>
                <input
                  id="branch-transfer-amount"
                  className="w-full rounded-lg border-2 border-edge bg-background px-3 py-2"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={transferAmount}
                  onChange={(event) => setTransferAmount(event.target.value)}
                  placeholder="Enter whole Naira amount"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={
                      !network.online ||
                      wallet.isLoading ||
                      wallet.isError ||
                      !wallet.data ||
                      !!amountError(Number(transferAmount), wallet.data?.balance) ||
                      deposit.isPending ||
                      withdraw.isPending
                    }
                    onClick={() => {
                      setServiceMessage("");
                      deposit.mutate(Number(transferAmount));
                    }}
                    className="min-h-10 rounded-lg border-2 border-edge bg-primary px-4 py-2 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deposit.isPending ? "Depositing…" : "Deposit cash"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      !network.online ||
                      wallet.isLoading ||
                      wallet.isError ||
                      !wallet.data ||
                      !!amountError(Number(transferAmount), wallet.data?.bank_balance) ||
                      deposit.isPending ||
                      withdraw.isPending
                    }
                    onClick={() => {
                      setServiceMessage("");
                      withdraw.mutate(Number(transferAmount));
                    }}
                    className="min-h-10 rounded-lg border-2 border-edge bg-secondary px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {withdraw.isPending ? "Withdrawing…" : "Withdraw cash"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {serviceMessage && (
            <p
              className={`rounded-lg p-3 text-sm ${
                openAccount.isError || deposit.isError || withdraw.isError
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10"
              }`}
              role={openAccount.isError || deposit.isError || withdraw.isError ? "alert" : "status"}
            >
              {serviceMessage}
            </p>
          )}
          {interaction && (
            <p className="rounded-lg bg-muted p-3 text-sm" role="status">
              {interaction}
            </p>
          )}
        </section>
      )}

      {atBranch && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
          <aside className="space-y-4">
            <section className="game-panel space-y-3 p-4" aria-labelledby="bank-people-title">
              <div className="flex items-center justify-between gap-2">
                <h2
                  id="bank-people-title"
                  className="flex items-center gap-2 font-display font-bold"
                >
                  <Users size={18} className="text-primary" aria-hidden="true" />
                  People in this branch
                </h2>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
                  {presence.players.length} online
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Other players appear here while they are visiting this exact bank location.
              </p>
              {presence.status === "connecting" ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Connecting to live visitors…
                </p>
              ) : presence.status === "offline" ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Reconnect to see live visitors.
                </p>
              ) : presence.status === "error" ? (
                <p role="alert" className="text-sm text-destructive">
                  Live visitor status is temporarily unavailable.
                </p>
              ) : presence.players.length ? (
                <ul className="space-y-2">
                  {presence.players.map((player) => (
                    <li
                      key={player.characterId}
                      className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                      {player.name}
                      <span className="ml-auto text-xs text-muted-foreground">Visitor</span>
                    </li>
                  ))}
                  {presence.players.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      {presence.players.length - 5} more visitors are in the lobby.
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No other players are here right now.
                </p>
              )}
            </section>

            <section className="game-panel space-y-3 p-4" aria-labelledby="bank-staff-title">
              <h2 id="bank-staff-title" className="flex items-center gap-2 font-display font-bold">
                <BriefcaseBusiness size={18} className="text-primary" aria-hidden="true" />
                Branch staff
              </h2>
              <ul className="space-y-2">
                {BANK_BRANCH_STAFF[slug].map((employee) => (
                  <li
                    key={employee.name}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-semibold">{employee.name}</span>
                    <span className="text-xs text-muted-foreground">{employee.role}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/jobs"
                className="inline-flex min-h-10 items-center text-sm font-bold text-primary underline"
              >
                Explore bank careers
              </Link>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
