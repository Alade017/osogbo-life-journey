import type { Database, Json } from "@/integrations/supabase/types";
import type { Character, Location } from "@/lib/game";

export type Wallet = Database["public"]["Tables"]["wallets"]["Row"];
export type InventoryRow = Database["public"]["Tables"]["player_inventory"]["Row"];
export type ItemDefinition = Database["public"]["Tables"]["inventory_items"]["Row"];

export type PlayerInventoryEntry = InventoryRow & { item: ItemDefinition | null };

export type EquipmentSlot = "head" | "top" | "bottom" | "shoes" | "accessory";

export type EquippedItem = {
  id: string;
  character_id: string;
  item_id: string;
  slot: EquipmentSlot;
  durability: number | null;
  metadata: Json;
  item: ItemDefinition | null;
};

/**
 * A normalized view over existing, RLS-protected game rows. The character row
 * remains the authority for identity, needs, progression, and location;
 * wallet, inventory, and equipment remain normalized records.
 */
export type PlayerState = {
  id: string;
  profileId: string;
  name: string;
  avatar: Character["appearance"];
  gender: Character["gender"];
  level: number;
  experience: number;
  health: number;
  energy: number;
  /** Higher hunger means more hungry. */
  hunger: number;
  /** Null while reading a database that predates the thirst migration. */
  thirst: number | null;
  /** The existing wallet balance is the player's spendable cash. */
  cash: number;
  bankBalance: number | null;
  reputation: number;
  wantedLevel: number | null;
  location: Location | null;
  inventory: PlayerInventoryEntry[];
  equipment: EquippedItem[];
  createdAt: string;
  updatedAt: string;
};

export function playerStateFromRows({
  character,
  wallet,
  location,
  inventory = [],
  equipment = [],
}: {
  character: Character;
  wallet: Wallet | null | undefined;
  location: Location | null | undefined;
  inventory?: PlayerInventoryEntry[];
  equipment?: EquippedItem[];
}): PlayerState {
  return {
    id: character.id,
    profileId: character.user_id,
    name: character.name,
    avatar: character.appearance,
    gender: character.gender,
    level: character.level,
    experience: character.xp,
    health: character.health,
    energy: character.energy,
    hunger: character.hunger,
    thirst: character.thirst ?? null,
    cash: Number(wallet?.balance ?? 0),
    bankBalance: typeof wallet?.bank_balance === "number" ? wallet.bank_balance : null,
    reputation: character.reputation,
    wantedLevel: typeof character.wanted_level === "number" ? character.wanted_level : null,
    location: location ?? null,
    inventory,
    equipment,
    createdAt: character.created_at,
    updatedAt: character.updated_at,
  };
}
