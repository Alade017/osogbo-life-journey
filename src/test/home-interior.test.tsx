import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeInterior } from "@/components/game/HomeInterior";
import { DEFAULT_HOUSING_SAVE } from "@/lib/housing-service";

vi.mock("@/components/game/housing/HouseScene", () => ({
  HouseScene: () => <div data-testid="house-scene" />,
}));

describe("walkable home experience", () => {
  beforeEach(() => window.localStorage.clear());

  it("enters home, selects connected rooms and exits", async () => {
    render(<HomeInterior />);
    fireEvent.click(screen.getByRole("button", { name: /family courtyard home/i }));
    fireEvent.click(screen.getByRole("button", { name: /enter home/i }));
    expect(await screen.findByLabelText(/walkable floor/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dining room" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Dining room walkable floor")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /leave home/i }));
    expect(screen.getByRole("button", { name: /enter home/i })).toBeInTheDocument();
  }, 15_000);

  it("restores the selected starter layout after refresh", () => {
    const { unmount } = render(<HomeInterior />);
    fireEvent.click(screen.getByRole("button", { name: /courtyard room/i }));
    expect(window.localStorage.getItem("osogbo-life-housing-v1")).toContain("courtyard-room");
    unmount();
    render(<HomeInterior />);
    expect(screen.getByRole("heading", { name: "Courtyard Room" })).toBeInTheDocument();
  });

  it("keeps friend visits read-only while allowing room browsing", async () => {
    const onSave = vi.fn();
    const onLeave = vi.fn();
    render(
      <HomeInterior
        initialSave={{
          ...DEFAULT_HOUSING_SAVE,
          furniture: [
            { id: "sofa-visit", itemId: "sofa", room: "lounge", x: 0, y: 0, rotation: 0 },
          ],
        }}
        readOnly
        visitorName="Ayo"
        onSave={onSave}
        onLeave={onLeave}
      />,
    );
    expect(screen.getByText(/visiting Ayo's saved layout/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /build mode|enter home/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kitchen" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Kitchen walkable floor")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /end visit/i }));
    expect(onLeave).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });

  it("submits an upgrade to the authoritative purchase callback", async () => {
    const onPurchaseUpgrade = vi.fn().mockResolvedValue({
      ...DEFAULT_HOUSING_SAVE,
      layoutId: "garden-flat",
      upgrades: ["finish"],
    });
    render(
      <HomeInterior
        initialSave={{ ...DEFAULT_HOUSING_SAVE, layoutId: "garden-flat" }}
        onPurchaseUpgrade={onPurchaseUpgrade}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enter home/i }));
    const upgradeButton = await screen.findByRole("button", { name: /finish.*500/i });
    fireEvent.click(upgradeButton);
    await waitFor(() =>
      expect(onPurchaseUpgrade).toHaveBeenCalledWith({ roomId: "lounge", upgradeId: "finish" }),
    );
    expect(await screen.findByText("finish upgrade purchased.")).toBeInTheDocument();
  });

  it("purchases furniture before placing it from storage", async () => {
    const onPurchaseFurniture = vi.fn().mockResolvedValue({
      ...DEFAULT_HOUSING_SAVE,
      storage: ["sofa"],
    });
    const onSave = vi.fn();
    render(
      <HomeInterior
        initialSave={DEFAULT_HOUSING_SAVE}
        onPurchaseFurniture={onPurchaseFurniture}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enter home/i }));
    fireEvent.click(screen.getByRole("button", { name: /build mode/i }));
    fireEvent.click(await screen.findByRole("button", { name: /buy.*900/i }));
    await waitFor(() => expect(onPurchaseFurniture).toHaveBeenCalledWith({ itemId: "sofa" }));
    fireEvent.click(await screen.findByRole("button", { name: /place lounge sofa/i }));
    fireEvent.click(screen.getByRole("button", { name: "1, 1 floor" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          storage: [],
          furniture: [expect.objectContaining({ itemId: "sofa", room: "lounge" })],
        }),
      ),
    );
  });
});
