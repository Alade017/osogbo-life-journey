import { supabase } from "@/integrations/supabase/client";

export type HousingReliefState = {
  notice: null | { cycleId: string; houseName: string; repossessedAt: string };
  hustles: Array<{
    id: string;
    title: string;
    shiftPayMinor: number;
    shiftsTotal: number;
    shiftsCompleted: number;
    nextShiftAt: string;
    canWorkNow: boolean;
    rentPaid: boolean;
    keepConfirmedAt: string | null;
  }>;
  loanOffer: null | { principalMinor: number; instalmentMinor: number; instalmentsTotal: number };
  jobOffer: null | { shiftPayMinor: number; shiftsTotal: number };
};

export const housingReliefQueryKey = (characterId: string) =>
  ["housingRelief", characterId] as const;

export async function housingReliefFetch(path: string, init?: RequestInit): Promise<unknown> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in again to manage your home.");
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = result as { error?: { code?: string; reason?: string } } | null;
    throw new Error(error?.error?.reason ?? error?.error?.code ?? "Housing request failed.");
  }
  return result;
}

export async function getHousingReliefState(): Promise<HousingReliefState> {
  const value = await housingReliefFetch("/api/housing/rent-relief");
  if (!value || typeof value !== "object" || !Array.isArray((value as HousingReliefState).hustles))
    throw new Error("Housing relief state is unavailable.");
  return value as HousingReliefState;
}

export async function submitHousingReliefAction(
  action: "apply" | "complete" | "drop" | "keep",
  hustleId?: string,
) {
  return housingReliefFetch("/api/housing/rent-relief", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ action, hustleId }),
  });
}

export async function resolveHousingOverdue(option: "loan" | "job") {
  return housingReliefFetch("/api/housing/resolve-overdue", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ option }),
  });
}
