import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const stallCategorySchema = z.enum([
  "fabrics",
  "groceries",
  "phones",
  "hospitality",
  "crafts",
]);
export type StallCategory = z.infer<typeof stallCategorySchema>;
export const publicStallCategorySchema = z.union([stallCategorySchema, z.literal("general")]);
export type PublicStallCategory = z.infer<typeof publicStallCategorySchema>;

export const STALL_CATEGORY_OPTIONS: Array<{
  id: StallCategory;
  label: string;
  desc: string;
}> = [
  {
    id: "fabrics",
    label: "Adire & Ankara Fabrics",
    desc: "Authentic Osogbo tie-dye and tailored wear",
  },
  {
    id: "groceries",
    label: "Fresh Market Produce",
    desc: "Yam, peppers, plantain, palm oil and fruits",
  },
  {
    id: "phones",
    label: "Phone Care & Accessories",
    desc: "Chargers, screen guards, earphones, casing",
  },
  {
    id: "hospitality",
    label: "Street Food & Cold Drinks",
    desc: "Puff-puff, roasted plantain, suya, soft drinks",
  },
  {
    id: "crafts",
    label: "Handcrafted Beads & Art",
    desc: "Osogbo sacred grove inspired wooden carvings and beads",
  },
];

const categoryLabels: Record<StallCategory, string> = {
  fabrics: "Adire & Ankara Fabrics",
  groceries: "Fresh Market Produce",
  phones: "Phone Care & Accessories",
  hospitality: "Street Food & Cold Drinks",
  crafts: "Handcrafted Beads & Art",
};

const rentStatusSchema = z
  .object({
    propertyId: z.string().uuid(),
    playerPropertyId: z.string().uuid(),
    name: z.string().min(1),
    weeklyRentMinor: z.number().int().positive(),
    status: z.enum(["current", "due", "grace", "rescue"]),
    dueAt: z.string().datetime({ offset: true }),
    graceEndsAt: z.string().datetime({ offset: true }),
    rescueEndsAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type MarketStallRentStatus = z.infer<typeof rentStatusSchema>;

const rentReceiptSchema = z
  .object({
    propertyId: z.string().uuid(),
    playerPropertyId: z.string().uuid(),
    weeklyRentMinor: z.number().int().positive(),
    dueAt: z.string().datetime({ offset: true }),
    status: z.literal("current"),
    cash: z.number().int().nonnegative(),
    duplicate: z.boolean(),
  })
  .passthrough();

const stallProfileSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(2).max(64),
    goods: z.string().min(2).max(200),
    is_open: z.boolean(),
    stall_category: publicStallCategorySchema,
  })
  .strict();

const publicStockItemSchema = z
  .object({
    id: z.string().uuid(),
    itemId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().nullable(),
    priceMinor: z.number().int().positive(),
    quantity: z.number().int().min(1).max(999),
  })
  .strict();

const ownerStockItemSchema = publicStockItemSchema.extend({
  quantity: z.number().int().min(0).max(999),
  referenceBuyPrice: z.number().int().positive(),
});

const stockMutationSchema = z
  .object({
    ok: z.literal(true),
    action: z.enum(["add", "set_price", "set_quantity", "remove"]),
    id: z.string().uuid(),
    itemId: z.string().uuid().optional(),
    quantity: z.number().int().min(0).max(999),
    priceMinor: z.number().int().positive().optional(),
  })
  .passthrough();

const purchaseReceiptSchema = z
  .object({
    stallItemId: z.string().uuid(),
    itemId: z.string().uuid(),
    itemName: z.string().min(1),
    quantity: z.number().int().min(1).max(20),
    totalMinor: z.number().int().positive(),
    buyerBalance: z.number().int().nonnegative(),
    sellerBalance: z.number().int().nonnegative(),
    remainingStock: z.number().int().min(0).max(999),
    duplicate: z.boolean(),
  })
  .passthrough();

type RpcError = { message: string } | null;
type RpcResult = { data: unknown; error: RpcError };
type Rpc = (name: string, args: Record<string, unknown>) => Promise<RpcResult>;

async function callRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function getMyPlayerStall(characterId: string) {
  const from = supabase.from.bind(supabase) as unknown as (table: "player_stalls") => {
    select: (columns: string) => {
      eq: (
        column: "character_id",
        value: string,
      ) => {
        maybeSingle: () => Promise<{ data: unknown; error: RpcError }>;
      };
    };
  };
  const { data, error } = await from("player_stalls")
    .select("id,name,goods,is_open,stall_category")
    .eq("character_id", characterId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data === null ? null : stallProfileSchema.parse(data);
}

export async function getMarketStallRentStatus() {
  const data = await callRpc("my_market_stall_rent_status", {});
  if (data && typeof data === "object" && !Array.isArray(data) && Object.keys(data).length === 0)
    return null;
  return rentStatusSchema.parse(data);
}

export async function rentMarketStall(requestId = crypto.randomUUID()) {
  return rentReceiptSchema.parse(
    await callRpc("rent_market_stall", { p_request_id: z.string().uuid().parse(requestId) }),
  );
}

export async function payMarketStallRent(requestId = crypto.randomUUID()) {
  return rentReceiptSchema.parse(
    await callRpc("pay_market_stall_rent", { p_request_id: z.string().uuid().parse(requestId) }),
  );
}

export async function saveMyPlayerStall(input: {
  name: string;
  category: StallCategory;
  isOpen: boolean;
}) {
  const category = stallCategorySchema.parse(input.category);
  const data = await callRpc("save_player_stall", {
    p_name: input.name,
    p_goods: categoryLabels[category],
    p_is_open: input.isOpen,
  });
  return z
    .object({ ok: z.literal(true), isOpen: z.boolean(), category: stallCategorySchema })
    .strict()
    .parse(data);
}

export async function getMyStallStock() {
  return z.array(ownerStockItemSchema).parse(await callRpc("get_my_stall_stock", {}));
}

export async function getPublicStallStock(stallId: string) {
  return z
    .array(publicStockItemSchema)
    .parse(
      await callRpc("get_public_stall_stock", { p_stall_id: z.string().uuid().parse(stallId) }),
    );
}

export const stallStockRequestSchema = z
  .object({
    action: z.enum(["add", "set_price", "set_quantity", "remove"]),
    itemId: z.string().uuid(),
    quantity: z.number().int().min(0).max(999).optional(),
    priceMinor: z.number().int().positive().optional(),
    requestId: z.string().uuid(),
  })
  .refine(
    (v) =>
      v.action !== "add" ||
      (v.quantity !== undefined && v.quantity > 0 && v.priceMinor !== undefined),
  )
  .refine((v) => v.action !== "set_quantity" || v.quantity !== undefined)
  .refine((v) => v.action !== "set_price" || v.priceMinor !== undefined);
export type StallStockRequest = z.infer<typeof stallStockRequestSchema>;
export type StallStockOperation = Omit<StallStockRequest, "requestId">;

export async function manageMyStallStock(input: StallStockRequest) {
  const request = stallStockRequestSchema.parse(input);
  const response = await callRpc("manage_my_stall_stock_request", {
    p_action: request.action,
    p_item_id: request.itemId,
    p_quantity: request.quantity ?? null,
    p_price_minor: request.priceMinor ?? null,
    p_request_id: request.requestId,
  });
  return stockMutationSchema.parse(response);
}

export async function purchasePlayerStallItem(input: {
  stallItemId: string;
  quantity: number;
  requestId?: string;
}) {
  const response = await callRpc("purchase_player_stall_item", {
    p_request_id: z
      .string()
      .uuid()
      .parse(input.requestId ?? crypto.randomUUID()),
    p_stall_item_id: z.string().uuid().parse(input.stallItemId),
    p_quantity: z.number().int().min(1).max(20).parse(input.quantity),
  });
  return purchaseReceiptSchema.parse(response);
}

const MARKET_STALL_ERROR_COPY: Readonly<Record<string, string>> = {
  ALREADY_RENTING: "You already rent a home. End that rental before you rent a stall.",
  INSUFFICIENT_FUNDS: "You do not have enough cash for the first week’s rent.",
  MARKET_STALL_UNAVAILABLE: "This stall is not available to rent right now.",
  REGISTERED_ACCOUNT_REQUIRED: "Create an account to rent a stall.",
  REQUEST_ID_REQUIRED: "That request could not be sent. Try again.",
  IDEMPOTENCY_CONFLICT: "That request was already used for something else. Try again.",
};

const MARKET_STALL_FALLBACK = "That change could not be completed. Try again.";

/** Player-facing line for a failed stall action. Known server codes get plain copy, never the raw code. */
export function marketStallErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const codes = message.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [];
  const known = codes.find((candidate) => candidate in MARKET_STALL_ERROR_COPY);
  return known ? MARKET_STALL_ERROR_COPY[known]! : MARKET_STALL_FALLBACK;
}
