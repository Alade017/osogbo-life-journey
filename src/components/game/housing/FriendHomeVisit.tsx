import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardFeatureStrip } from "@/components/game/DashboardFeatureStrip";
import { HouseRoomRenderer } from "@/components/game/housing/HouseRoomRenderer";
import { parseFriendHouse } from "@/components/game/housing/friend-house";
import { LoadingState } from "@/components/game/ui";
import { q } from "@/lib/game";

export function FriendHomeVisit({
  characterId,
  onLeave,
}: {
  characterId: string;
  onLeave?: () => void;
}) {
  const navigate = useNavigate();
  const visitQuery = useQuery(q.friendHouseVisit(characterId));
  const house = parseFriendHouse(visitQuery.data);
  const [activeFloor, setActiveFloor] = useState<0 | 1>(0);
  const isDuplex = house?.houseTypeId === "duplex";
  const shownFloor = isDuplex ? activeFloor : 0;
  const toggleFloor = () => setActiveFloor((floor) => (floor === 0 ? 1 : 0));
  const leave =
    onLeave ?? (() => void navigate({ to: "/social", search: { playerId: undefined } }));
  return (
    <div className="game-home home-only-page">
      <div className="arrival-line">
        <div>
          <p className="arrival-kicker">Friend visit</p>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            {house ? `${house.ownerName}'s home` : "Friend's home"}
          </h1>
        </div>
        <Link className="text-primary underline" to="/social" search={{ playerId: undefined }}>
          Back to friends
        </Link>
      </div>
      <DashboardFeatureStrip />
      {visitQuery.isLoading ? (
        <LoadingState />
      ) : visitQuery.isError || !house ? (
        <section className="game-panel p-5" role="status">
          <p>This home is private, unavailable, or no longer shared with you.</p>
        </section>
      ) : (
        <>
          <p className="game-panel p-3 text-sm">
            Read-only visit. You can look around, but you cannot move anything. The owner is not
            shown as present.
          </p>
          <section className="house-room-card" aria-label={`${house.ownerName}'s room`}>
            <HouseRoomRenderer
              houseTypeId={house.houseTypeId}
              wallsClosed={house.wallsClosed}
              activeFloor={shownFloor}
              {...(isDuplex ? { onUseStairs: toggleFloor } : {})}
              accessoryBand="basic"
              slots={house.slots}
              placements={house.placements.filter(
                (placement) => (placement.floor ?? 0) === shownFloor,
              )}
              inputBlocked
              editMode={false}
              moveEnabled={false}
              onSelectPlacement={() => undefined}
              onSelectSlot={() => undefined}
              onMove={() => undefined}
              onMovePosition={() => undefined}
            />
          </section>
          <div className="game-panel flex flex-wrap items-center justify-between gap-3 p-3">
            {isDuplex ? (
              <button type="button" className="house-primary-button" onClick={toggleFloor}>
                {shownFloor === 0 ? "Go upstairs" : "Go downstairs"}
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="house-primary-button" onClick={leave}>
              Leave this home
            </button>
          </div>
        </>
      )}
    </div>
  );
}
