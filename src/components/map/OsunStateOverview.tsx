import { Building2, Music2, Scale, ShoppingBasket, Smartphone } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import worldData from "@/data/osun-public-places.json";
import {
  clearPendingTownTravelKey,
  getPendingTownTravelKey,
  requestTownTravel,
} from "@/lib/map-api";

type Town = (typeof worldData.towns)[number];

const icons = {
  supermarket: ShoppingBasket,
  club: Music2,
  court: Scale,
  phone_store: Smartphone,
} as const;

export function OsunStateOverview({
  selectedTownId,
  onSelectTown,
  onOpenOsogbo,
}: {
  selectedTownId: string;
  onSelectTown: (id: string) => void;
  onOpenOsogbo: () => void;
}) {
  const selected =
    worldData.towns.find((town) => town.id === selectedTownId) ?? worldData.towns[0]!;
  return (
    <section className="osun-state-overview" aria-label="Osun State places">
      <div className="osun-state-board" aria-label="Hand-placed Osun State town overview">
        <div className="osun-state-route osun-state-route-one" />
        <div className="osun-state-route osun-state-route-two" />
        {worldData.towns.map((town) => (
          <button
            key={town.id}
            type="button"
            className="osun-town-marker"
            style={{ left: `${town.x}%`, top: `${town.y}%` }}
            aria-pressed={selected.id === town.id}
            onClick={() => onSelectTown(town.id)}
          >
            <span>{town.name}</span>
          </button>
        ))}
      </div>
      <TownPublicPlaces town={selected} onOpenOsogbo={onOpenOsogbo} />
    </section>
  );
}

function TownPublicPlaces({ town, onOpenOsogbo }: { town: Town; onOpenOsogbo: () => void }) {
  const travel = useMutation({
    mutationFn: ({ townId, requestId }: { townId: string; requestId: string }) =>
      requestTownTravel(townId, requestId),
    onSuccess: (result, variables) => {
      clearPendingTownTravelKey(variables.townId, variables.requestId);
      toast.success(
        `Your trip to ${town.name} has started. Arrival in ${result.travel_minutes} minutes.`,
      );
    },
    onError: (error: Error) => {
      const messages: Record<string, string> = {
        ALREADY_TRAVELLING: "Finish your current trip before starting another.",
        ALREADY_THERE: `You are already in ${town.name}.`,
        INSUFFICIENT_FUNDS: "You do not have enough money for this trip.",
        TOWN_UNAVAILABLE: "Travel to this town is not available yet.",
      };
      toast.error(messages[error.message] ?? "Town travel could not start.");
    },
  });
  const canTravel = town.id === "ede";
  return (
    <aside className="osun-town-panel" aria-live="polite">
      <header>
        <span className="osun-town-icon">
          <Building2 aria-hidden="true" />
        </span>
        <div>
          <p>Osun State</p>
          <h2>{town.name}</h2>
        </div>
      </header>
      {town.detailed ? (
        <>
          <p>Open the detailed town map to explore districts, jobs and public places.</p>
          <button className="osun-open-town" type="button" onClick={onOpenOsogbo}>
            Open Osogbo map
          </button>
        </>
      ) : (
        <>
          <p>
            Only public venue categories are shown here. Venue names and gameplay businesses are
            fictional.
          </p>
          <ul className="osun-public-place-list">
            {town.publicPlaces.map((place) => {
              const Icon = icons[place.category as keyof typeof icons];
              return (
                <li key={place.id}>
                  <Icon aria-hidden="true" />
                  <span>{place.label}</span>
                </li>
              );
            })}
          </ul>
          {canTravel ? (
            <button
              className="osun-open-town"
              type="button"
              disabled={travel.isPending}
              onClick={() => {
                const requestId = getPendingTownTravelKey(town.id);
                travel.mutate({ townId: town.id, requestId });
              }}
            >
              {travel.isPending ? "Starting trip…" : "Travel to Ede"}
            </button>
          ) : (
            <small>Detailed town travel will unlock when its server route is available.</small>
          )}
        </>
      )}
    </aside>
  );
}
