import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const service = z.object({
  id: z.string(),
  name: z.string(),
  defaultPrice: money,
  minPrice: money,
  maxPrice: money,
});
const business = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  location: z.string(),
  price: money,
  dailyCustomers: money,
  services: z.array(service),
});
const company = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string(),
  location: z.string(),
  sharesForSale: money.max(3000),
  pricePerShare: money,
  isOwner: z.boolean(),
});
const ownedCompany = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  location: z.string(),
  purchasePrice: money,
  services: z.array(service),
  prices: z.record(z.string(), money),
  accruedAt: z.string().datetime({ offset: true }),
  sharesForSale: money.max(3000),
});
const product = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  termDays: money.min(1),
  yieldBps: money,
  minAmount: money,
  maxAmount: money,
});
const investment = z.object({
  id: z.string(),
  product: z.string(),
  principal: money,
  maturesAt: z.string().datetime({ offset: true }),
  claimedAt: z.string().datetime({ offset: true }).nullable(),
  yieldBps: money,
});
const overviewSchema = z.object({
  businesses: z.array(business),
  companies: z.array(company),
  products: z.array(product),
  myCompanies: z.array(ownedCompany),
  myInvestments: z.array(investment),
  myCompanyInvestments: z.array(
    z.object({ companyId: z.string(), name: z.string(), shares: money.max(10000) }),
  ),
});
export type BusinessOverview = z.infer<typeof overviewSchema>;
export function parseBusinessOverview(value: unknown): BusinessOverview {
  const parsed = overviewSchema.safeParse(value);
  if (!parsed.success) throw new Error("The finance market returned invalid data. Please retry.");
  return parsed.data;
}

export function investmentAmountError(value: number, minimum: number, maximum: number) {
  return !Number.isSafeInteger(value) || value < minimum || value > maximum
    ? `Enter a whole amount between ${minimum.toLocaleString("en-NG")} and ${maximum.toLocaleString("en-NG")}.`
    : null;
}

export type BusinessCommand =
  | { kind: "buy"; slug: string; requestId: string }
  | { kind: "fixed"; slug: string; amount: number; requestId: string }
  | { kind: "invest"; id: string; shares: number; requestId: string }
  | { kind: "configure"; id: string; prices: Record<string, number> }
  | { kind: "offer"; id: string; shares: number }
  | { kind: "claimBusiness" | "claimFixed"; id: string };

export async function getBusinessOverview() {
  const { data, error } = await supabase.rpc("get_business_and_investment_market");
  if (error) throw new Error(error.message);
  return parseBusinessOverview(data);
}

export async function executeBusinessCommand(command: BusinessCommand) {
  const result = await (() => {
    switch (command.kind) {
      case "buy":
        return supabase.rpc("buy_player_company", {
          p_business_slug: command.slug,
          p_request_id: command.requestId,
        });
      case "fixed":
        return supabase.rpc("create_fixed_term_investment", {
          p_product_slug: command.slug,
          p_amount: command.amount,
          p_request_id: command.requestId,
        });
      case "invest":
        return supabase.rpc("invest_in_player_company", {
          p_company_id: command.id,
          p_shares: command.shares,
          p_request_id: command.requestId,
        });
      case "offer":
        return supabase.rpc("offer_player_company_shares", {
          p_company_id: command.id,
          p_shares: command.shares,
        });
      case "configure":
        return supabase.rpc("configure_player_company", {
          p_company_id: command.id,
          p_prices: command.prices,
        });
      case "claimBusiness":
        return supabase.rpc("claim_player_company_earnings", { p_company_id: command.id });
      case "claimFixed":
        return supabase.rpc("claim_fixed_term_investment", { p_investment_id: command.id });
    }
  })();
  if (result.error) throw new Error(result.error.message);
  if (
    !result.data ||
    typeof result.data !== "object" ||
    Array.isArray(result.data) ||
    result.data["ok"] !== true
  )
    throw new Error("The server did not confirm this finance action.");
  return result.data;
}
