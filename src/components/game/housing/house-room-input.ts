import type { HousePlacement, HouseSlot } from "./HouseRoomScene";
import {
  HOUSE_ROOM_SIZE,
  houseSlotPosition,
  type HouseRoomRendererProps,
} from "./house-room-contract";

export type HouseHit = { kind: "placement" | "slot"; id: string } | null;
export type FloorPoint = { x: number; z: number };
export type RoomPointer = { pointerId: number; x: number; y: number };
export type RoomPreview = { placementId: string; point: FloorPoint; slotId: string | null } | null;
export type RoomInputState = { props: HouseRoomRendererProps; blocked: boolean };

/** Gesture state only; the route and server retain all ownership and mutation decisions. */
export function createHouseRoomInput(
  read: () => RoomInputState,
  preview: (value: RoomPreview) => void,
) {
  let pointer: (RoomPointer & { hit: HouseHit; moved: boolean }) | null = null;
  const placement = (id: string): HousePlacement | undefined =>
    read().props.placements.find((item) => item.id === id);
  const destination = (item: HousePlacement, point: FloorPoint): HouseSlot | null => {
    const { props } = read();
    const [width, depth] = HOUSE_ROOM_SIZE[props.houseTypeId] ?? HOUSE_ROOM_SIZE["shared-room"]!;
    const radius = Math.max(0.62, Math.min(width, depth) * 0.16);
    return (
      props.slots
        .filter(
          (slot) =>
            slot.slot_type === item.slot_type &&
            !props.placements.some((row) => row.slot === slot.id),
        )
        .map((slot) => {
          const [x, , z] = houseSlotPosition(slot, width, depth);
          return { slot, distance: Math.hypot(x - point.x, z - point.z) };
        })
        .filter((candidate) => candidate.distance <= radius)
        .sort((a, b) => a.distance - b.distance)[0]?.slot ?? null
    );
  };
  const cancel = () => {
    pointer = null;
    preview(null);
  };
  return {
    begin(sample: RoomPointer, hit: HouseHit) {
      cancel();
      if (!read().blocked) pointer = { ...sample, hit, moved: false };
    },
    move(sample: RoomPointer, point: FloorPoint | null): "drag" | "orbit" | null {
      if (!pointer || pointer.pointerId !== sample.pointerId) return null;
      const { props, blocked } = read();
      if (blocked) {
        cancel();
        return null;
      }
      if (!pointer.moved && Math.hypot(sample.x - pointer.x, sample.y - pointer.y) < 6) return null;
      pointer.moved = true;
      const item = pointer.hit?.kind === "placement" ? placement(pointer.hit.id) : undefined;
      if (item && props.editMode && props.moveEnabled) {
        if (point)
          preview({ placementId: item.id, point, slotId: destination(item, point)?.id ?? null });
        return "drag";
      }
      return "orbit";
    },
    end(sample: RoomPointer, point: FloorPoint | null, hit: HouseHit, overCanvas: boolean) {
      if (!pointer || pointer.pointerId !== sample.pointerId) return;
      const finished = pointer;
      const moved = finished.moved || Math.hypot(sample.x - finished.x, sample.y - finished.y) >= 6;
      cancel();
      const { props, blocked } = read();
      if (blocked || !overCanvas) return;
      if (moved) {
        if (finished.hit?.kind !== "placement" || !props.editMode || !props.moveEnabled || !point)
          return;
        const item = placement(finished.hit.id);
        const slot = item && destination(item, point);
        if (item && slot) props.onMove(item, slot);
        return;
      }
      if (!hit || hit.kind !== finished.hit?.kind || hit.id !== finished.hit.id) return;
      if (hit.kind === "placement") {
        const item = placement(hit.id);
        if (item) props.onSelectPlacement(item);
      } else if (props.editMode) {
        const slot = props.slots.find((row) => row.id === hit.id);
        if (slot && !props.placements.some((item) => item.slot === slot.id))
          props.onSelectSlot(slot);
      }
    },
    cancel,
  };
}
