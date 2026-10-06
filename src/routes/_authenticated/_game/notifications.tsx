import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { q, rpc, useGameAction } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingBricks, PageHeader } from "@/components/game/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_game/notifications")({
  head: () => pageMeta("Notifications", "Updates about your life in Osogbo."),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data: notes, isLoading } = useQuery(q.notifications());
  const mark = useGameAction(rpc.markRead);
  if (isLoading) return <LoadingBricks />;
  const unread = notes?.filter((n) => !n.read_at).length ?? 0;
  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${unread} unread`}
        right={unread > 0 && <Button variant="plain" size="sm" onClick={() => mark.mutate(undefined)}>Mark all read</Button>} />
      {!notes?.length ? <EmptyState title="All quiet" body="No notifications yet." /> : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => !n.read_at && mark.mutate(n.id)}
                className={cn("brick block w-full p-4 text-left", !n.read_at && "bg-sun")}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-lg font-semibold">{n.title}</p>
                  {!n.read_at && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-edge bg-clay" aria-label="Unread" />}
                </div>
                <p className="text-sm">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("en-NG")}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
