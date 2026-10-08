import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { q, formatNaira, xpProgress } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Avatar } from "@/components/game/Avatar";
import {
  Chip,
  GameDataUnavailable,
  LoadingState,
  PageHeader,
  StatBar,
  type Tone,
} from "@/components/game/ui";
import { playerStateFromRows } from "@/lib/player-state";

export const Route = createFileRoute("/_authenticated/_game/profile")({
  head: () => pageMeta("Player Profile", "Your character's stats and progress."),
  component: ProfilePage,
});

function ProfilePage() {
  const {
    data: c,
    isLoading: isCharacterLoading,
    isError: isCharacterError,
    error: characterError,
    refetch,
    isRefetching,
  } = useQuery(q.character());
  const { data: wallet, isLoading: isWalletLoading, isError: isWalletError } = useQuery(q.wallet());
  const { data: jobs } = useQuery(q.jobs());
  const { data: locations } = useQuery(q.locations());
  if (isCharacterError)
    return (
      <GameDataUnavailable
        error={characterError}
        onRetry={() => void refetch()}
        isRetrying={isRefetching}
      />
    );
  if (isCharacterLoading || !c || isWalletLoading) return <LoadingState />;
  const player = playerStateFromRows({
    character: c,
    wallet,
    location: locations?.find((item) => item.id === c.current_location_id),
  });
  const xp = xpProgress(player.experience);
  const dream = jobs?.find((j) => j.slug === c.occupation_preference);
  const stats: [string, number, Tone][] = [
    ["Health", player.health, "clay"],
    ["Energy", player.energy, "sun"],
    ["Hunger · more = hungrier", player.hunger, "clay"],
    ["Reputation", player.reputation, "ink"],
    ["Intelligence", c.intelligence, "ink"],
    ["Career", c.career, "primary"],
    ["Wealth", c.wealth, "leaf"],
  ];

  return (
    <div>
      <PageHeader title="Your character" subtitle="Your life and progress in Osogbo." />
      <div className="grid gap-5 md:grid-cols-[300px_1fr]">
        <section
          className="game-panel player-profile-card p-5 text-center"
          aria-label="Character details"
        >
          <div className="player-profile-avatar mx-auto flex w-fit justify-center rounded-xl border border-border bg-muted p-4">
            <Avatar appearance={c.appearance as object} gender={c.gender} size={130} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-ink">{player.name}</h2>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <Chip tone="primary">Level {player.level}</Chip>
            <Chip>{c.age} yrs</Chip>
            <Chip>{c.personality}</Chip>
          </div>
          <div className="profile-cash-line">
            <span>Wallet</span>
            <strong>{formatNaira(player.cash)}</strong>
          </div>
          <div className="profile-cash-line">
            <span>Bank balance</span>
            <strong>
              {player.bankBalance === null ? "Not set up yet" : formatNaira(player.bankBalance)}
            </strong>
          </div>
          <div className="profile-cash-line">
            <span>Current district</span>
            <strong>{player.location?.name ?? "Osogbo"}</strong>
          </div>
          {dream && (
            <p className="mt-3 text-sm text-muted-foreground">
              Dream job: <strong>{dream.name}</strong>
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            In Osogbo since {new Date(player.createdAt).toLocaleDateString("en-NG")}
          </p>
        </section>
        <section className="game-panel space-y-5 p-5" aria-label="Character stats and progress">
          <div>
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Experience
                </p>
                <h3 className="mt-1 text-xl font-bold text-ink">Level {player.level}</h3>
              </div>
              <span className="text-sm font-semibold text-ink">{player.experience} XP total</span>
            </div>
            <div className="mt-2">
              <StatBar label="Progress to next level" value={xp.into} max={xp.needed} tone="ink" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {stats.map(([l, v, t]) => (
              <StatBar key={l} label={l} value={v} tone={t} />
            ))}
          </div>
          <div className="profile-data-row">
            <div>
              <span>Thirst · more = thirstier</span>
              <strong>{player.thirst === null ? "Not tracked yet" : `${player.thirst}/100`}</strong>
            </div>
            <div>
              <span>Wanted level</span>
              <strong>{player.wantedLevel ?? "Not tracked yet"}</strong>
            </div>
          </div>
          {isWalletError && (
            <p className="text-xs text-muted-foreground">
              Your wallet could not be loaded. Character stats remain available.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
