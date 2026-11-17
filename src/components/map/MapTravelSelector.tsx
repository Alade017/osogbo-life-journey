import { useMemo, type ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GameTime } from "@/lib/game-time";
import type { Location } from "@/lib/game";
import { isPlayableDistrict } from "@/game/playable-district";
import { MapApiError, requestMapLandmark } from "@/lib/map-api";
import {
  estimateTrip,
  getAvailableTravelModes,
  TRAVEL_MODE_DETAILS,
  type TravelMode,
} from "@/lib/transport-service";
import { adjustedTripMinutes } from "@/lib/world-simulation";
import { DestinationSheet, type DestinationSheetStatus } from "./DestinationSheet";
import { LandmarkDetailsContent } from "./LandmarkDetailsContent";
import { mapTravelBusy, type MapTravelState, type MapTravelTab } from "./map-travel-state";

type Destination = Pick<
  Location,
  "id" | "slug" | "name" | "travel_fare" | "travel_minutes" | "level_required" | "metadata"
>;
type DetailsProps = Omit<
  ComponentProps<typeof LandmarkDetailsContent>,
  "detailsQuery" | "landmark" | "accountId" | "characterId" | "offline"
>;
type Props = {
  open: boolean;
  landmark: { id: string; label: string; category: string };
  districtName: string;
  accountId?: string;
  characterId?: string;
  destination: Destination | null;
  isLoadingDestination: boolean;
  destinationLoadError: boolean;
  onRetryDestination: () => void;
  originName: string;
  currentLocationId: string | null;
  characterLevel: number | null;
  walletBalance: number | null;
  walletLoading: boolean;
  onRetryWallet: () => void;
  gameTime: GameTime;
  offline: boolean;
  state: Pick<
    MapTravelState<unknown>,
    "tab" | "mode" | "phase" | "error" | "confirmedDestinationId"
  >;
  onTabChange: (tab: MapTravelTab) => void;
  onModeChange: (mode: TravelMode) => void;
  onConfirm: (mode: TravelMode) => void;
  onCancel: () => void;
  onRetryArrival: () => void;
  detailsProps: DetailsProps;
};
/** Data/eligibility adapter. The visual sheet receives no network or transaction dependencies. */
export function MapTravelSelector(props: Props) {
  const playable = !!props.destination && isPlayableDistrict(props.destination.slug);
  const modes = useMemo(
    () => (props.destination ? getAvailableTravelModes(props.destination.metadata) : []),
    [props.destination],
  );
  const detailsQuery = useQuery({
    queryKey: ["mapLandmarkDetails", props.landmark.id, props.accountId, props.characterId],
    queryFn: ({ signal }) => {
      if (!props.accountId) throw new Error("Player account is not ready.");
      return requestMapLandmark(props.landmark.id, props.accountId, signal);
    },
    enabled: props.open && !!props.accountId && !!props.characterId && !props.offline,
    staleTime: 15_000,
    refetchInterval: props.state.tab === "details" ? 15_000 : false,
    refetchIntervalInBackground: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
  });
  const restricted =
    detailsQuery.error instanceof MapApiError && detailsQuery.error.code === "AGE_RESTRICTED";
  const busy = mapTravelBusy(props.state.phase),
    confirmed = !!props.state.confirmedDestinationId;
  const options = useMemo(
    () =>
      props.destination
        ? modes.map((mode) => {
            const estimate = estimateTrip(
              mode,
              props.destination!.travel_fare,
              props.destination!.travel_minutes,
            );
            return {
              id: mode,
              ...TRAVEL_MODE_DETAILS[mode],
              fare: estimate.fare,
              minutes: adjustedTripMinutes(estimate.minutes, mode, props.gameTime),
            };
          })
        : [],
    [props.destination, modes, props.gameTime],
  );
  let status: DestinationSheetStatus = { message: "Destination access confirmed.", tone: "ready" };
  if (confirmed) status = { message: "Loading your saved destination…", tone: "loading" };
  else if (props.offline)
    status = { message: "Reconnect to check access and travel.", tone: "blocked" };
  else if (props.isLoadingDestination)
    status = { message: "Loading destination…", tone: "loading" };
  else if (props.destinationLoadError)
    status = {
      message: "Destination information could not be loaded.",
      tone: "error",
      action: { label: "Retry destination lookup", onClick: props.onRetryDestination },
    };
  else if (!props.destination)
    status = { message: "This place is not available for travel yet.", tone: "blocked" };
  else if (!playable) status = { message: "Travel is not available here yet.", tone: "blocked" };
  else if (
    !props.accountId ||
    !props.characterId ||
    props.characterLevel === null ||
    detailsQuery.isPending
  )
    status = { message: "Checking destination access…", tone: "loading" };
  else if (restricted)
    status = { message: "This place is restricted for your character.", tone: "blocked" };
  else if (detailsQuery.isError)
    status = {
      message: "Destination access could not be verified.",
      tone: "error",
      action: {
        label: detailsQuery.isFetching ? "Checking…" : "Retry access check",
        onClick: () => void detailsQuery.refetch(),
        disabled: detailsQuery.isFetching,
      },
    };
  else if (props.currentLocationId === props.destination.id)
    status = { message: "Your character is already at this destination.", tone: "blocked" };
  else if (props.characterLevel < props.destination.level_required)
    status = {
      message: `Reach level ${props.destination.level_required} to travel here.`,
      tone: "blocked",
    };
  else if (!modes.length)
    status = { message: "No transport is available for this destination.", tone: "blocked" };
  const selected = options.find((option) => option.id === props.state.mode);
  const affordable =
    !!selected &&
    (selected.fare === 0 || (props.walletBalance !== null && props.walletBalance >= selected.fare));
  const actionPending = props.detailsProps.pending || props.detailsProps.actionPending;
  const canChoose = status.tone === "ready" && !busy && !confirmed && !actionPending;
  return (
    <DestinationSheet
      open={props.open}
      interactionPending={actionPending}
      title={props.landmark.label}
      category={props.landmark.category}
      districtName={props.districtName}
      originName={props.originName}
      destinationName={props.destination?.name ?? props.districtName}
      tab={props.state.tab}
      onTabChange={props.onTabChange}
      selectedMode={props.state.mode}
      onModeChange={props.onModeChange}
      options={options}
      walletBalance={props.walletBalance}
      walletLoading={props.walletLoading}
      onRetryBalance={props.onRetryWallet}
      status={status}
      phase={props.state.phase}
      error={props.state.error}
      canChooseMode={canChoose}
      canTravel={canChoose && affordable}
      onConfirm={() => {
        if (canChoose && affordable && selected) props.onConfirm(selected.id);
      }}
      onClose={props.onCancel}
      onRetryArrival={props.onRetryArrival}
      details={
        <LandmarkDetailsContent
          {...props.detailsProps}
          detailsQuery={detailsQuery}
          landmark={props.landmark}
          accountId={props.accountId}
          characterId={props.characterId}
          offline={props.offline}
        />
      }
    />
  );
}
