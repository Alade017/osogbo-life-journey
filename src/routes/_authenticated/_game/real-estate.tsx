import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, q } from "@/lib/game";
import { loadOwnedHouses } from "@/lib/property-assets";
import { housingRequest } from "@/lib/housing-request";
import { pageMeta } from "@/lib/seo";
import {
  buildTiers,
  buyChoice,
  rentChoice,
  statusFor,
  type Choice,
  type Context,
  type OwnedRow,
  type RentListing,
  type SaleListing,
  type Tier,
} from "@/components/game/housing/real-estate-tiers";
import "@/components/map/map-ui.css";
import "@/components/game/housing/property-listings.css";

export const Route = createFileRoute("/_authenticated/_game/real-estate")({
  head: () => pageMeta("Real Estate", "Rent or buy a home in Osogbo Life."),
  component: RealEstatePage,
});

type Pending = { tier: Tier; kind: "rent" | "buy"; choice: Choice };

const STATUS_LABEL = {
  owned: "Owned",
  rented: "Your rented home",
  available: "Available",
} as const;

export function RealEstatePage() {
  const queryClient = useQueryClient();
  const characterQuery = useQuery(q.character());
  const walletQuery = useQuery(q.wallet());
  const character = characterQuery.data;
  const wallet = walletQuery.data;
  const [pending, setPending] = useState<Pending | null>(null);
  const [actionError, setActionError] = useState("");
  const requestKeys = useRef(new Map<string, string>());

  const rentQuery = useQuery({
    queryKey: ["housingProperties", character?.id],
    enabled: !!character?.id,
    staleTime: 15_000,
    queryFn: async () => {
      const result = await housingRequest<unknown>("/api/housing/properties");
      if (!Array.isArray(result)) throw new Error("The property list could not be read.");
      return result as RentListing[];
    },
  });
  const saleQuery = useQuery({
    queryKey: ["saleHomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_properties")
        .select("id,name,description,house_type_id,purchase_price,level_required")
        .eq("is_active", true)
        .not("purchase_price", "is", null)
        .not("house_type_id", "is", null);
      if (error) throw error;
      return (data ?? []) as SaleListing[];
    },
  });
  const ownedQuery = useQuery({
    queryKey: ["ownedHouses", character?.id],
    enabled: !!character?.id,
    queryFn: () => loadOwnedHouses(character!.id),
  });

  const owned: OwnedRow[] = useMemo(
    () =>
      (ownedQuery.data ?? []).map((row) => ({
        id: row.id,
        tenure: row.tenure,
        is_active: true,
        game_properties: row.game_properties
          ? { id: row.game_properties.id, house_type_id: row.game_properties.house_type_id }
          : null,
      })),
    [ownedQuery.data],
  );
  const rentListings = rentQuery.data ?? [];
  const tiers = useMemo(
    () => buildTiers(rentListings, saleQuery.data ?? []),
    [rentListings, saleQuery.data],
  );
  const context: Context = {
    balance: walletQuery.isPending || walletQuery.isError ? null : Number(wallet?.balance ?? 0),
    level: character?.level ?? 0,
    owned,
    rentListings,
  };
  const loadError =
    characterQuery.error ??
    walletQuery.error ??
    rentQuery.error ??
    saleQuery.error ??
    ownedQuery.error;

  const commit = useMutation({
    mutationFn: async ({ tier, kind }: Pending) => {
      if (kind === "buy") {
        const { error } = await supabase.rpc("acquire_game_property", {
          p_property_id: tier.sale!.id,
          p_tenure: "owned",
        });
        if (error) throw error;
        return;
      }
      const key = requestKeys.current.get(tier.houseTypeId) ?? crypto.randomUUID();
      requestKeys.current.set(tier.houseTypeId, key);
      await housingRequest<unknown>("/api/housing/rent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ property_id: tier.rent!.propertyId }),
      });
    },
    onSuccess: async (_result, { tier, kind, choice }) => {
      requestKeys.current.delete(tier.houseTypeId);
      setActionError("");
      setPending(null);
      await Promise.all(
        [
          ["housingProperties"],
          ["housingEligibility"],
          ["saleHomes"],
          ["ownedHouses"],
          ["housingHome"],
          ["canonicalHousingHome"],
          ["authoritativeHouseState"],
          ["housingMapProperties"],
          ["transactions"],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: q.character().queryKey }),
        queryClient.invalidateQueries({ queryKey: q.wallet().queryKey }),
      ]);
      const refund =
        choice.refundMinor > 0 ? ` ${formatNaira(choice.refundMinor)} deposit refunded.` : "";
      toast.success(
        kind === "buy"
          ? `${tier.label} is now your home.${refund}`
          : `Your ${tier.label} rental is confirmed.${refund}`,
      );
    },
    onError: (error: Error) => {
      setActionError(error.message);
      void rentQuery.refetch();
      void ownedQuery.refetch();
    },
  });

  function choose(tier: Tier, kind: "rent" | "buy") {
    const choice = kind === "rent" ? rentChoice(context, tier) : buyChoice(context, tier);
    setActionError("");
    setPending({ tier, kind, choice });
  }

  return (
    <div className="property-listings-page">
      <header className="property-listings-hero">
        <p className="map-sheet-eyebrow">REAL ESTATE</p>
        <h1>Rent or buy a home</h1>
        <p>
          Each home is offered as a rental or for purchase. Choosing a different home ends your
          current rental and refunds its deposit. Owned homes skip weekly rent.
        </p>
        <div className="property-listings-balance">
          <span>Available cash</span>
          <strong>{context.balance === null ? "Loading…" : formatNaira(context.balance)}</strong>
        </div>
        <nav className="property-listings-nav" aria-label="Housing navigation">
          <Link to="/house">My home</Link>
          <Link to="/properties">My properties</Link>
        </nav>
      </header>

      {loadError && (
        <p className="property-listings-error" role="alert">
          {loadError.message}
        </p>
      )}
      {!loadError && tiers.length === 0 && (rentQuery.isPending || saleQuery.isPending) && (
        <p className="property-listings-empty">Loading homes…</p>
      )}
      {!loadError && !rentQuery.isPending && !saleQuery.isPending && tiers.length === 0 && (
        <p className="property-listings-empty">No homes are available right now.</p>
      )}

      <div className="property-listings-grid">
        {tiers.map((tier) => {
          const status = statusFor(context, tier);
          const rent = rentChoice(context, tier);
          const buy = buyChoice(context, tier);
          return (
            <article className="property-listings-card" key={tier.houseTypeId}>
              <header>
                <h2>{tier.label}</h2>
                <span className="property-listings-status" data-status={status}>
                  {STATUS_LABEL[status]}
                </span>
              </header>
              <p>{tier.description}</p>
              <dl>
                {tier.rent && (
                  <>
                    <dt>Rent</dt>
                    <dd>{formatNaira(tier.rent.weeklyRentMinor)} / week</dd>
                    <dt>Move-in</dt>
                    <dd>{formatNaira(tier.rent.upfrontTotalMinor)}</dd>
                  </>
                )}
                {tier.sale?.purchase_price != null && (
                  <>
                    <dt>Price</dt>
                    <dd>{formatNaira(tier.sale.purchase_price)}</dd>
                  </>
                )}
              </dl>
              <div className="property-listings-actions">
                <button
                  type="button"
                  disabled={!rent.enabled || commit.isPending}
                  onClick={() => choose(tier, "rent")}
                >
                  Rent
                </button>
                <button
                  type="button"
                  disabled={!buy.enabled || commit.isPending}
                  onClick={() => choose(tier, "buy")}
                >
                  Buy
                </button>
              </div>
              {!rent.enabled && tier.rent && rent.reason && <small>Rent: {rent.reason}</small>}
              {!buy.enabled && tier.sale && buy.reason && <small>Buy: {buy.reason}</small>}
            </article>
          );
        })}
      </div>

      <Dialog.Root open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="property-listings-overlay" />
          <Dialog.Content className="property-listings-dialog" aria-describedby={undefined}>
            {pending && (
              <>
                <Dialog.Title>
                  {pending.kind === "buy" ? "Buy" : "Rent"} {pending.tier.label}
                </Dialog.Title>
                <p>
                  {pending.kind === "buy"
                    ? `You pay ${formatNaira(pending.choice.costMinor)} to own this home.`
                    : `You pay ${formatNaira(pending.choice.costMinor)} to move in, including the deposit.`}
                </p>
                {pending.choice.refundMinor > 0 && (
                  <p>
                    Your current rental ends and {formatNaira(pending.choice.refundMinor)} of its
                    deposit is refunded to your wallet.
                  </p>
                )}
                {actionError && <p role="alert">{actionError}</p>}
                <div className="property-listings-actions">
                  <button
                    type="button"
                    onClick={() => setPending(null)}
                    disabled={commit.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={commit.isPending}
                    onClick={() => commit.mutate(pending)}
                  >
                    {commit.isPending ? "Confirming…" : "Confirm"}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
