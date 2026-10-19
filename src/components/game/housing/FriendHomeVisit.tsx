import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HomeInterior } from "@/components/game/HomeInterior";
import { DashboardFeatureStrip } from "@/components/game/DashboardFeatureStrip";
import { LoadingState } from "@/components/game/ui";
import { q } from "@/lib/game";
import { parseHousingSave } from "@/lib/housing-service";

export function FriendHomeVisit({ characterId }: { characterId: string }) {
  const navigate = useNavigate();
  const visitQuery = useQuery(q.friendHomeVisit(characterId));
  const data =
    visitQuery.data && typeof visitQuery.data === "object" && !Array.isArray(visitQuery.data)
      ? (visitQuery.data as { player_name?: unknown; payload?: unknown })
      : null;
  const payload = parseHousingSave(data?.payload);
  return (
    <div className="game-home home-only-page">
      <div className="arrival-line">
        <div>
          <p className="arrival-kicker">Friend visit</p>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            Saved home layout
          </h1>
        </div>
        <Link className="text-primary underline" to="/social" search={{ playerId: undefined }}>
          Back to friends
        </Link>
      </div>
      <DashboardFeatureStrip />
      {visitQuery.isLoading ? (
        <LoadingState />
      ) : visitQuery.isError || !payload ? (
        <section className="game-panel p-5" role="status">
          <p>This home is private, unavailable, or no longer shared with you.</p>
        </section>
      ) : (
        <>
          <p className="game-panel p-3 text-sm">
            Saved layout visit · read-only. The owner is not shown as present; this is not a live
            multiplayer room.
          </p>
          <HomeInterior
            key={`${characterId}:${JSON.stringify(payload)}`}
            initialSave={payload}
            readOnly
            visitorName={typeof data?.player_name === "string" ? data.player_name : "your friend"}
            onLeave={() => void navigate({ to: "/social", search: { playerId: undefined } })}
          />
        </>
      )}
    </div>
  );
}
