import { Button } from "@/components/ui/button";
import { useLoginStreak } from "@/hooks/login-streak-context";
export function LoginStreakSummary() {
  const status = useLoginStreak();
  if (!status) return null;
  const { snapshot, busy, loading, active, error, retry } = status;
  return (
    <section className="game-panel mb-6 min-w-0 p-4" aria-labelledby="login-streak-title">
      <h2 id="login-streak-title" className="text-xl font-bold">
        Daily check-in
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Check in on consecutive Lagos days. Each day gives up to 5 XP, with no multiplier.
      </p>
      {snapshot && (
        <p className="mt-2 font-semibold">
          {snapshot.streak} day{snapshot.streak === 1 ? "" : "s"} ·{" "}
          {snapshot.todayClaimed
            ? `Today's ${snapshot.rewardXp} XP received`
            : `${snapshot.rewardXp} XP available today`}
        </p>
      )}
      {!active ? (
        <p role="status">Return to this tab and reconnect to check in.</p>
      ) : !error && (loading || busy || !snapshot?.todayClaimed) ? (
        <p role="status">Checking in…</p>
      ) : null}
      {error && (
        <p role="alert" className="mt-2 text-sm">
          {error}
        </p>
      )}
      {error && (
        <Button
          type="button"
          className="mt-2"
          variant="outline"
          disabled={!active || busy}
          onClick={retry}
        >
          Retry daily check-in
        </Button>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        Resets at midnight in Lagos. A missed day starts a new streak.
      </p>
    </section>
  );
}
