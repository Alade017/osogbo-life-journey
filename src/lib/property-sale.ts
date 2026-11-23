import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

/** A player's active home or stall, and what an NPC would pay for it. */
export const propertySaleQuoteSchema = z.object({
  playerPropertyId: z.string().uuid(),
  propertyName: z.string(),
  kind: z.enum(["home", "stall"]),
  sellable: z.boolean(),
  amountMinor: z.number().int().nonnegative(),
});

export type PropertySaleQuote = z.infer<typeof propertySaleQuoteSchema>;

export const propertySaleResultSchema = z.object({
  ok: z.literal(true),
  kind: z.enum(["home", "stall"]),
  propertyName: z.string(),
  amountMinor: z.number().int().positive(),
  balance: z.number(),
  duplicate: z.boolean(),
});

export async function fetchPropertySaleQuotes(): Promise<PropertySaleQuote[]> {
  const { data, error } = await supabase.rpc("my_property_sale_quotes");
  if (error) throw new Error(error.message);
  return z.array(propertySaleQuoteSchema).parse(data ?? []);
}

export async function sellPropertyToNpc(playerPropertyId: string, requestId = crypto.randomUUID()) {
  const { data, error } = await supabase.rpc("sell_property_to_npc", {
    p_player_property_id: z.string().uuid().parse(playerPropertyId),
    p_request_id: z.string().uuid().parse(requestId),
  });
  if (error) throw new Error(error.message);
  return propertySaleResultSchema.parse(data);
}

const PROPERTY_SALE_COPY: Readonly<Record<string, string>> = {
  NOT_OWNED: "You no longer own this property.",
  RENTED_HOME_CANNOT_BE_SOLD: "A rented home can’t be sold. Move out to end the rental instead.",
  PAY_OVERDUE_RENT_FIRST: "Pay your overdue rent before you sell this property.",
  SALE_VALUE_UNAVAILABLE: "This property has no sale value right now.",
  REGISTERED_ACCOUNT_REQUIRED: "Create an account to sell property.",
  NO_CHARACTER: "Create a character first.",
  NO_WALLET: "Your wallet is not ready yet. Try again in a moment.",
  IDEMPOTENCY_CONFLICT: "That sale request was already used. Try again.",
};

const PROPERTY_SALE_FALLBACK = "That sale could not be completed. Try again.";

/** Player-facing line for a failed sale. Known codes get plain copy, never the raw code. */
export function propertySaleErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const codes = message.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [];
  const known = codes.find((candidate) => candidate in PROPERTY_SALE_COPY);
  return known ? PROPERTY_SALE_COPY[known]! : PROPERTY_SALE_FALLBACK;
}

export const propertyMarketListingSchema = z.object({
  listingId: z.string().uuid(),
  playerPropertyId: z.string().uuid(),
  propertyName: z.string(),
  askingMinor: z.number().int().positive(),
  sellerName: z.string(),
  isMine: z.boolean(),
});

export type PropertyMarketListing = z.infer<typeof propertyMarketListingSchema>;

export async function fetchPropertyMarket(): Promise<PropertyMarketListing[]> {
  const { data, error } = await supabase.rpc("property_market_listings");
  if (error) throw new Error(error.message);
  return z.array(propertyMarketListingSchema).parse(data ?? []);
}

export async function listPropertyForSale(playerPropertyId: string, askingMinor: number) {
  const { data, error } = await supabase.rpc("list_property_for_sale", {
    p_player_property_id: z.string().uuid().parse(playerPropertyId),
    p_asking_minor: z.number().int().positive().parse(askingMinor),
  });
  if (error) throw new Error(error.message);
  return z.object({ ok: z.literal(true), listingId: z.string().uuid() }).parse(data);
}

export async function cancelPropertyListing(listingId: string) {
  const { error } = await supabase.rpc("cancel_property_listing", {
    p_listing_id: z.string().uuid().parse(listingId),
  });
  if (error) throw new Error(error.message);
}

export async function buyPropertyListing(listingId: string, requestId = crypto.randomUUID()) {
  const { data, error } = await supabase.rpc("buy_property_listing", {
    p_listing_id: z.string().uuid().parse(listingId),
    p_request_id: z.string().uuid().parse(requestId),
  });
  if (error) throw new Error(error.message);
  return z
    .object({ ok: z.literal(true), propertyName: z.string(), amountMinor: z.number() })
    .parse(data);
}

const PROPERTY_MARKET_COPY: Readonly<Record<string, string>> = {
  ONLY_OWNED_HOMES_CAN_BE_LISTED:
    "Only an owned home can be listed for players. Stalls and rentals sell to an NPC.",
  ALREADY_LISTED: "This home is already listed for sale.",
  PRICE_OUT_OF_RANGE: "That asking price is above the most this home can be listed for.",
  INVALID_PRICE: "Enter a price above zero.",
  LISTING_NOT_OPEN: "This listing is no longer available.",
  CANNOT_BUY_OWN_LISTING: "You can’t buy your own listing.",
  NOT_FOR_SALE: "This home is no longer for sale.",
  ALREADY_HAS_HOME: "You already have a home. End that rental before you buy another.",
  INSUFFICIENT_FUNDS: "You do not have enough cash for this home.",
};

/** Player-facing line for a failed listing action. Falls back to the sale copy, then neutral copy. */
export function propertyMarketErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const codes = message.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [];
  const known = codes.find(
    (candidate) => candidate in PROPERTY_MARKET_COPY || candidate in PROPERTY_SALE_COPY,
  );
  if (!known) return PROPERTY_SALE_FALLBACK;
  return PROPERTY_MARKET_COPY[known] ?? PROPERTY_SALE_COPY[known]!;
}
