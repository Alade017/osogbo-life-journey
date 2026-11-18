import { describe, expect, it } from "vitest";
import { canOccupyNeighborhoodPoint } from "@/game/authoritative-movement";
import { CITY_CENTRE_AREA, toWorld } from "@/game/neighborhood-model";
import {
  findInteractableZone,
  findZoneNpc,
  NEIGHBORHOOD_INTERACTABLE_ZONES,
  NEIGHBORHOOD_ZONE_NPCS,
  nearestInteractableZone,
  nearestZoneNpc,
  isServerBackedBankTransfer,
} from "@/game/neighborhood-interactions";
import {
  initialNeighborhoodState,
  neighborhoodReducer,
  openZoneInteraction,
  closeZoneInteraction,
  setPendingZoneId,
  recordNpcChatAction,
} from "@/store/neighborhoodSlice";

const origin = { x: 7, y: 6 };

describe("Olaiya neighborhood full zone interactivity & state slice", () => {
  it("keeps every InteractableZone accessPoint and ZoneNpc accessPoint 100% walkable", () => {
    const objects = CITY_CENTRE_AREA.objects;
    const obstacles = CITY_CENTRE_AREA.obstacles ?? [];

    for (const zone of NEIGHBORHOOD_INTERACTABLE_ZONES) {
      const worldAccess = toWorld(zone.accessPoint, origin);
      expect(
        canOccupyNeighborhoodPoint(worldAccess, origin, objects, obstacles),
        `Expected ${zone.id} accessPoint (${zone.accessPoint.x}, ${zone.accessPoint.y}) to be walkable`,
      ).toBe(true);
    }

    for (const npc of NEIGHBORHOOD_ZONE_NPCS) {
      const worldAccess = toWorld(npc.accessPoint, origin);
      expect(
        canOccupyNeighborhoodPoint(worldAccess, origin, objects, obstacles),
        `Expected ${npc.id} accessPoint (${npc.accessPoint.x}, ${npc.accessPoint.y}) to be walkable`,
      ).toBe(true);
    }
  });

  it("keeps every Olaiya spot reachable from its walkable access point", () => {
    const objects = CITY_CENTRE_AREA.objects;
    const obstacles = CITY_CENTRE_AREA.obstacles ?? [];
    for (const zone of NEIGHBORHOOD_INTERACTABLE_ZONES) {
      expect(
        canOccupyNeighborhoodPoint(toWorld(zone.accessPoint, origin), origin, objects, obstacles),
        `Expected ${zone.id} access point to be walkable`,
      ).toBe(true);
    }
  });

  it("matches proximity queries accurately at each zone and NPC access point", () => {
    for (const zone of NEIGHBORHOOD_INTERACTABLE_ZONES) {
      const match = nearestInteractableZone(zone.accessPoint);
      expect(match?.zone.id).toBe(zone.id);
    }

    for (const npc of NEIGHBORHOOD_ZONE_NPCS) {
      const match = nearestZoneNpc(npc.accessPoint);
      expect(match?.npc.id).toBe(npc.id);
    }
  });

  it("clears an approach target when the interaction opens and closes only the panel", () => {
    let state = neighborhoodReducer(initialNeighborhoodState, setPendingZoneId("zone-bank-atm"));
    expect(state.pendingZoneId).toBe("zone-bank-atm");

    state = neighborhoodReducer(state, openZoneInteraction({ zoneId: "zone-bank-atm" }));
    expect(state.pendingZoneId).toBeNull();
    expect(state.activeZoneId).toBe("zone-bank-atm");

    state = neighborhoodReducer(state, closeZoneInteraction());
    expect(state.activeZoneId).toBeNull();
    expect(state.activeNpcId).toBeNull();
  });

  it("allows only pure server-backed bank transfers as zone actions", () => {
    const atm = findInteractableZone("zone-bank-atm")!;
    const withdraw = atm.actions.find((action) => action.id === "atm-withdraw-2000")!;
    const deposit = atm.actions.find((action) => action.id === "atm-deposit-2000")!;
    expect(isServerBackedBankTransfer(atm, withdraw)).toBe(true);
    expect(isServerBackedBankTransfer(atm, deposit)).toBe(true);

    const pos = findInteractableZone("zone-shop-pos")!;
    const posCashOut = { ...withdraw, id: "pos-cashout", walletDelta: 2000, bankDelta: -2100 };
    expect(isServerBackedBankTransfer(pos, posCashOut)).toBe(false);
    expect(isServerBackedBankTransfer(atm, posCashOut)).toBe(false);

    const adire = findInteractableZone("zone-adire-vats")!;
    expect(isServerBackedBankTransfer(adire, adire.actions[0]!)).toBe(false);
  });

  it("keeps authored NPC tips informational without granting social rewards", () => {
    let state = initialNeighborhoodState;
    const npc = findZoneNpc("zone-npc-tunde")!;
    state = neighborhoodReducer(state, recordNpcChatAction({ tip: npc.tips[0]! }));
    expect(state.lastNpcTip).toBe(npc.tips[0]);
    expect(state).not.toHaveProperty("needOffsets");
  });
});

it("rejects non-finite and fractional quick bank transfers", () => {
  const zone = findInteractableZone("zone-bank-atm")!,
    base = zone.actions[0]!;
  for (const amount of [Infinity, NaN, 0.5, Number.MAX_SAFE_INTEGER + 1])
    expect(
      isServerBackedBankTransfer(zone, { ...base, bankDelta: amount, walletDelta: -amount }),
    ).toBe(false);
});
it("connects shopping and transport zones to existing authoritative service panels", () => {
  expect(findInteractableZone("zone-mini-mart")).toMatchObject({
    services: ["market"],
    foodOnly: true,
  });
  expect(findInteractableZone("zone-buka-stall")).toMatchObject({
    services: ["interior", "market"],
    foodOnly: true,
  });
  expect(findInteractableZone("zone-transit-stand")?.services).toContain("transit");
  expect(findInteractableZone("zone-shop-accessory")?.services).toContain("market");
});

it("connects both Adire stations to crafting and the same server-owned materials counter", () => {
  for (const id of ["zone-adire-vats", "zone-adire-racks"]) {
    const zone = findInteractableZone(id)!;
    expect(zone.services).toContain("craft");
    expect(zone.services).toContain("market");
    expect(zone.shopSlug).toBe("adire-materials");
    expect(zone.actions.some((action) => action.id.startsWith("adire-craft-"))).toBe(false);
  }
});

it("routes forecourt jerrycan purchases to the dedicated server-backed shop catalogue", () => {
  const fuel = findInteractableZone("zone-fuel-pumps")!;
  expect(fuel.services).toEqual(["market"]);
  expect(fuel.shopSlug).toBe("fuel-and-go-forecourt");
  expect(fuel.actions).toEqual([]);
});
