import { Component, Suspense, lazy, type ReactNode } from "react";
import {
  homeRendererChoice,
  type HomeRenderer,
  type HouseRoomRendererProps,
} from "./house-room-contract";

const R3FRoom = lazy(() =>
  import("./HouseRoom3D").then((module) => ({ default: module.HouseRoom3D })),
);
const PlayCanvasRoom = lazy(() =>
  import("./HouseRoomPlayCanvas").then((module) => ({ default: module.HouseRoomPlayCanvas })),
);

class RendererBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetKey: string },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed)
      this.setState({ failed: false });
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function RoomControls(props: HouseRoomRendererProps) {
  return (
    <div
      className="house-3d-scene house-renderer-unavailable"
      role="region"
      aria-label="Room controls"
    >
      <p role="status">Your 3D room is unavailable. You can still select your items here.</p>
      {props.placements.map((placement) => (
        <button key={placement.id} type="button" onClick={() => props.onSelectPlacement(placement)}>
          {placement.item_id.replaceAll("-", " ")}
        </button>
      ))}
      {props.editMode &&
        props.slots
          .filter((slot) => !props.placements.some((placement) => placement.slot === slot.id))
          .map((slot) => (
            <button key={slot.id} type="button" onClick={() => props.onSelectSlot(slot)}>
              Place in {slot.slot_type} slot
            </button>
          ))}
    </div>
  );
}

export function HouseRoomRenderer({
  renderer,
  inputBlocked = false,
  ...props
}: HouseRoomRendererProps & { renderer?: HomeRenderer; inputBlocked?: boolean }) {
  const selected = renderer ?? homeRendererChoice(import.meta.env["VITE_HOME_RENDERER"]);
  const fallback = (
    <RendererBoundary resetKey={`r3f:${props.houseTypeId}`} fallback={<RoomControls {...props} />}>
      <R3FRoom {...props} />
    </RendererBoundary>
  );
  return (
    <Suspense
      fallback={
        <div className="house-3d-scene" role="status">
          Loading room…
        </div>
      }
    >
      {selected === "playcanvas" ? (
        <RendererBoundary resetKey={`playcanvas:${props.houseTypeId}`} fallback={fallback}>
          <PlayCanvasRoom {...props} inputBlocked={inputBlocked} />
        </RendererBoundary>
      ) : (
        fallback
      )}
    </Suspense>
  );
}
