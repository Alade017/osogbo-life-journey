import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HouseRoomRenderer } from "@/components/game/housing/HouseRoomRenderer";
import type { HouseRoomRendererProps } from "@/components/game/housing/house-room-contract";

const scene = vi.hoisted(() => ({ fail: false }));
vi.mock("@/components/game/housing/HouseRoom3D", () => ({
  HouseRoom3D: (props: HouseRoomRendererProps & { inputBlocked?: boolean }) => {
    if (scene.fail) throw new Error("WebGL initialization failed");
    return <div data-input-blocked={props.inputBlocked}>R3F room: {props.houseTypeId}</div>;
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
    onSelectPlacement: vi.fn(),
    onSelectSlot: vi.fn(),
  };
}

beforeEach(() => {
  scene.fail = false;
});
afterEach(() => vi.restoreAllMocks());

describe("R3F home renderer boundary", () => {
  it("renders through R3F and forwards blocked input state", async () => {
    render(<HouseRoomRenderer {...props()} inputBlocked />);
    const room = await screen.findByText("R3F room: single-room");
    expect(room).toHaveAttribute("data-input-blocked", "true");
  });

  it("provides accessible room controls if the R3F renderer fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    scene.fail = true;
    render(
      <HouseRoomRenderer
        {...props()}
        editMode
        inputBlocked
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
    expect(screen.getByRole("button", { name: "sofa" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Place in bed slot" })).toBeDisabled();
  });
});
