import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Heart, Smile, Zap } from "lucide-react";
import { q, formatNaira, xpProgress } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Avatar } from "@/components/game/Avatar";
import { StatBar } from "@/components/game/ui";
import { Button } from "@/components/ui/button";
import { CityBoard } from "@/components/game/CityBoard";

export const Route = createFileRoute("/_authenticated/_game/home")({
  head: () => pageMeta("City Dashboard", "Your daily overview of life in Osogbo."),
  component: Dashboard,
});

function Dashboard() {
  const { data: c } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const { data: myJobs } = useQuery(q.myJobs());
  const { data: jobs } = useQuery(q.jobs());
  const { data: missions } = useQuery(q.missions());
  if (!c) return null;
  const xp = xpProgress(c.xp);
  const current = myJobs?.find((j) => j.is_current);
  const currentJob = jobs?.find((j) => j.id === current?.job_id);
  const claimable = missions?.filter((m) => m.status === "completed").length ?? 0;
  const active = missions?.filter((m) => m.status === "in_progress").sort((a, b) => (a.mission?.sort_order ?? 0) - (b.mission?.sort_order ?? 0))[0];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div className="brick pop-in flex gap-4 p-5">
          <div className="studs shrink-0 rounded-xl border-2 border-edge p-2"><Avatar appearance={c.appearance as object} size={84} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">E kaabo,</p>
            <h1 className="truncate text-3xl font-bold">{c.name}</h1>
            <p className="text-sm text-muted-foreground">Level {c.level} · {currentJob ? currentJob.name : "Unemployed"}</p>
            <div className="mt-3"><StatBar label="XP to next level" value={xp.into} max={xp.needed} tone="ink" /></div>
          </div>
        </div>
        <div className="brick pop-in grid grid-cols-2 gap-3 p-5">
          <div className="col-span-2">
            <p className="text-xs font-bold text-muted-foreground">Wallet (in-game ₦)</p>
            <p className="font-display text-3xl font-bold">{formatNaira(wallet?.balance)}</p>
          </div>
          <StatBar label="Energy" value={c.energy} tone="sun" icon={<Zap className="h-3 w-3" />} />
          <StatBar label="Health" value={c.health} tone="clay" icon={<Heart className="h-3 w-3" />} />
          <div className="col-span-2"><StatBar label="Happiness" value={c.happiness} tone="leaf" icon={<Smile className="h-3 w-3" />} /></div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="brick p-5">
          <h2 className="text-xl font-bold">Today's work</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentJob ? `You're working as a ${currentJob.name}. Shifts pay ${formatNaira(currentJob.salary)}.` : "You don't have a job yet. Pick one to start earning."}
          </p>
          <Button asChild variant="brick" className="mt-4"><Link to="/jobs"><Briefcase /> {currentJob ? "Go to work" : "Find a job"}</Link></Button>
        </div>
        <div className="brick p-5">
          <h2 className="text-xl font-bold">Missions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {claimable > 0 ? `${claimable} reward${claimable > 1 ? "s" : ""} ready to claim!` : active?.mission ? `Next up: ${active.mission.title}` : "All missions done for now."}
          </p>
          <Button asChild variant={claimable ? "sun" : "plain"} className="mt-4"><Link to="/missions">View missions</Link></Button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Osogbo</h2>
          <Link to="/map" className="text-sm font-bold text-primary underline">Open full map</Link>
        </div>
        <CityBoard compact />
      </section>
    </div>
  );
}
