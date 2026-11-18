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
  applyZoneOutcomeAction,
  closeZoneInteraction,
  initialNeighborhoodState,
  neighborhoodReducer,
  openZoneInteraction,
  recordNpcChatAction,
  setPendingZoneId,
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

  it("allows only pure server-backed bank transfers as zone actions", () => {
    const atm = findInteractableZone("zone-bank-atm")!;
    const withdraw = atm.actions.find((action) => action.id === "atm-withdraw-2000")!;
    const deposit = atm.actions.find((action) => action.id === "atm-deposit-2000")!;
    expect(isServerBackedBankTransfer(atm, withdraw)).toBe(true);
    expect(isServerBackedBankTransfer(atm, deposit)).toBe(true);

    const pos = findInteractableZone("zone-shop-pos")!;
    const posCashOut = pos.actions.find((action) => action.id === "pos-cashout-2000")!;
    expect(isServerBackedBankTransfer(pos, posCashOut)).toBe(false);

    const adire = findInteractableZone("zone-adire-vats")!;
    expect(isServerBackedBankTransfer(adire, adire.actions[0]!)).toBe(false);
  });

  it("keeps authored NPC tips informational without granting social rewards", () => {
    let state = initialNeighborhoodState;
    const npc = findZoneNpc("zone-npc-tunde")!;
    state = neighborhoodReducer(state, recordNpcChatAction({ npc, tip: npc.tips[0]! }));
    expect(state.lastNpcTip).toBe(npc.tips[0]);
    expect(state.needOffsets.social ?? 0).toBe(0);
  });;
});
