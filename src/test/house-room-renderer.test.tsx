import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HouseRoomRenderer } from "@/components/game/housing/HouseRoomRenderer";
import {
  HOUSE_ROOM_SIZE,
  interpolateRoomPosition,
  housePartitionSegments,
  houseWallSegments,
  roomCoordinatesToPercent,
  roomPercentToPosition,
  type HouseRoomRendererProps,
} from "@/components/game/housing/house-room-contract";

const scene = vi.hoisted(() => ({ fail: false }));
vi.mock("@/components/game/housing/HouseRoom3D", () => ({
  HouseRoom3D: (props: HouseRoomRendererProps & { inputBlocked?: boolean }) => {
    if (scene.fail) throw new Error("WebGL initialization failed");
    return (
      <div
        data-input-blocked={props.inputBlocked}
        data-character-name={props.characterName}
        data-animation-state={props.animationState}
        data-activity-request-id={props.activityRequestId}
        data-activity-label={props.activityLabel}
      >
        R3F room: {props.houseTypeId}
      </div>
    );
  },
}));

function props(): HouseRoomRendererProps {
  return {
    houseTypeId: "single-room",
    accessoryBand: "basic",
    slots: [],
    placements: [],
    editMode: false,
    moveEnabled: false,
    onMove: vi.fn(),
    onMovePosition: vi.fn(),
    onSelectPlacement: vi.fn(),
    onSelectSlot: vi.fn(),
  };
}

beforeEach(() => {
  scene.fail = false;
});
afterEach(() => vi.restoreAllMocks());

describe("R3F home renderer boundary", () => {
  it("interpolates the character's presentation path to the saved bed position", () => {
    expect(interpolateRoomPosition([0, 0.06, 1], [2, 0.06, -1], 0.5)).toEqual([1, 0.06, 0]);
    expect(interpolateRoomPosition([0, 0, 0], [1, 1, 1], 2)).toEqual([1, 1, 1]);
  });

  it("maps arbitrary in-room drops to normalized coordinates and back", () => {
    const [x, y] = roomCoordinatesToPercent(1.2, -0.8, 6.2, 4.8);
    expect(roomPercentToPosition(x, y, 6.2, 4.8)[0]).toBeCloseTo(1.2);
    expect(roomPercentToPosition(x, y, 6.2, 4.8)[2]).toBeCloseTo(-0.8);
    expect(roomCoordinatesToPercent(100, -100, 6.2, 4.8)).toEqual([96, 96]);
    expect(roomPercentToPosition(0, 100, 6.2, 4.8)).toEqual(roomPercentToPosition(4, 96, 6.2, 4.8));
  });

  it("provides expanded room sizes and a genuine front-door opening", () => {
    expect(HOUSE_ROOM_SIZE["single-room"]?.[0]).toBeGreaterThan(5);
    expect(HOUSE_ROOM_SIZE["duplex"]?.[0]).toBeGreaterThan(HOUSE_ROOM_SIZE["bungalow"]?.[0] ?? 0);
    const walls = houseWallSegments(8, 6, 2.2, 1.1);
    const frontWalls = walls.filter((wall) => wall.id.startsWith("front-"));
    const rearWalls = walls.filter((wall) => wall.id === "rear-left" || wall.id === "rear-right");
    expect(walls).toHaveLength(9);
    expect(frontWalls).toHaveLength(2);
    const frontOpeningEdges = frontWalls
      .map(({ position, size }) => position[0] - Math.sign(position[0]) * (size[0] / 2))
      .sort((a, b) => a - b);
    expect(frontOpeningEdges[0]).toBeCloseTo(-0.77);
    expect(frontOpeningEdges[1]).toBeCloseTo(0.77);
    expect(8 - rearWalls.reduce((total, wall) => total + wall.size[0], 0)).toBeCloseTo(1.1);
  });

  it("adds a pass-through partition only to larger home layouts", () => {
    expect(housePartitionSegments("single-room", 8, 6)).toHaveLength(0);
    expect(housePartitionSegments("studio-flat", 8, 6)).toHaveLength(2);
    expect(housePartitionSegments("bungalow", 10, 8)).toHaveLength(4);
    expect(housePartitionSegments("duplex", 12, 9)).toHaveLength(4);
    expect(housePartitionSegments("bungalow", 10, 8).every((part) => part.size[1] < 2)).toBe(true);
  });

  it("renders through R3F and forwards blocked input state", async () => {
    render(<HouseRoomRenderer {...props()} inputBlocked />);
    const room = await screen.findByText("R3F room: single-room");
    expect(room).toHaveAttribute("data-input-blocked", "true");
  });

  it("forwards the displayed character and server-confirmed activity to the room", async () => {
    render(
      <HouseRoomRenderer
        {...props()}
        characterName="Ayo"
        appearance={{ skin: 3, outfit: 2 }}
        gender="female"
        equipment={[{ slot: "head" }]}
        animationState="work"
        activityRequestId="sleep-request"
        activityLabel="Cooking"
      />,
    );
    const room = await screen.findByText("R3F room: single-room");
    expect(room).toHaveAttribute("data-character-name", "Ayo");
    expect(room).toHaveAttribute("data-animation-state", "work");
    expect(room).toHaveAttribute("data-activity-request-id", "sleep-request");
    expect(room).toHaveAttribute("data-activity-label", "Cooking");
  });

  it("provides accessible room controls if the R3F renderer fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    scene.fail = true;
    render(
      <HouseRoomRenderer
        {...props()}
        editMode
        inputBlocked
        characterName="Ayo"
        activityLabel="Cooking"
        placements={[
          {
            id: "sofa-1",
            item_id: "sofa",
            slot: "lounge-sofa",
            slot_type: "sofa",
            art_key: "sofa",
            category: "furniture",
          },
        ]}
        slots={[
          { id: "lounge-sofa", slot_type: "sofa", x: 50, y: 50 },
          { id: "lounge-bed", slot_type: "bed", x: 25, y: 50 },
        ]}
      />,
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your 3D room is unavailable. You can still select your items here.",
    );
    expect(screen.getByText("Ayo · Cooking")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "sofa" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Place in bed slot" })).toBeDisabled();
  });

  it("offers only compatible free slots when a selected placement is being moved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    scene.fail = true;
    const input = props();
    input.editMode = true;
    input.moveEnabled = true;
    const placement = {
      id: "sofa-1",
      item_id: "sofa",
      slot: "lounge-sofa",
      slot_type: "sofa",
      art_key: "sofa",
      category: "furniture",
    };
    const destination = { id: "lounge-sofa-2", slot_type: "sofa", x: 65, y: 50 };
    render(
      <HouseRoomRenderer
        {...input}
        movingPlacement={placement}
        placements={[placement]}
        slots={[
          { id: "lounge-sofa", slot_type: "sofa", x: 35, y: 50 },
          destination,
          { id: "bed-1", slot_type: "bed", x: 25, y: 30 },
        ]}
      />,
    );
    const moveButton = await screen.findByRole("button", { name: "Move to sofa slot" });
    expect(screen.queryByRole("button", { name: "Move to bed slot" })).not.toBeInTheDocument();
    fireEvent.click(moveButton);
    expect(input.onMove).toHaveBeenCalledWith(placement, destination);
  });
});
