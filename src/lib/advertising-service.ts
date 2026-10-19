import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const billboardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  placement: z.string(),
  sizeType: z.enum(["small", "medium", "large"]),
  location: z.string(),
  locationId: z.string().uuid(),
  dailyPrice: z.number().int().positive(),
});
const campaignSchema = z.object({
  id: z.string().uuid(),
  billboardId: z.string().uuid(),
  billboardName: z.string(),
  advertiserName: z.string(),
  title: z.string(),
  description: z.string(),
  creativeTheme: z.enum(["green", "ink", "sun", "clay"]),
  durationDays: z.number().int(),
  amountPaid: z.number(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.enum(["active", "expired"]),
});
const marketSchema = z.object({
  billboards: z.array(billboardSchema),
  myAds: z.array(campaignSchema),
});
export type AdvertisingMarket = z.infer<typeof marketSchema>;
export type AdTheme = z.infer<typeof campaignSchema>["creativeTheme"];

export function parseAdvertisingMarket(value: unknown): AdvertisingMarket {
  const result = marketSchema.safeParse(value);
  if (!result.success)
    throw new Error("The billboard market returned invalid data. Retry to reload it.");
  return result.data;
}

export async function getAdvertisingMarket() {
  const { data, error } = await (supabase.rpc as any)("get_player_advertising_market");
  if (error) throw new Error(error.message);
  return parseAdvertisingMarket(data);
}

export type PurchaseAdInput = {
  billboardId: string;
  advertiserName: string;
  title: string;
  description: string;
  creativeTheme: AdTheme;
  durationDays: 7 | 14 | 30;
  requestId: string;
};

export async function purchasePlayerAd(input: PurchaseAdInput) {
  const { data, error } = await (supabase.rpc as any)("purchase_player_advertisement", {
    p_billboard_id: input.billboardId,
    p_advertiser_name: input.advertiserName,
    p_title: input.title,
    p_description: input.description,
    p_creative_theme: input.creativeTheme,
    p_duration_days: input.durationDays,
    p_request_id: input.requestId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data) || data["ok"] !== true)
    throw new Error("The server did not confirm the billboard purchase.");
  return data;
}

export type UpdateAdInput = Pick<
  PurchaseAdInput,
  "advertiserName" | "title" | "description" | "creativeTheme"
> & { advertisementId: string };

export async function updatePlayerAd(input: UpdateAdInput) {
  const { data, error } = await (supabase.rpc as any)("update_player_advertisement", {
    p_advertisement_id: input.advertisementId,
    p_advertiser_name: input.advertiserName,
    p_title: input.title,
    p_description: input.description,
    p_creative_theme: input.creativeTheme,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data) || data["ok"] !== true)
    throw new Error("The server did not confirm the billboard update.");
  return data;
}

export function billboardCampaignPrice(dailyPrice: number, durationDays: number) {
  return dailyPrice * durationDays;
}
