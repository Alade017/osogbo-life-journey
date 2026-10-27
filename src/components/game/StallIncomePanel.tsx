import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatNaira } from "@/lib/game";
import { claimStallIncome, readStallIncome, stallIncomeKey } from "@/lib/stall-income-service";
export function StallIncomePanel({ userId }: { userId: string }) {
  const client = useQueryClient();
  const mounted = useRef(true),
    submitting = useRef(false),
    request = useRef<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    mounted.current = true;
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const income = useQuery({
    queryKey: stallIncomeKey(userId),
    queryFn: readStallIncome,
    enabled: !!userId && online,
    retry: false,
    refetchInterval: 30_000,
  });
  const claim = useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async (id: string) => {
      if (!navigator.onLine) throw new Error("Reconnect before claiming.");
      return claimStallIncome(id);
    },
    onSuccess: async (result) => {
      request.current = null;
      if (!mounted.current) return;
      if (!result.duplicate)
        toast.success(
          result.amount > 0
            ? `${formatNaira(result.amount)} stall income confirmed.`
            : "Nothing to claim. No money was added.",
        );
      await Promise.all([
        client.invalidateQueries({ queryKey: stallIncomeKey(userId) }),
        client.invalidateQueries({ queryKey: ["wallet"] }),
        client.invalidateQueries({ queryKey: ["transactions"] }),
        client.invalidateQueries({ queryKey: ["character"] }),
      ]);
    },
    onError: () => {
      if (mounted.current && navigator.onLine) void income.refetch();
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  const recovered =
    !!income.data?.lastReceipt && income.data.lastReceipt.requestId === claim.variables;
  useEffect(() => {
    if (recovered) request.current = null;
  }, [recovered]);
  const retry = claim.isError && !!request.current && !recovered;
  const data = income.data;
  return (
    <section aria-label="Stall income" className="game-panel grid min-w-0 gap-3 p-4">
      <h3 className="font-semibold">Stall income</h3>
      <p className="text-sm">
        Earn ₦10 per server hour while your saved stall is open, including offline. Capped at ₦100
        per Lagos earning day.
      </p>
      <p className="text-xs text-muted-foreground">
        Only today and the six previous Lagos earning dates remain claimable. Older earnings expire.
        Save changes to enroll or change your stall's open status.
      </p>
      {!online && (
        <p role="status">
          Offline. Previously loaded amounts are estimates; reconnect to refresh or claim.
        </p>
      )}
      {income.isPending && online && <p role="status">Loading stall income…</p>}
      {income.isError && (
        <p role="alert">
          {income.error.message}{" "}
          <button
            type="button"
            className="min-h-11 underline"
            disabled={!online}
            onClick={() => void income.refetch()}
          >
            Retry income
          </button>
        </p>
      )}
      {data && (
        <>
          <p>
            {!data.hasStall
              ? "Save a stall to start earning."
              : !data.enrolled
                ? "Save your stall once to start tracking income. Earlier time does not earn."
                : data.isOpen
                  ? "Saved stall is open and earning."
                  : "Saved stall is closed. Earlier unexpired earnings remain claimable."}
          </p>
          <p className="font-semibold">Estimated claimable: {formatNaira(data.claimable)}</p>
          <p className="text-sm">
            Today: {formatNaira(data.todayEarned)} earned of {formatNaira(data.dailyCap)} ·{" "}
            {formatNaira(data.todayPaid)} already claimed
          </p>
          <p className="text-xs text-muted-foreground">
            Estimate as of{" "}
            {new Date(data.asOf).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })} (Lagos).
            Updated from the server; saving or claiming rechecks elapsed time.
          </p>
          {data.lastReceipt && <p>Last confirmed payout: {formatNaira(data.lastReceipt.amount)}</p>}
        </>
      )}
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
        disabled={
          !online ||
          claim.isPending ||
          !userId ||
          (!retry && (!data || data.claimable === 0 || income.isError))
        }
        onClick={() => {
          if (submitting.current) return;
          submitting.current = true;
          request.current ??= crypto.randomUUID();
          claim.mutate(request.current);
        }}
      >
        {claim.isPending
          ? "Confirming payout…"
          : retry
            ? "Retry claim"
            : data?.claimable === 0
              ? "Nothing to claim"
              : "Claim stall income"}
      </button>
      {claim.isError && !recovered && <p role="alert">{claim.error.message}</p>}
    </section>
  );
}
