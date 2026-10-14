import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Church, FileText, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useGameAction, rpc } from "@/lib/game";
import { searchPlayerProfiles } from "@/lib/player-social-service";
import { formatNaira } from "@/lib/game";
import { toast } from "sonner";

export function LocationActivities({
  locationId,
  slug,
  isHere,
}: {
  locationId: string;
  slug: string;
  isHere: boolean;
}) {
  const [tithe, setTithe] = useState("500");
  const [playerQuery, setPlayerQuery] = useState("");
  const [targetId, setTargetId] = useState("");
  const [details, setDetails] = useState("");
  const isReligious = slug.includes("mosque") || slug.includes("church");
  const isCourt = slug === "osogbo-high-court";
  const players = useQuery({
    queryKey: ["locationCasePlayers", playerQuery],
    queryFn: () => searchPlayerProfiles(playerQuery),
    enabled: isCourt && playerQuery.trim().length >= 2,
    staleTime: 30_000,
  });
  const action = useGameAction(rpc.performLocationActivity, {
    onSuccess: (result) => {
      const response = result as { message?: string; amount?: number };
      toast.success(response.message ?? "Activity complete.");
      if (response.amount) toast.message(`Contribution: ${formatNaira(response.amount)}`);
      setDetails("");
      setTargetId("");
    },
  });

  if (!isHere || (!isReligious && !isCourt)) return null;
  const disabled = action.isPending;
  const submit = (type: "worship" | "tithe" | "file_complaint", amount = 0) =>
    action.mutate({
      locationId,
      action: type,
      amount,
      targetCharacterId: targetId || null,
      details: details.trim() || null,
      requestId: crypto.randomUUID(),
    });

  return (
    <section className="game-panel space-y-4 p-4" aria-label="Activities at this location">
      <div className="flex items-center gap-2">
        {isReligious ? (
          <Church className="h-5 w-5 text-primary" />
        ) : (
          <FileText className="h-5 w-5 text-primary" />
        )}
        <h2 className="text-lg font-bold">Activities here</h2>
      </div>
      {isReligious && (
        <div className="flex flex-wrap items-end gap-3">
          <Button disabled={disabled} onClick={() => submit("worship")}>
            <HeartHandshake className="mr-2 h-4 w-4" />
            {action.isPending ? "Saving…" : "Attend worship"}
          </Button>
          <label className="grid gap-1 text-xs font-semibold">
            Tithe amount (in-game Naira)
            <Input
              type="number"
              min={50}
              max={50_000}
              step={50}
              value={tithe}
              onChange={(event) => setTithe(event.target.value)}
              className="w-44"
            />
          </label>
          <Button
            variant="outline"
            disabled={disabled || !Number.isSafeInteger(Number(tithe)) || Number(tithe) < 50}
            onClick={() => submit("tithe", Number(tithe))}
          >
            Give tithe
          </Button>
        </div>
      )}
      {isCourt && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid content-start gap-1 text-xs font-semibold">
            Find the other player
            <Input
              value={playerQuery}
              onChange={(event) => {
                setPlayerQuery(event.target.value);
                setTargetId("");
              }}
              placeholder="Search player name"
              autoComplete="off"
            />
            {playerQuery.trim().length >= 2 && (
              <div className="max-h-32 overflow-y-auto rounded-lg border bg-card">
                {(players.data ?? []).map((player) => (
                  <button
                    type="button"
                    key={player.character_id}
                    onClick={() => {
                      setTargetId(player.character_id);
                      setPlayerQuery(player.player_name);
                    }}
                    className={`block min-h-10 w-full px-3 text-left hover:bg-muted ${targetId === player.character_id ? "bg-muted font-bold" : ""}`}
                  >
                    {player.player_name} · Level {player.level}
                  </button>
                ))}
                {players.isFetching && <p className="p-2 text-muted-foreground">Searching…</p>}
                {!players.isFetching && !players.data?.length && (
                  <p className="p-2 text-muted-foreground">No players found.</p>
                )}
              </div>
            )}
          </label>
          <label className="grid gap-1 text-xs font-semibold sm:row-span-2">
            Short case summary
            <Textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              minLength={20}
              maxLength={500}
              placeholder="Describe the fictional in-game dispute (20–500 characters)."
            />
            <span className="font-normal text-muted-foreground">
              Fictional roleplay only; this is not a real legal filing.
            </span>
          </label>
          <Button
            className="w-fit"
            disabled={
              disabled || !targetId || details.trim().length < 20 || details.trim().length > 500
            }
            onClick={() => submit("file_complaint")}
          >
            File in-game complaint
          </Button>
        </div>
      )}
      {action.error && (
        <p role="alert" className="text-sm text-destructive">
          {action.error.message}
        </p>
      )}
    </section>
  );
}
