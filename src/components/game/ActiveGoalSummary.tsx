import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMissions } from "@/hooks/use-missions";
import { activeGoal } from "@/lib/mission-service";
import { formatNaira } from "@/lib/game";

export function ActiveGoalSummary() {
  const query = useMissions();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online",update); window.addEventListener("offline",update);
    return () => { window.removeEventListener("online",update); window.removeEventListener("offline",update); };
  }, []);
  const goal = activeGoal(query.data ?? []);
  const definition = goal?.mission;
  const target = Math.max(1,definition?.target ?? 1);
  const progress = Math.max(0,Math.min(target,goal?.progress ?? 0));
  return <section className="home-active-goal game-panel" aria-label="Active goal">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <strong>{definition?.title ?? "Your next goal"}</strong>
      <Link to="/missions" className="inline-flex min-h-11 items-center font-semibold text-primary">View missions</Link>
    </div>
    {!online && <p className="text-sm text-muted-foreground">Offline — {query.data ? "showing last confirmed progress." : "connect to load goals."}</p>}
    {query.isError && <p role="alert">Could not refresh goals. <button type="button" className="min-h-11 font-semibold text-primary" disabled={!online || query.isFetching} onClick={()=>void query.refetch()}>Try again</button></p>}
    {!query.data && !query.isError && online && <p role="status">Loading your goal…</p>}
    {definition && goal && <>
      <p className="text-sm text-muted-foreground">{definition.description}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label={`${definition.title} progress`} aria-valuemin={0} aria-valuemax={target} aria-valuenow={progress}>
        <div className="h-full bg-primary" style={{width:`${progress/target*100}%`}} />
      </div>
      <p className="mt-2 text-sm">{definition.slug === "earn_10000" ? `${formatNaira(progress)} / ${formatNaira(target)}` : `${progress} / ${target}`} · Reward: {formatNaira(definition.reward_money)}{definition.reward_xp ? ` · ${definition.reward_xp} XP` : ""}</p>
      {goal.status === "completed" && <p className="text-sm font-semibold text-primary">Ready to claim in Missions</p>}
    </>}
    {query.data && !goal && <p className="text-sm">{query.data.length ? "All lifetime goals claimed. Explore daily tasks in Missions." : "No lifetime goals available yet."}</p>}
  </section>;
}
