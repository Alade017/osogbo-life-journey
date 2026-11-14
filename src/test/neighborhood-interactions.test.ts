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

  it("allows walking inside Dele Cutz Barber and Iya Adire Accessories doorways while blocking walls", () => {
    const objects = CITY_CENTRE_AREA.objects;
    const obstacles = CITY_CENTRE_AREA.obstacles ?? [];

    // Open doorways & walk-in shop interiors
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 1502, y: 55 }, origin), origin, objects, obstacles),
    ).toBe(true);
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 1502, y: 335 }, origin), origin, objects, obstacles),
    ).toBe(true);

    // Solid east rear walls & interior counters block movement
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 1568, y: 65 }, origin), origin, objects, obstacles),
    ).toBe(false);
    expect(
      canOccupyNeighborhoodPoint(toWorld({ x: 1568, y: 345 }, origin), origin, objects, obstacles),
    ).toBe(false);
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

  it("routes Adire crafting, accessory equipping, shifts, and NPC chats cleanly through neighborhoodReducer", () => {
    let state = initialNeighborhoodState;

    // 1. Tap-to-walk pending target & arrival open
    state = neighborhoodReducer(state, setPendingZoneId("zone-adire-vats"));
    expect(state.pendingZoneId).toBe("zone-adire-vats");

    state = neighborhoodReducer(state, openZoneInteraction({ zoneId: "zone-adire-vats" }));
    expect(state.pendingZoneId).toBeNull();
    expect(state.activeZoneId).toBe("zone-adire-vats");

    // 2. Dye Adire cloth (spends ₦1500, adds crafted wrapper to inventory, boosts fun + XP)
    const adireZone = findInteractableZone("zone-adire-vats")!;
    const dyeAction = adireZone.actions[0]!;
    state = neighborhoodReducer(
      state,
      applyZoneOutcomeAction({ zoneTitle: adireZone.title, outcome: dyeAction }),
    );
    expect(state.walletOffset).toBe(-1500);
    expect(state.needOffsets.fun).toBe(16);
    expect(state.xpOffset).toBe(32);
    expect(state.localInventory.some((i) => i.slug === "adire_indigo_wrapper")).toBe(true);
    expect(state.localTransactions).toHaveLength(1);

    // 3. Buy & equip Leather Backpack from Accessories Shop
    const accZone =
      findInteractableZone("shop-accessory-zone") ?? findInteractableZone("zone-shop-accessory")!;
    const backpackAction = accZone.actions[0]!;
    state = neighborhoodReducer(
      state,
      applyZoneOutcomeAction({ zoneTitle: accZone.title, outcome: backpackAction }),
    );
    expect(state.equippedAccessorySlug).toBe("backpack");
    expect(state.localInventory.some((i) => i.slug === "backpack")).toBe(true);

    // 4. Close modal & chat with a Zone NPC
    state = neighborhoodReducer(state, closeZoneInteraction());
    expect(state.activeZoneId).toBeNull();

    const npc = findZoneNpc("zone-npc-tunde")!;
    state = neighborhoodReducer(
      state,
      recordNpcChatAction({ npc, tip: npc.tips[0]!, socialBoost: 10 }),
    );
    expect(state.lastNpcTip).toBe(npc.tips[0]);
    expect(state.needOffsets.social).toBe(20);
  });
});
