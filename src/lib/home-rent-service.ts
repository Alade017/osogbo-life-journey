import { supabase } from "@/integrations/supabase/client";

/**
 * Pays the current rent period of the player's active home. Reuse the same key when retrying a
 * payment that did not return, so the server records it once.
 */
export async function payHomeRent(requestKey: string = crypto.randomUUID()): Promise<unknown> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch("/api/housing/pay-rent", {
    method: "POST",
    headers: {
      "Idempotency-Key": requestKey,
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const reason =
      result !== null &&
      typeof result === "object" &&
      "error" in result &&
      result.error !== null &&
      typeof result.error === "object" &&
      "reason" in result.error &&
      typeof result.error.reason === "string"
        ? result.error.reason
        : null;
    throw new Error(reason ?? "Rent could not be paid. Try again.");
  }
  return result;
}
