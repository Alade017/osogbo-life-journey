import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function canonicalHomeOptions(characterId: string | undefined) {
  return queryOptions({
    queryKey: ["canonicalHousingHome", characterId],
    staleTime: 15_000,
    queryFn: async (): Promise<unknown> => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error("HOME_UNAVAILABLE");
      const response = await fetch("/api/housing/current-home", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (!response.ok) throw new Error("HOME_UNAVAILABLE");
      return response.json();
    },
  });
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const amount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function parseHousingCost(value: unknown) {
  if (value === null) return null;
  if (
    !record(value) ||
    typeof value["propertyId"] !== "string" ||
    (value["tenure"] !== "owned" && value["tenure"] !== "rented")
  )
    throw new Error("Housing unavailable");
  const dates = {} as Record<"dueAt" | "graceEndsAt" | "rescueEndsAt", string | null>;
  for (const key of ["dueAt", "graceEndsAt", "rescueEndsAt"] as const) {
    const date = value[key];
    if (date != null && (typeof date !== "string" || !Number.isFinite(Date.parse(date))))
      throw new Error("Housing unavailable");
    dates[key] = typeof date === "string" ? date : null;
  }
  if (value["tenure"] === "rented" && !amount(value["weeklyRentMinor"]))
    throw new Error("Housing unavailable");
  return {
    owned: value["tenure"] === "owned",
    weeklyRent: value["tenure"] === "owned" ? null : (value["weeklyRentMinor"] as number),
    status: typeof value["status"] === "string" ? value["status"] : "unknown",
    ...dates,
  };
}

export function minimumFoodPrice(vendors: unknown, items: unknown): number | null {
  if (!Array.isArray(vendors) || !Array.isArray(items)) throw new Error("Menu unavailable");
  const ids = new Set(
    vendors.map((vendor: unknown) => {
      if (!record(vendor) || typeof vendor["id"] !== "string") throw new Error("Menu unavailable");
      return vendor["id"];
    }),
  );
  const prices: number[] = [];
  for (const item of items as unknown[]) {
    if (
      !record(item) ||
      typeof item["vendor_id"] !== "string" ||
      !amount(item["price_minor"]) ||
      item["price_minor"] === 0
    )
      throw new Error("Menu unavailable");
    if (ids.has(item["vendor_id"])) prices.push(item["price_minor"]);
  }
  return prices.length ? prices.reduce((lowest, price) => Math.min(lowest, price), Infinity) : null;
}

export async function readFoodCost(): Promise<number | null> {
  // These existing phone tables are not yet in the generated schema. Keep the cast at the read boundary.
  const db = supabase as unknown as {
    from(table: string): {
      select(columns: string): {
        eq(column: string, value: boolean): PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
  const [vendors, items] = await Promise.all([
    db.from("food_vendors").select("id").eq("active", true),
    db.from("food_menu_items").select("vendor_id,price_minor").eq("active", true),
  ]);
  if (vendors.error || items.error) throw new Error("Menu unavailable");
  return minimumFoodPrice(vendors.data, items.data);
}
