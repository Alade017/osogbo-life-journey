import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { q, formatNaira, xpProgress } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Avatar } from "@/components/game/Avatar";
import { Chip, LoadingBricks, PageHeader, StatBar, type Tone } from "@/components/game/ui";

export const Route = createFileRoute("/_authenticated/_game/profile")({
  head: () => pageMeta("Player Profile", "Your character's stats and progress."),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: c } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const { data: jobs } = useQuery(q.jobs());
  if (!c) return <LoadingBricks />;
  const xp = xpProgress(c.xp);
  const dream = jobs?.find((j) => j.slug === c.occupation_preference);
  const stats: [string, number, Tone][] = [
    ["Energy", c.energy, "sun"], ["Health", c.health, "clay"], ["Happiness", c.happiness, "leaf"],
    ["Reputation", c.reputation, "ink"], ["Intelligence", c.intelligence, "ink"], ["Social", c.social, "sun"],
    ["Career", c.career, "primary"], ["Wealth", c.wealth, "primary"],
  ];

  return (
    <div>
      <PageHeader title="Player Profile" />
      <div className="grid gap-5 md:grid-cols-[300px_1fr]">
        <div className="brick p-5 text-center">
          <div className="studs mx-auto flex w-fit justify-center rounded-xl border-2 border-edge p-4"><Avatar appearance={c.appearance as object} size={130} /></div>
          <h2 className="mt-4 text-3xl font-bold">{c.name}</h2>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <Chip tone="sun">Level {c.level}</Chip>
            <Chip>{c.age} yrs</Chip>
            <Chip>{c.personality}</Chip>
          </div>
          {dream && <p className="mt-3 text-sm text-muted-foreground">Dream job: <strong>{dream.name}</strong></p>}
          <p className="mt-1 text-sm text-muted-foreground">Balance: <strong>{formatNaira(wallet?.balance)}</strong></p>
          <p className="mt-1 text-xs text-muted-foreground">In Osogbo since {new Date(c.created_at).toLocaleDateString("en-NG")}</p>
        </div>
        <div className="brick space-y-4 p-5">
          <div>
            <div className="flex items-baseline justify-between"><h3 className="text-xl font-bold">Level {c.level}</h3><span className="text-sm font-semibold">{c.xp} XP total</span></div>
            <div className="mt-2"><StatBar label="Progress to next level" value={xp.into} max={xp.needed} tone="ink" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {stats.map(([l, v, t]) => <StatBar key={l} label={l} value={v} tone={t} />)}
          </div>
          <p className="text-xs text-muted-foreground">Stats change only through in-game actions validated by the game server.</p>
        </div>
      </div>
    </div>
  );
}
