import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HouseRoomRenderer } from "@/components/game/housing/HouseRoomRenderer";
import { homeRendererChoice } from "@/components/game/housing/house-room-contract";
import { HouseRoomPlayCanvas } from "@/components/game/housing/HouseRoomPlayCanvas";
import type { HouseRoomRendererProps } from "@/components/game/housing/house-room-contract";

const engine = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  destroy: vi.fn(),
  cancel: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@/components/game/housing/house-playcanvas-runtime", () => ({
  createHomePlayCanvas: engine.create,
}));
vi.mock("@/components/game/housing/HouseRoom3D", () => ({
  HouseRoom3D: (props: HouseRoomRendererProps) => <div>Usual room: {props.houseTypeId}</div>,
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
  vi.clearAllMocks();
  engine.create.mockResolvedValue({
    update: engine.update,
    destroy: engine.destroy,
    cancel: engine.cancel,
    select: engine.select,
  });
});
afterEach(() => vi.restoreAllMocks());

describe("optional home renderer boundary", () => {
  it("defaults safely and does not initialize the engine for the R3F path", async () => {
    expect(homeRendererChoice(undefined)).toBe("r3f");
    expect(homeRendererChoice("unknown")).toBe("r3f");
    render(<HouseRoomRenderer {...props()} renderer="r3f" />);
    expect(await screen.findByText("Usual room: single-room")).toBeInTheDocument();
    expect(engine.create).not.toHaveBeenCalled();
  });

  it("emits SSR markup without initializing a graphics device", () => {
    expect(renderToString(<HouseRoomPlayCanvas {...props()} />)).toContain("Home interior");
    expect(engine.create).not.toHaveBeenCalled();
  });

  it("updates one instance and releases it on renderer switch", async () => {
    const initial = props();
    const { rerender } = render(<HouseRoomRenderer {...initial} renderer="playcanvas" />);
    await waitFor(() => expect(engine.create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(engine.update).toHaveBeenCalled());
    const changed = { ...initial, editMode: true, moveEnabled: true };
    rerender(<HouseRoomRenderer {...changed} renderer="playcanvas" inputBlocked />);
    await waitFor(() =>
      expect(engine.update).toHaveBeenLastCalledWith(expect.objectContaining(changed), true),
    );
    expect(engine.create).toHaveBeenCalledTimes(1);
    rerender(<HouseRoomRenderer {...changed} renderer="r3f" />);
    expect(await screen.findByText("Usual room: single-room")).toBeInTheDocument();
    expect(engine.destroy).toHaveBeenCalledTimes(1);
  });

  it("falls back after initialization fails without retrying the failed engine", async () => {
    const expectedError = vi.spyOn(console, "error").mockImplementation(() => {});
    engine.create.mockRejectedValue(new Error("No WebGL2 device"));
    render(<HouseRoomRenderer {...props()} renderer="playcanvas" />);
    expect(await screen.findByText("Usual room: single-room")).toBeInTheDocument();
    expect(engine.create).toHaveBeenCalledTimes(1);
    expect(expectedError).toHaveBeenCalled();
  });

  it("disposes a late initialization after the React room has unmounted", async () => {
    let resolve!: (instance: {
      update: typeof engine.update;
      destroy: typeof engine.destroy;
    }) => void;
    engine.create.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { unmount } = render(<HouseRoomPlayCanvas {...props()} />);
    await waitFor(() => expect(engine.create).toHaveBeenCalledOnce());
    unmount();
    await act(async () => resolve({ update: engine.update, destroy: engine.destroy }));
    expect(engine.destroy).toHaveBeenCalledOnce();
    expect(engine.update).not.toHaveBeenCalled();
  });
});
