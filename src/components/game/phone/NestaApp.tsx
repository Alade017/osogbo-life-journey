import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { House } from "lucide-react";
import { toast } from "sonner";
import { normalizeCanonicalHome } from "@/lib/canonical-home";
import { payHomeRent } from "@/lib/home-rent-service";
import { canonicalHomeOptions } from "@/lib/living-cost-service";
import { formatNaira, q } from "@/lib/game";
import "./vitalstat-nesta-app.css";

const STATUS_LABEL: Record<string, string> = {
  current: "Paid up",
  grace: "Grace period",
  rescue: "Rescue window",
  overdue: "Overdue",
};

/** Your home's rent and status, with payment and links to browse or manage homes. */
export function NestaApp({ onOpenApp }: { onOpenApp: (app: string) => void }) {
  const client = useQueryClient();
  const character = useQuery(q.character()).data;
  const homeOptions = canonicalHomeOptions(character?.id);
  const home = useQuery({
    ...homeOptions,
    enabled: !!character?.id,
    select: normalizeCanonicalHome,
  });
  // Reuse the key when retrying a payment that did not return, so the server records it once.
  const payKey = useRef<string | null>(null);
  const pay = useMutation({
    mutationFn: () => {
      const key = payKey.current ?? crypto.randomUUID();
      payKey.current = key;
      return payHomeRent(key);
    },
    onSuccess: () => {
      payKey.current = null;
      toast.success("Rent paid. Your home is current for another week.");
      void client.invalidateQueries({ queryKey: homeOptions.queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rented = home.data?.tenure === "rented" ? home.data : null;
  const isCurrent = rented?.status === "current";
  const dueLabel = rented?.dueAt
    ? new Date(rented.dueAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })
    : null;

  return (
    <section className="nesta-app" aria-label="Nesta">
      <header className="nesta-hero">
        <span className="nesta-mark" aria-hidden="true">
          <House size={20} />
        </span>
        <div>
          <h2>Nesta</h2>
          <p>Your home, rent and what you can upgrade.</p>
        </div>
      </header>

      {home.isPending && character?.id ? <p className="nesta-note">Loading your home…</p> : null}

      {!home.isPending && !rented ? (
        <div className="nesta-card">
          <p>You don&apos;t rent a home yet.</p>
          <button type="button" className="nesta-button" onClick={() => onOpenApp("Find homes")}>
            Browse homes
          </button>
        </div>
      ) : null}

      {rented ? (
        <div className="nesta-card">
          <h3>{rented.name}</h3>
          {rented.district ? <p className="nesta-muted">{rented.district}</p> : null}
          <dl className="nesta-facts">
            <div>
              <dt>Status</dt>
              <dd>{STATUS_LABEL[rented.status ?? ""] ?? "Rent due"}</dd>
            </div>
            {dueLabel ? (
              <div>
                <dt>Next due</dt>
                <dd>{dueLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt>Weekly rent</dt>
              <dd>{formatNaira(rented.weeklyRentMinor)}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="nesta-button"
            disabled={isCurrent || pay.isPending}
            onClick={() => pay.mutate()}
          >
            {pay.isPending ? "Paying…" : isCurrent ? "Rent is paid" : "Pay rent"}
          </button>
          <div className="nesta-links">
            <button type="button" onClick={() => onOpenApp("Find homes")}>
              Browse homes
            </button>
            <button type="button" onClick={() => onOpenApp("Property")}>
              Manage home
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
