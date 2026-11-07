import { describe, expect, it, vi } from "vitest";
import {
  buildTiers,
  buyChoice,
  rentChoice,
  statusFor,
  type Context,
  type RentListing,
  type SaleListing,
} from "@/components/game/housing/real-estate-tiers";

vi.mock("@/lib/game", () => ({ formatNaira: (minor: number) => `₦${minor}` }));

const rent = (
  houseTypeId: string,
  weekly: number,
  extra: Partial<RentListing> = {},
): RentListing => ({
  propertyId: `rent-${houseTypeId}`,
  houseTypeId,
  label: houseTypeId,
  description: "",
  weeklyRentMinor: weekly,
  depositWeeks: 2,
  priceMinor: weekly * 3,
  upfrontTotalMinor: weekly * 3,
  slotCount: 2,
  assetKey: houseTypeId,
  isCurrentHome: false,
  available: true,
  ...extra,
});

const sale = (
  houseTypeId: string,
  price: number,
  extra: Partial<SaleListing> = {},
): SaleListing => ({
  id: `sale-${houseTypeId}`,
  name: houseTypeId,
  description: "",
  house_type_id: houseTypeId,
  purchase_price: price,
  level_required: 0,
  ...extra,
});

const base = (overrides: Partial<Context> = {}): Context => ({
  balance: 1_000_000,
  level: 5,
  owned: [],
  rentListings: [],
  ...overrides,
});

describe("real estate tiers", () => {
  it("orders the tiers by weekly rent and joins rent and sale listings", () => {
    const tiers = buildTiers(
      [rent("studio", 900), rent("shared-room", 300)],
      [sale("studio", 50_000), sale("shared-room", 20_000)],
    );
    expect(tiers.map((tier) => tier.houseTypeId)).toEqual(["shared-room", "studio"]);
    expect(tiers[0]!.sale?.id).toBe("sale-shared-room");
    expect(tiers[1]!.rent?.propertyId).toBe("rent-studio");
  });

  it("marks a home you own as owned and your rented home as rented", () => {
    const tier = buildTiers(
      [rent("studio", 900, { isCurrentHome: true })],
      [sale("studio", 50_000)],
    )[0]!;
    expect(
      statusFor(base({ rentListings: [rent("studio", 900, { isCurrentHome: true })] }), tier),
    ).toBe("rented");
    const owned = base({
      owned: [
        {
          id: "r1",
          tenure: "owned",
          is_active: true,
          game_properties: { id: "sale-studio", house_type_id: "studio" },
        },
      ],
    });
    expect(statusFor(owned, tier)).toBe("owned");
  });

  it("refunds the current rental's deposit when renting a different home", () => {
    const listings = [rent("shared-room", 300), rent("studio", 900)];
    const tier = buildTiers(listings, [])[1]!;
    const context = base({
      rentListings: listings,
      owned: [
        {
          id: "r1",
          tenure: "rented",
          is_active: true,
          game_properties: { id: "rent-shared-room", house_type_id: "shared-room" },
        },
      ],
      balance: 0,
    });
    const choice = rentChoice(context, tier);
    expect(choice.refundMinor).toBe(300 * 2);
    // Move-in costs 900 * 3 = 2700; the 600 refund plus 0 cash is still short.
    expect(choice.enabled).toBe(false);
    expect(choice.reason).toBe("You need ₦2100 more.");
  });

  it("lets the refund cover the move-in cost", () => {
    const listings = [rent("shared-room", 300), rent("studio", 900)];
    const tier = buildTiers(listings, [])[1]!;
    const context = base({
      rentListings: listings,
      balance: 2_100,
      owned: [
        {
          id: "r1",
          tenure: "rented",
          is_active: true,
          game_properties: { id: "rent-shared-room", house_type_id: "shared-room" },
        },
      ],
    });
    expect(rentChoice(context, tier)).toMatchObject({ enabled: true, refundMinor: 600 });
  });

  it("does not refund when renting the home you already rent", () => {
    const listings = [rent("studio", 900, { isCurrentHome: true })];
    const tier = buildTiers(listings, [])[0]!;
    const context = base({
      rentListings: listings,
      owned: [
        {
          id: "r1",
          tenure: "rented",
          is_active: true,
          game_properties: { id: "rent-studio", house_type_id: "studio" },
        },
      ],
    });
    expect(rentChoice(context, tier)).toMatchObject({
      enabled: false,
      reason: "This is your current home.",
    });
  });

  it("blocks a purchase below the required level and a home you already own", () => {
    const tier = buildTiers([], [sale("studio", 50_000, { level_required: 9 })])[0]!;
    expect(buyChoice(base({ level: 5 }), tier)).toMatchObject({
      enabled: false,
      reason: "Requires level 9.",
    });
    const owned = base({
      level: 9,
      owned: [
        {
          id: "r1",
          tenure: "owned",
          is_active: true,
          game_properties: { id: "sale-studio", house_type_id: "studio" },
        },
      ],
    });
    expect(buyChoice(owned, tier)).toMatchObject({
      enabled: false,
      reason: "You already own this home.",
    });
  });

  it("waits while the wallet is still loading", () => {
    const tier = buildTiers([rent("studio", 900)], [])[0]!;
    expect(rentChoice(base({ balance: null }), tier)).toMatchObject({
      enabled: false,
      reason: "Your wallet is still loading.",
    });
  });
});
