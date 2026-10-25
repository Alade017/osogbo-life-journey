import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { claimDailyTask, dailyTaskOptions, dailyTasksKey } from "@/lib/daily-task-service";

export function DailyTasks({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const tasks = useQuery(dailyTaskOptions(userId));
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [message, setMessage] = useState<string | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const claim = useMutation({
    mutationFn: claimDailyTask,
    retry: false,
    onSuccess: async (result) => {
      setMessage(`Reward claimed: +${result.rewardXp} XP`);
      toast.success(`Reward claimed: +${result.rewardXp} XP`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dailyTasksKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ["character"] }),
        queryClient.invalidateQueries({ queryKey: ["missions"] }),
      ]);
    },
    onError: async (error) => {
      setMessage(error.message);
      // Includes stale-day failures: never automatically claim a replacement day.
      await queryClient.invalidateQueries({ queryKey: dailyTasksKey(userId) });
    },
  });
  async function submit(key: string) {
    if (submitting.current || !navigator.onLine || !tasks.data) return;
    submitting.current = true;
    setMessage(null);
    try {
      await claim.mutateAsync({ key, date: tasks.data.date });
    } catch {
      /* The mutation displays the server error. */
    } finally {
      submitting.current = false;
    }
  }
  return (
    <section aria-labelledby="daily-tasks-title" className="mb-6 min-w-0">
      <h2 id="daily-tasks-title" className="text-2xl font-bold">
        Daily tasks
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Complete activities, then claim your XP. Resets at midnight in Lagos.
        {tasks.data ? ` Today: ${tasks.data.date}.` : ""}
      </p>
      {!online && <p role="status">Reconnect to refresh tasks and claim rewards.</p>}
      {tasks.isPending && <p role="status">Loading daily tasks…</p>}
      {tasks.isError && (
        <div role="alert">
          <p>{tasks.error.message}</p>
          <Button
            type="button"
            variant="outline"
            disabled={!online || tasks.isFetching}
            onClick={() => void tasks.refetch()}
          >
            Refresh daily tasks
          </Button>
        </div>
      )}
      {message && (
        <p role="status" className="my-2 text-sm">
          {message}
        </p>
      )}
      <div className="grid min-w-0 gap-4 md:grid-cols-3">
        {tasks.data?.tasks.map((task) => (
          <article key={task.key} className="game-panel min-w-0 p-4">
            <h3 className="break-words text-lg font-bold">{task.title}</h3>
            <p className="my-2 text-sm">
              +{task.rewardXp} XP ·{" "}
              {task.claimed ? "Claimed" : task.completed ? "Ready to claim" : "In progress"}
            </p>
            <Button
              type="button"
              size="sm"
              className="max-w-full"
              disabled={
                !online || tasks.isError || claim.isPending || task.claimed || !task.completed
              }
              onClick={() => void submit(task.key)}
              aria-label={`Claim ${task.title}`}
            >
              {task.claimed
                ? "Claimed"
                : claim.isPending && claim.variables?.key === task.key
                  ? "Claiming…"
                  : "Claim XP"}
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
