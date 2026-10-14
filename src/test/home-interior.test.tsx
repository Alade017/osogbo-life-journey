import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeInterior } from "@/components/game/HomeInterior";
import { DEFAULT_HOUSING_SAVE } from "@/lib/housing-service";

vi.mock("@/components/game/housing/HouseScene", () => ({
  HouseScene: () => <div data-testid="house-scene" />,
}));

describe("walkable home experience", () => {
  beforeEach(() => window.localStorage.clear());

  it("opens directly inside the saved home and switches connected rooms", async () => {
    render(
      <HomeInterior
        initialSave={{ ...DEFAULT_HOUSING_SAVE, layoutId: "family-courtyard", room: "lounge" }}
      />,
    );
    expect(await screen.findByLabelText(/walkable floor/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dining room" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Dining room walkable floor")).toBeInTheDocument(),
    );
  }, 15_000);

  it("does not show a second home template picker or enter-home step", () => {
    render(<HomeInterior />);
    expect(screen.getByRole("heading", { name: "Garden Court Flat" })).toBeInTheDocument();
    expect(screen.queryByText(/choose a starter home layout/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enter home/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/playable home template/i)).not.toBeInTheDocument();
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
    expect(screen.queryByText("hunger")).not.toBeInTheDocument();
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
    const { container } = render(
      <HomeInterior
        initialSave={DEFAULT_HOUSING_SAVE}
        onPurchaseFurniture={onPurchaseFurniture}
        onSave={onSave}
      />,
    );
    // Scope controls to the panel rather than calculating names/styles for every floor tile.
    const furniturePanel = within(container.querySelector(".home-room-detail") as HTMLElement);
    fireEvent.click(furniturePanel.getByRole("button", { name: /build mode/i }));
    fireEvent.click(await furniturePanel.findByRole("button", { name: /buy.*900/i }));
    await waitFor(() => expect(onPurchaseFurniture).toHaveBeenCalledWith({ itemId: "sofa" }));
    fireEvent.click(await furniturePanel.findByRole("button", { name: /place lounge sofa/i }));
    fireEvent.click(screen.getByLabelText("1, 1 floor"));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          storage: [],
          furniture: [expect.objectContaining({ itemId: "sofa", room: "lounge" })],
        }),
      ),
    );
  });

  it("routes furniture use to the server and does not mutate saved needs", async () => {
    const onSave = vi.fn();
    const onFurnitureAction = vi.fn().mockResolvedValue(null);
    const initialSave = {
      ...DEFAULT_HOUSING_SAVE,
      furniture: [
        { id: "sofa-1", itemId: "sofa", room: "lounge" as const, x: 0, y: 0, rotation: 0 as const },
      ],
    };
    render(
      <HomeInterior
        initialSave={initialSave}
        onSave={onSave}
        onFurnitureAction={onFurnitureAction}
      />,
    );
    fireEvent.click(await screen.findByLabelText("1, 1 Lounge sofa"));
    await waitFor(() => expect(onFurnitureAction).toHaveBeenCalledWith("relax_sofa"));
    for (const [save] of onSave.mock.calls)
      expect((save as { needs: unknown }).needs).toEqual(initialSave.needs);
    expect(await screen.findByText("You took a moment to relax.")).toBeInTheDocument();
  });

  it("shows a server rejection without changing housing needs", async () => {
    const onSave = vi.fn();
    const initialSave = {
      ...DEFAULT_HOUSING_SAVE,
      furniture: [
        { id: "sofa-1", itemId: "sofa", room: "lounge" as const, x: 0, y: 0, rotation: 0 as const },
      ],
    };
    render(
      <HomeInterior
        initialSave={initialSave}
        onSave={onSave}
        onFurnitureAction={vi.fn().mockResolvedValue("Travel home before this activity")}
      />,
    );
    fireEvent.click(await screen.findByLabelText("1, 1 Lounge sofa"));
    expect(await screen.findByText("Travel home before this activity")).toBeInTheDocument();
    for (const [save] of onSave.mock.calls)
      expect((save as { needs: unknown }).needs).toEqual(initialSave.needs);
  });
});
