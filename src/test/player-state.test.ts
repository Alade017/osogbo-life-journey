import { describe, expect, it } from "vitest";
import type { Character, Location } from "@/lib/game";
import type { Wallet } from "@/lib/player-state";
import { playerStateFromRows } from "@/lib/player-state";

function character(overrides: Record<string, unknown> = {}) {
  return {
    id: "character-1",
    user_id: "profile-1",
    name: "Ayo",
    appearance: { outfit: 1 },
    gender: "nonbinary",
    level: 3,
    xp: 410,
    health: 92,
    energy: 74,
    hunger: 61,
    reputation: 14,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  } as unknown as Character;
}

function wallet(overrides: Record<string, unknown> = {}) {
  return {
    id: "wallet-1",
    user_id: "profile-1",
    character_id: "character-1",
    balance: 2400,
    total_income: 0,
    total_expenses: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  } as Wallet;
}

describe("playerStateFromRows", () => {
  it("projects existing character, wallet, location, inventory, and equipment rows", () => {
    const location = { id: "loc-1", name: "Oja Oba" } as Location;
    const playerWallet = wallet({ balance: 2400, bank_balance: 7000 });
    const item = { id: "owned-1", item_id: "item-1", quantity: 2, item: null } as const;
    const equipment = [{ id: "equip-1", slot: "top" }] as never[];

    const player = playerStateFromRows({
      character: character({ thirst: 48, wanted_level: 1 }),
      wallet: playerWallet,
      location,
      inventory: [item as never],
      equipment,
    });

    expect(player).toMatchObject({
      id: "character-1",
      profileId: "profile-1",
      name: "Ayo",
      level: 3,
      experience: 410,
      health: 92,
      energy: 74,
      hunger: 61,
      thirst: 48,
      cash: 2400,
      bankBalance: 7000,
      reputation: 14,
      wantedLevel: 1,
      location,
      inventory: [item],
      equipment,
    });
  });

  it("marks fields unavailable until their persisted schema exists", () => {
    const player = playerStateFromRows({
      character: character(),
      wallet: wallet({ balance: 1000 }),
      location: undefined,
    });

    expect(player.cash).toBe(1000);
    expect(player.bankBalance).toBeNull();
    expect(player.thirst).toBeNull();
    expect(player.wantedLevel).toBeNull();
    expect(player.location).toBeNull();
    expect(player.inventory).toEqual([]);
    expect(player.equipment).toEqual([]);
  });
});
