import { describe, expect, it, vi } from "vitest";
import {
  createHouseRoomInput,
  type RoomInputState,
} from "@/components/game/housing/house-room-input";

function fixture() {
  const state: RoomInputState = {
    blocked: false,
    props: {
      houseTypeId: "shared-room",
      accessoryBand: "basic",
      editMode: true,
      moveEnabled: true,
      slots: [
        { id: "bed-1", slot_type: "bed", x: 25, y: 50 },
        { id: "bed-2", slot_type: "bed", x: 75, y: 50 },
        { id: "seat", slot_type: "seat", x: 50, y: 75 },
      ],
      placements: [
        {
          id: "owned-bed",
          slot: "bed-1",
          item_id: "bed",
          slot_type: "bed",
          art_key: "bed",
          category: "furniture",
        },
      ],
      onMove: vi.fn(),
      onSelectPlacement: vi.fn(),
      onSelectSlot: vi.fn(),
    },
  };
  const preview = vi.fn();
  const input = createHouseRoomInput(() => state, preview);
  const down = { pointerId: 1, x: 10, y: 10 };
  const up = { pointerId: 1, x: 60, y: 10 };
  const bed = { kind: "placement" as const, id: "owned-bed" };
  return { state, input, preview, down, up, bed, target: { x: 0.85, z: 0 } };
}

describe("home renderer gestures", () => {
  it("submits one compatible move and consumes the drag without selecting", () => {
    const { state, input, down, up, bed, target, preview } = fixture();
    input.begin(down, bed);
    expect(input.move(up, target)).toBe("drag");
    expect(preview).toHaveBeenLastCalledWith({
      placementId: "owned-bed",
      point: target,
      slotId: "bed-2",
    });
    input.end(up, target, bed, true);
    input.end(up, target, bed, true);
    expect(state.props.onMove).toHaveBeenCalledExactlyOnceWith(
      state.props.placements[0],
      state.props.slots[1],
    );
    expect(state.props.onSelectPlacement).not.toHaveBeenCalled();
  });

  it("resolves a tap against the newest server snapshot", () => {
    const { state, input, down, bed } = fixture();
    input.begin(down, bed);
    state.props.placements[0] = { ...state.props.placements[0]!, art_key: "new-bed" };
    input.end(down, null, bed, true);
    expect(state.props.onSelectPlacement).toHaveBeenCalledWith(state.props.placements[0]);
  });

  it.each(["occupied", "removed", "disabled", "overlay", "cancel"])(
    "does not submit a %s move",
    (reason) => {
      const { state, input, down, up, bed, target } = fixture();
      input.begin(down, bed);
      input.move(up, target);
      if (reason === "occupied")
        state.props.placements.push({
          ...state.props.placements[0]!,
          id: "other-bed",
          slot: "bed-2",
        });
      if (reason === "removed") state.props.placements = [];
      if (reason === "disabled") state.props.moveEnabled = false;
      if (reason === "cancel") input.cancel();
      input.end(up, target, bed, reason !== "overlay");
      expect(state.props.onMove).not.toHaveBeenCalled();
      expect(state.props.onSelectPlacement).not.toHaveBeenCalled();
    },
  );

  it("blocks selection when a React overlay opens during the gesture", () => {
    const { state, input, down, bed } = fixture();
    input.begin(down, bed);
    state.blocked = true;
    input.end(down, null, bed, true);
    expect(state.props.onSelectPlacement).not.toHaveBeenCalled();
  });

  it("does not select after an orbit or a pointer with a different identity", () => {
    const { state, input, down, up, bed } = fixture();
    state.props.editMode = false;
    input.begin(down, bed);
    expect(input.move(up, null)).toBe("orbit");
    input.end(up, null, bed, true);
    input.begin(down, bed);
    input.end({ ...down, pointerId: 2 }, null, bed, true);
    input.cancel();
    expect(state.props.onSelectPlacement).not.toHaveBeenCalled();
  });

  it("selects only a still-empty slot in arrange mode", () => {
    const { state, input, down } = fixture();
    const hit = { kind: "slot" as const, id: "bed-2" };
    input.begin(down, hit);
    input.end(down, null, hit, true);
    expect(state.props.onSelectSlot).toHaveBeenCalledExactlyOnceWith(state.props.slots[1]);
    state.props.editMode = false;
    input.begin(down, hit);
    input.end(down, null, hit, true);
    expect(state.props.onSelectSlot).toHaveBeenCalledTimes(1);
  });
});
