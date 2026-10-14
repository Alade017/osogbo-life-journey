import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, House, LoaderCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type HouseOption = {
  id: string;
  label: string;
  bedrooms: number;
  kitchen_access: "shared" | "private";
  bathroom_access: "shared" | "private";
  monthly_rent: number;
  deposit: number;
  upfront_total: number;
  eligible: boolean;
  reason: string | null;
};
type Eligibility = { monthly_income: number; houses: HouseOption[] };

async function api(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.code ?? "Housing request failed.");
  return body;
}

function naira(amount: number) {
  return `₦${Number(amount).toLocaleString("en-NG")}`;
}

export function HousingChooser({
  open,
  pending,
  onClose,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const eligibleQuery = useQuery<Eligibility>({
    queryKey: ["housingEligibility"],
    enabled: open,
    queryFn: () => api("/api/housing/eligible"),
    staleTime: 0,
  });
  const [choosing, setChoosing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const requestKeys = useRef(new Map<string, string>());

  if (!open || !pending) return null;

  async function choose(house: HouseOption) {
    setChoosing(house.id);
    setError("");
    try {
      const key = requestKeys.current.get(house.id) ?? crypto.randomUUID();
      requestKeys.current.set(house.id, key);
      await api("/api/housing/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ house_type_id: house.id }),
      });
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["character"] }),
        cache.invalidateQueries({ queryKey: ["housingHome"] }),
        cache.invalidateQueries({ queryKey: ["wallet"] }),
        cache.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
      requestKeys.current.delete(house.id);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message.replaceAll("_", " ").toLowerCase()
          : "We could not complete the move-in. Please try again.",
      );
    } finally {
      setChoosing(null);
    }
  }

  async function defer() {
    try {
      await api("/api/housing/defer", { method: "POST" });
      onClose();
    } catch {
      setError("We could not save your choice. Please try again.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <section
        aria-labelledby="housing-title"
        aria-modal="true"
        role="dialog"
        className="w-full max-h-[88dvh] overflow-y-auto rounded-t-[24px] border border-edge bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-card-foreground shadow-2xl sm:max-w-xl sm:rounded-[24px]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">
              Your first home
            </p>
            <h2 id="housing-title" className="mt-1 font-display text-2xl font-bold">
              Choose where you&apos;ll live.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a place that fits your wallet and monthly income.
            </p>
          </div>
          {!pending && (
            <button
              type="button"
              aria-label="Close housing choices"
              className="game-control rounded-full p-2"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          )}
        </div>
        {eligibleQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="animate-spin" aria-label="Loading homes" />
          </div>
        ) : eligibleQuery.isError ? (
          <div className="mt-5 rounded-xl bg-destructive/10 p-4 text-sm" role="alert">
            Housing options could not load. Reopen this sheet to try again.
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {(eligibleQuery.data?.houses ?? []).map((house) => (
              <article
                key={house.id}
                className={`rounded-2xl border border-edge bg-background p-4 ${!house.eligible ? "opacity-75" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-primary/10 p-2 text-primary">
                      <House size={20} />
                    </span>
                    <div>
                      <h3 className="font-bold">{house.label}</h3>
                      <p className="text-sm text-muted-foreground">
                        {house.bedrooms} bedroom{house.bedrooms === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <span className="text-right text-xs font-semibold">
                    {naira(house.monthly_rent)}
                    <br />
                    <span className="font-normal text-muted-foreground">per month</span>
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  {house.kitchen_access} kitchen · {house.bathroom_access} bathroom
                </p>
                <p className="mt-1 text-sm">
                  First month + deposit: <strong>{naira(house.upfront_total)}</strong>
                </p>
                {house.eligible ? (
                  <Button
                    className="mt-3 w-full"
                    disabled={choosing !== null}
                    onClick={() => void choose(house)}
                  >
                    {choosing === house.id ? (
                      <LoaderCircle className="mr-2 animate-spin" size={16} />
                    ) : (
                      <Check className="mr-2" size={16} />
                    )}
                    Move in
                  </Button>
                ) : (
                  <p className="mt-3 text-sm font-medium text-muted-foreground">{house.reason}</p>
                )}
              </article>
            ))}
          </div>
        )}
        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button variant="plain" className="mt-4 w-full" onClick={() => void defer()}>
          Decide later
        </Button>
      </section>
    </div>
  );
}
