import { formatNaira } from "@/lib/game";

// Rules for the Real Estate page: six house tiers, each offering Rent and Buy.
// The server stays authoritative; these checks only explain choices before the player confirms.

export type RentListing = {
  propertyId: string;
  houseTypeId: string;
  label: string;
  description: string;
  weeklyRentMinor: number;
  depositWeeks: number;
  priceMinor: number;
  upfrontTotalMinor: number;
  slotCount: number;
  assetKey: string;
  isCurrentHome: boolean;
  available: boolean;
};

export type SaleListing = {
  id: string;
  name: string;
  description: string | null;
  house_type_id: string;
  purchase_price: number | null;
  level_required: number | null;
};

export type OwnedRow = {
  id: string;
  tenure: "owned" | "rented";
  is_active: boolean;
  game_properties: { id: string; house_type_id: string | null } | null;
};

export type Tier = {
  houseTypeId: string;
  label: string;
  description: string;
  rent: RentListing | null;
  sale: SaleListing | null;
};

export type Context = {
  balance: number | null;
  level: number;
  owned: OwnedRow[];
  rentListings: RentListing[];
};

export type Status = "owned" | "rented" | "available";

export type Choice = {
  enabled: boolean;
  reason: string | null;
  /** Deposit returned when this choice ends the current rental. */
  refundMinor: number;
  /** What the player pays today, before any refund. */
  costMinor: number;
};

/** Six tiers in order of weekly rent, joining rent and sale listings by house type. */
export function buildTiers(rentListings: RentListing[], saleListings: SaleListing[]): Tier[] {
  const byType = new Map<string, Tier>();
  const ensure = (houseTypeId: string, label: string, description: string) => {
    const existing = byType.get(houseTypeId);
    if (existing) return existing;
    const tier: Tier = { houseTypeId, label, description, rent: null, sale: null };
    byType.set(houseTypeId, tier);
    return tier;
  };
  for (const rent of rentListings) {
    ensure(rent.houseTypeId, rent.label, rent.description).rent = rent;
  }
  for (const sale of saleListings) {
    if (!sale.house_type_id) continue;
    ensure(sale.house_type_id, sale.name, sale.description ?? "").sale = sale;
  }
  const rentOf = (tier: Tier) => tier.rent?.weeklyRentMinor ?? Number.MAX_SAFE_INTEGER;
  return [...byType.values()].sort((a, b) => rentOf(a) - rentOf(b));
}

export function ownedGamePropertyIds(owned: OwnedRow[]): Set<string> {
  return new Set(
    owned
      .filter((row) => row.is_active && row.tenure === "owned" && row.game_properties)
      .map((row) => row.game_properties!.id),
  );
}

/** The rented home the player is in now, if any. */
export function activeRental(owned: OwnedRow[]): OwnedRow | null {
  return owned.find((row) => row.is_active && row.tenure === "rented") ?? null;
}

/** Deposit that renting or buying another home would return from the current rental. */
export function refundFor(context: Context, tier: Tier): number {
  const rental = activeRental(context.owned);
  if (!rental?.game_properties) return 0;
  if (rental.game_properties.house_type_id === tier.houseTypeId) return 0;
  const listing = context.rentListings.find(
    (item) => item.houseTypeId === rental.game_properties?.house_type_id,
  );
  return listing ? listing.weeklyRentMinor * listing.depositWeeks : 0;
}

export function statusFor(context: Context, tier: Tier): Status {
  if (tier.sale && ownedGamePropertyIds(context.owned).has(tier.sale.id)) return "owned";
  if (tier.rent?.isCurrentHome) return "rented";
  return "available";
}

function fundsCheck(context: Context, costMinor: number, refundMinor: number): string | null {
  if (context.balance === null) return "Your wallet is still loading.";
  const available = context.balance + refundMinor;
  if (available < costMinor) return `You need ${formatNaira(costMinor - available)} more.`;
  return null;
}

export function rentChoice(context: Context, tier: Tier): Choice {
  const rent = tier.rent;
  if (!rent)
    return { enabled: false, reason: "Not available to rent.", refundMinor: 0, costMinor: 0 };
  if (rent.isCurrentHome)
    return {
      enabled: false,
      reason: "This is your current home.",
      refundMinor: 0,
      costMinor: rent.upfrontTotalMinor,
    };
  const refundMinor = refundFor(context, tier);
  const reason = fundsCheck(context, rent.upfrontTotalMinor, refundMinor);
  return { enabled: reason === null, reason, refundMinor, costMinor: rent.upfrontTotalMinor };
}

export function buyChoice(context: Context, tier: Tier): Choice {
  const sale = tier.sale;
  if (!sale || sale.purchase_price === null)
    return { enabled: false, reason: "Not available to buy.", refundMinor: 0, costMinor: 0 };
  const costMinor = sale.purchase_price;
  if (ownedGamePropertyIds(context.owned).has(sale.id))
    return { enabled: false, reason: "You already own this home.", refundMinor: 0, costMinor };
  const level = sale.level_required ?? 0;
  if (context.level < level)
    return { enabled: false, reason: `Requires level ${level}.`, refundMinor: 0, costMinor };
  const refundMinor = refundFor(context, tier);
  const reason = fundsCheck(context, costMinor, refundMinor);
  return { enabled: reason === null, reason, refundMinor, costMinor };
}
