import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  CalendarDays,
  Compass,
  Heart,
  MapPin,
  Moon,
  Navigation,
  ShoppingBag,
  Smile,
  Target,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import cityPhoto from "@/assets/osogbo-city.jpg";
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
  const { data: visits } = useQuery(q.visits());
  const { data: locations } = useQuery(q.locations());
  const { data: transactions } = useQuery(q.transactions());
  const [cityTime, setCityTime] = useState("");
  useEffect(() => {
    const update = () =>
      setCityTime(
        new Date().toLocaleString("en-NG", {
          timeZone: "Africa/Lagos",
          weekday: "long",
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);
  if (!c) return null;
  const xp = xpProgress(c.xp);
  const current = myJobs?.find((j) => j.is_current);
  const currentJob = jobs?.find((j) => j.id === current?.job_id);
  const claimable = missions?.filter((m) => m.status === "completed").length ?? 0;
  const active = missions
    ?.filter((m) => m.status === "in_progress")
    .sort((a, b) => (a.mission?.sort_order ?? 0) - (b.mission?.sort_order ?? 0))[0];
  const currentLocation = locations?.find((location) => location.id === c.current_location_id);
  const nearbyLocations =
    locations?.filter((location) => location.id !== c.current_location_id).slice(0, 3) ?? [];
  const xpRemaining = xp.needed - xp.into;
  const recentActivity = [
    ...(transactions ?? []).map((transaction) => ({
      key: transaction.id,
      title: transaction.description,
      detail: `${transaction.kind === "income" ? "+" : "−"}${formatNaira(transaction.amount)}`,
      time: transaction.created_at,
      tone: transaction.kind === "income" ? "text-primary" : "text-clay",
    })),
    ...(visits ?? []).map((visit) => ({
      key: visit.id,
      title: `Explored ${locations?.find((location) => location.id === visit.location_id)?.name ?? "a district"}`,
      detail: `${visit.visit_count} visit${visit.visit_count === 1 ? "" : "s"}`,
      time: visit.last_visited_at,
      tone: "text-foreground",
    })),
  ]
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="relative isolate flex min-h-62.5 items-end overflow-hidden rounded-xl bg-ink text-white md:min-h-75">
        <img
          src={cityPhoto}
          alt="A wide view of Osogbo"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-linear-to-r from-slate-950/80 via-slate-950/45 to-slate-950/10" />
        <div className="relative flex w-full items-end gap-4 p-5 sm:p-7 md:gap-5 md:p-9">
          <div className="shrink-0 rounded-xl border border-white/30 bg-white/15 p-2 backdrop-blur-sm">
            <Avatar appearance={c.appearance as object} gender={c.gender} size={76} />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">E kaabo,</p>
            <h1 className="mt-1 truncate text-3xl font-bold sm:text-4xl md:text-5xl">{c.name}</h1>
            <p className="mt-1 text-sm text-white/85">
              Age {c.age} · Level {c.level} ·{" "}
              {currentJob ? currentJob.name : "Ready for your first job"}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/75">
              <MapPin className="h-3.5 w-3.5" />
              {currentLocation?.name ?? "City Centre"}
              <span className="mx-1">·</span>
              {cityTime} in Osogbo
            </p>
            <div className="mt-4 max-w-md">
              <StatBar label="Progress to next level" value={xp.into} max={xp.needed} tone="sun" />
            </div>
          </div>
        </div>
        <a
          href="https://commons.wikimedia.org/wiki/File:Osogbo.jpg"
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 right-3 text-[9px] text-white/80 underline underline-offset-2"
        >
          El-Shaddaites · CC BY-SA 4.0
        </a>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="brick p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Wallet className="h-4 w-4 text-primary" />
            Wallet · in-game ₦
          </p>
          <p className="mt-2 font-display text-2xl font-bold">{formatNaira(wallet?.balance)}</p>
        </div>
        <div className="brick p-4">
          <StatBar label="Energy" value={c.energy} tone="sun" icon={<Zap className="h-3 w-3" />} />
        </div>
        <div className="brick p-4">
          <StatBar
            label="Health"
            value={c.health}
            tone="clay"
            icon={<Heart className="h-3 w-3" />}
          />
        </div>
        <div className="brick p-4">
          <StatBar
            label="Happiness"
            value={c.happiness}
            tone="leaf"
            icon={<Smile className="h-3 w-3" />}
          />
        </div>
        <div className="brick p-4">
          <StatBar
            label="Reputation"
            value={c.reputation}
            tone="ink"
            icon={<Award className="h-3 w-3" />}
          />
        </div>
        <div className="brick p-4">
          <StatBar label="Hunger" value={c.hunger} tone="clay" />
        </div>
        <div className="brick p-4">
          <StatBar label="Stress" value={c.stress} tone="ink" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="brick p-5">
          <h2 className="text-xl font-bold">Today's work</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentJob
              ? `You're working as a ${currentJob.name}. Shifts pay ${formatNaira(currentJob.salary)}.`
              : "You don't have a job yet. Pick one to start earning."}
          </p>
          <Button asChild variant="brick" className="mt-4">
            <Link to="/jobs">
              <Briefcase /> {currentJob ? "Go to work" : "Find a job"}
            </Link>
          </Button>
        </div>
        <div className="brick p-5">
          <h2 className="text-xl font-bold">Missions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {claimable > 0
              ? `${claimable} reward${claimable > 1 ? "s" : ""} ready to claim!`
              : active?.mission
                ? `Next up: ${active.mission.title}`
                : "All missions done for now."}
          </p>
          {active?.mission && (
            <div className="mt-4 space-y-2">
              <StatBar
                label={`${active.mission.title} · ${active.progress}/${active.mission.target}`}
                value={active.progress}
                max={active.mission.target}
                tone="leaf"
              />
              <p className="text-xs font-semibold text-muted-foreground">
                Reward: {formatNaira(active.mission.reward_money)}
                {active.mission.reward_xp ? ` · ${active.mission.reward_xp} XP` : ""}
              </p>
            </div>
          )}
          <Button asChild variant={claimable ? "sun" : "plain"} className="mt-4">
            <Link to="/missions">View missions</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="brick p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Current location
              </p>
              <h2 className="mt-2 text-2xl font-bold">{currentLocation?.name ?? "City Centre"}</h2>
            </div>
            <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-bold">
              {currentLocation?.district_type ?? "Civic district"}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {currentLocation?.tagline ?? "The beating heart of town"}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button asChild variant="plain" size="sm">
              <Link to="/jobs">
                <Briefcase /> Work
              </Link>
            </Button>
            <Button asChild variant="plain" size="sm">
              <Link to="/map">
                <Compass /> Explore
              </Link>
            </Button>
            <Button asChild variant="plain" size="sm">
              <Link to="/education">
                <BookOpen /> Study
              </Link>
            </Button>
            <span
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 text-xs font-semibold text-muted-foreground"
              title="Resting is not implemented yet"
            >
              <Moon className="h-4 w-4" />
              Rest · planned
            </span>
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Nearby districts</h3>
              <Link to="/map" className="text-xs font-bold text-primary underline">
                Full map
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {nearbyLocations.map((location) => (
                <Link
                  key={location.id}
                  to="/location/$slug"
                  params={{ slug: location.slug }}
                  className="rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted"
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-bold">
                    {location.name}
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Fare {formatNaira(location.travel_fare)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="brick p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-xl font-bold">Your next move</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {c.energy < 25
              ? "Energy is running low. It regenerates over time; wait before taking another shift."
              : xpRemaining <= 25
                ? `You are ${xpRemaining} XP from Level ${c.level + 1}. A job shift or new district visit can move you closer.`
                : !currentJob
                  ? "Choose a first job to start earning in-game Naira."
                  : active?.mission
                    ? `Mission in progress: ${active.mission.title}. Keep going to claim its reward.`
                    : "Your next job shift earns money and career experience."}
          </p>
          <Button asChild variant="brick" className="mt-4">
            <Link
              to={
                c.energy < 25
                  ? "/profile"
                  : !currentJob
                    ? "/jobs"
                    : xpRemaining <= 25
                      ? "/map"
                      : "/jobs"
              }
            >
              {c.energy < 25
                ? "Review your stats"
                : !currentJob
                  ? "Choose a job"
                  : xpRemaining <= 25
                    ? "Explore for XP"
                    : "Open jobs"}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="brick p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Activity className="h-5 w-5 text-primary" />
              Recent activity
            </h2>
            <Link to="/wallet" className="text-xs font-bold text-primary underline">
              Wallet history
            </Link>
          </div>
          {recentActivity.length ? (
            <ul className="mt-4 divide-y divide-border">
              {recentActivity.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(item.time).toLocaleString("en-NG", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-bold ${item.tone}`}>{item.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Your visits and earnings will appear here.
            </p>
          )}
        </div>
        <div className="brick p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Around the city</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Live scheduled events and NPC activity are planned for a future update. Your current
            city map, district visits and missions are playable now.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="plain" size="sm">
              <Link to="/missions">
                <Target />
                Missions
              </Link>
            </Button>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-xs font-semibold text-muted-foreground">
              <ShoppingBag className="h-3.5 w-3.5" />
              Shop · planned
            </span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-xs font-semibold text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Social · planned
            </span>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Osogbo</h2>
          <Link to="/map" className="text-sm font-bold text-primary underline">
            Open full map
          </Link>
        </div>
        <CityBoard compact />
      </section>
    </div>
  );
}
