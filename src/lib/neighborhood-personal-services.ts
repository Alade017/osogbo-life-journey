import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const personalServiceSchema = z.object({
  id: z.enum(["barber-style", "pos-cashout"]),
  kind: z.enum(["barber", "pos"]),
  label: z.string(),
  cash_price: money,
  cash_payout: money,
  bank_fee: money,
  hair_styles: z.array(z.string()),
  hair_colors: z.array(z.string().regex(/^#[0-9a-f]{6}$/i)),
  available: z.boolean(),
});
export type PersonalService = z.infer<typeof personalServiceSchema>;
export const serviceIntentSchema = z.object({
  requestId: z.string().uuid(),
  serviceId: z.enum(["barber-style", "pos-cashout"]),
  hair: z.number().int().nonnegative().nullable(),
  hairColor: z.number().int().nonnegative().nullable(),
  quote: z.object({ cash_price: money, cash_payout: money, bank_fee: money }),
});
export type ServiceIntent = z.infer<typeof serviceIntentSchema>;
const serviceRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;
export async function fetchPersonalServices(zoneId: string) {
  const { data, error } = await serviceRpc("my_neighborhood_personal_services", {
    p_zone_id: zoneId,
  });
  if (error) throw new Error(error.message);
  return z.array(personalServiceSchema).parse(data);
}
export async function submitPersonalService(intent: ServiceIntent) {
  const { data, error } = await serviceRpc("use_neighborhood_personal_service", {
    p_service_id: intent.serviceId,
    p_request_id: intent.requestId,
    p_hair: intent.hair,
    p_hair_color: intent.hairColor,
    p_quote: intent.quote,
  });
  if (error) throw new Error(error.message);
  return z
    .object({
      ok: z.literal(true),
      service_id: z.literal(intent.serviceId),
      cash: money,
      bank: money,
    })
    .parse(data);
}
const messages: Record<string, string> = {
  VISIT_SERVICE_LOCATION: "Visit this service in City Centre while outside your home.",
  BANK_ACCOUNT_REQUIRED: "Open a bank account at a bank branch before using POS.",
  INSUFFICIENT_CASH: "You do not have enough pocket cash for this hairstyle.",
  INSUFFICIENT_SAVINGS: "Your savings must cover the cash withdrawal and its fee.",
  INVALID_APPEARANCE: "Choose an available hair style and colour.",
  STYLE_ALREADY_SELECTED: "You already have that hair style and colour.",
  QUOTE_CHANGED: "The service price changed. Refresh the catalogue before confirming again.",
  SERVICE_UNAVAILABLE: "This service is currently unavailable.",
  NO_CHARACTER: "Your character could not be loaded.",
  NO_WALLET: "Your wallet could not be loaded.",
  IDEMPOTENCY_CONFLICT:
    "This request has different details. Keep the original request and reload the service.",
};
export function personalServiceError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return (
    messages[code] ??
    "The response could not be confirmed. Retry this same request to check its receipt without paying twice."
  );
}
export function isDefiniteServiceRejection(error: unknown) {
  return (
    error instanceof Error &&
    Object.hasOwn(messages, error.message) &&
    error.message !== "IDEMPOTENCY_CONFLICT"
  );
}
