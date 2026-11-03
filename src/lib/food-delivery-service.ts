import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const foodItemSchema = z.object({
  name: z.string(),
  quantity: z.number().int().positive(),
});

const deliverySchema = z.object({
  id: z.string(),
  status: z.enum(["requested", "preparing", "delivered", "cancelled"]),
  deliveryState: z.enum([
    "pending",
    "awaiting_response",
    "approaching",
    "package_waiting",
    "collected",
    "cancelled",
  ]),
  deliveryChoice: z.enum(["inside", "outside"]).nullable(),
  totalMinor: z.number().int().nonnegative(),
  createdAt: z.string(),
  vendorName: z.string(),
  items: z.array(foodItemSchema),
});

const deliveryResponseSchema = z.object({
  orderId: z.string(),
  deliveryState: z.enum(["approaching", "collected"]),
  deliveryChoice: z.enum(["inside", "outside"]).optional(),
  handoffDueAt: z.string().optional(),
  collectedAt: z.string().nullable().optional(),
});

export type FoodDelivery = z.infer<typeof deliverySchema>;

async function getFoodDeliveryHistory(): Promise<FoodDelivery[]> {
  const { data, error } = await supabase.rpc("get_food_delivery_history");
  if (error) throw error;
  return z.array(deliverySchema).parse(data);
}

async function processHomeFoodDeliveries(): Promise<FoodDelivery[]> {
  const { data, error } = await supabase.rpc("process_home_food_deliveries");
  if (error) throw error;
  return z.array(deliverySchema).parse(data);
}

async function respondToHomeFoodDelivery(
  orderId: string,
  choice: "inside" | "outside",
): Promise<void> {
  const { data, error } = await supabase.rpc("respond_to_home_food_delivery", {
    p_order_id: orderId,
    p_choice: choice,
  });
  if (error) throw error;
  deliveryResponseSchema.parse(data);
}

async function collectHomeFoodDelivery(orderId: string): Promise<void> {
  const { data, error } = await supabase.rpc("collect_home_food_delivery", {
    p_order_id: orderId,
  });
  if (error) throw error;
  deliveryResponseSchema.parse(data);
}

export const foodDeliveryService = {
  getHistory: getFoodDeliveryHistory,
  processAtHome: processHomeFoodDeliveries,
  respond: respondToHomeFoodDelivery,
  collect: collectHomeFoodDelivery,
};
