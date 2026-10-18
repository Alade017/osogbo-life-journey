import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, HousePlus, KeyRound, LoaderCircle, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, q } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import "@/components/map/map-ui.css";
import "@/components/game/housing/property-listings.css";

export const Route = createFileRoute("/_authenticated/_game/properties")({
  head: () => pageMeta("Properties", "Find a place to rent in Osogbo Life."),
  component: PropertiesPage,
});

type PropertyListing = {
  propertyId: string;
  houseTypeId: string;
  label: string;
  description: string;
  weeklyRentMinor: number;
  depositWeeks: number;
  priceMinor: number;
  upfrontTotalMinor: number;
  slotCount: number;
  assetKey: string;
  isCurrentHome: boolean;
  available: boolean;
};

type EligibleHouse = {
  id: string;
  eligible: boolean;
  reason: string | null;
  reason_code: string | null;
};

type Eligibility = { houses: EligibleHouse[] };
type Filter = "affordable" | "available" | "current";

async function housingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sign in again to see properties.");
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const reason =
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error &&
      typeof body.error === "object" &&
      "reason" in body.error &&
      typeof body.error.reason === "string"
        ? body.error.reason
        : "The property service is unavailable. Try again.";
    throw new Error(reason);
  }
  return body as T;
}

function rentalReason(
  listing: PropertyListing,
  balance: number | null,
  eligibility: Eligibility | undefined,
  eligibilityLoading: boolean,
  eligibilityError: boolean,
) {
  if (listing.isCurrentHome) return "This is your current home.";
  if (!listing.available) return "You already have an active rental.";
  if (balance === null) return "Your wallet is still loading.";
  if (balance < listing.upfrontTotalMinor)
    return `You need ${formatNaira(listing.upfrontTotalMinor - balance)} more for move-in.`;
  if (eligibilityError) return "Eligibility check failed. Retry it before renting.";
  if (eligibilityLoading || !eligibility) return "Checking your rental eligibility.";
  const house = eligibility.houses.find((item) => item.id === listing.houseTypeId);
  if (!house) return "This home's eligibility could not be confirmed.";
  if (!house.eligible) return house.reason || "You do not meet this home's income requirements.";
  return null;
}

function PropertiesPage() {
  const queryClient = useQueryClient();
  const { data: character } = useQuery(q.character());
  const { data: wallet, isPending: walletLoading } = useQuery(q.wallet());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [rentError, setRentError] = useState("");
  const requestKeys = useRef(new Map<string, string>());
  const propertiesQuery = useQuery({
    queryKey: ["housingProperties", character?.id],
    enabled: !!character?.id,
    staleTime: 15_000,
    queryFn: async () => {
      const result = await housingRequest<unknown>("/api/housing/properties");
      if (!Array.isArray(result)) throw new Error("The property list could not be read.");
      return result as PropertyListing[];
    },
  });
  const eligibilityQuery = useQuery({
    queryKey: ["housingEligibility", character?.id],
    enabled: !!character?.id,
    staleTime: 15_000,
    queryFn: () => housingRequest<Eligibility>("/api/housing/eligible"),
  });
  const listings = propertiesQuery.data ?? [];
  const balance = walletLoading ? null : Number(wallet?.balance ?? 0);
  const visible = listings.filter((listing) => {
    if (filters.includes("affordable") && (balance === null || balance < listing.upfrontTotalMinor))
      return false;
    if (filters.includes("available") && !listing.available) return false;
    if (filters.includes("current") && !listing.isCurrentHome) return false;
    return true;
  });
  const selected = listings.find((listing) => listing.propertyId === selectedId) ?? null;
  const eligibilityLoading = eligibilityQuery.isPending;
  const selectedReason = selected
    ? rentalReason(
        selected,
        balance,
        eligibilityQuery.data,
        eligibilityLoading,
        eligibilityQuery.isError,
      )
    : null;
  const rent = useMutation({
    mutationFn: async (listing: PropertyListing) => {
      const key = requestKeys.current.get(listing.propertyId) ?? crypto.randomUUID();
      requestKeys.current.set(listing.propertyId, key);
      return housingRequest<unknown>("/api/housing/rent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ property_id: listing.propertyId }),
      });
    },
    onSuccess: async (_result, listing) => {
      requestKeys.current.delete(listing.propertyId);
      setRentError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["housingProperties"] }),
        queryClient.invalidateQueries({ queryKey: ["housingEligibility"] }),
        queryClient.invalidateQueries({ queryKey: ["housingHome"] }),
        queryClient.invalidateQueries({ queryKey: ["authoritativeHouseState"] }),
        queryClient.invalidateQueries({ queryKey: q.wallet().queryKey }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
      setSelectedId(null);
      toast.success("Your rental is confirmed. Your new home is ready.");
    },
    onError: (error: Error) => {
      setRentError(error.message);
      void propertiesQuery.refetch();
      void eligibilityQuery.refetch();
    },
  });

  function toggleFilter(filter: Filter) {
    setFilters((current) =>
      current.includes(filter) ? current.filter((value) => value !== filter) : [...current, filter],
    );
  }

  return (
    <div className="property-listings-page">
      <header className="property-listings-hero">
        <p className="map-sheet-eyebrow">FIND YOUR PLACE</p>
        <h1>Properties</h1>
        <p>Browse homes across Osogbo. Rent and move-in costs are confirmed by the server.</p>
        <div className="property-listings-balance">
          <span>Available cash</span>
          <strong>{balance === null ? "Loading…" : formatNaira(balance)}</strong>
        </div>
      </header>

      <section className="property-listings-filter-panel" aria-label="Filter properties">
        <div className="property-listings-filter-title">
          <SlidersHorizontal size={17} aria-hidden="true" />
          <span>Show me</span>
        </div>
        <div className="property-listings-filters">
          {(
            [
              ["affordable", "Affordable now"],
              ["available", "Available"],
              ["current", "My current home"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className="property-filter-chip"
              aria-pressed={filters.includes(value)}
              onClick={() => toggleFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {propertiesQuery.isPending ? (
        <div className="property-listings-message" role="status">
          <LoaderCircle className="property-listings-spinner" size={20} aria-hidden="true" />
          Loading homes…
        </div>
      ) : propertiesQuery.isError ? (
        <div className="property-listings-message" role="alert">
          <p>{propertiesQuery.error.message}</p>
          <button
            className="map-primary-button"
            type="button"
            onClick={() => void propertiesQuery.refetch()}
          >
            Try again
          </button>
        </div>
      ) : visible.length ? (
        <section aria-label="Property listings">
          <div className="property-listings-count">
            <span>
              {visible.length} {visible.length === 1 ? "home" : "homes"}
            </span>
            {filters.length > 0 && (
              <button type="button" onClick={() => setFilters([])}>
                Clear filters
              </button>
            )}
          </div>
          <ul className="property-listings-grid">
            {visible.map((listing) => (
              <li key={listing.propertyId} className="property-listing-card">
                <div className="property-listing-icon">
                  <HousePlus size={24} aria-hidden="true" />
                </div>
                <div className="property-listing-copy">
                  <div className="property-listing-heading">
                    <h2>{listing.label}</h2>
                    {listing.isCurrentHome && (
                      <span className="property-listing-tag">Your home</span>
                    )}
                  </div>
                  <p>{listing.description}</p>
                  <div className="property-listing-meta">
                    <span>
                      {listing.slotCount} furniture {listing.slotCount === 1 ? "slot" : "slots"}
                    </span>
                    <span>
                      {listing.depositWeeks} {listing.depositWeeks === 1 ? "week" : "weeks"} deposit
                    </span>
                  </div>
                </div>
                <div className="property-listing-bottom">
                  <div>
                    <strong>{formatNaira(listing.weeklyRentMinor)}</strong>
                    <span> / week</span>
                    <small>{formatNaira(listing.upfrontTotalMinor)} to move in</small>
                  </div>
                  <button
                    type="button"
                    className="property-listing-open"
                    onClick={() => {
                      setRentError("");
                      setSelectedId(listing.propertyId);
                    }}
                    aria-label={`View ${listing.label}`}
                  >
                    <ArrowRight size={20} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="property-listings-message">
          <p>No homes match these filters.</p>
          <button className="map-primary-button" type="button" onClick={() => setFilters([])}>
            Show all homes
          </button>
        </div>
      )}

      <Dialog.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !rent.isPending) setSelectedId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="property-detail-backdrop" />
          {selected && (
            <Dialog.Content
              className="map-sheet property-detail-sheet"
              aria-describedby="property-detail-description"
            >
              <div className="map-sheet-grabber-static" aria-hidden="true">
                <span />
              </div>
              <div className="map-sheet-header">
                <div>
                  <p className="map-sheet-eyebrow">HOME DETAILS</p>
                  <Dialog.Title>{selected.label}</Dialog.Title>
                </div>
                <Dialog.Close
                  className="map-icon-button"
                  disabled={rent.isPending}
                  aria-label="Close details"
                >
                  <X size={19} aria-hidden="true" />
                </Dialog.Close>
              </div>
              <Dialog.Description id="property-detail-description">
                {selected.description}
              </Dialog.Description>
              <div className="property-detail-prices">
                <div>
                  <span>Weekly rent</span>
                  <strong>{formatNaira(selected.weeklyRentMinor)}</strong>
                </div>
                <div>
                  <span>Deposit ({selected.depositWeeks} weeks)</span>
                  <strong>{formatNaira(selected.weeklyRentMinor * selected.depositWeeks)}</strong>
                </div>
                <div className="property-detail-total">
                  <span>Total to move in</span>
                  <strong>{formatNaira(selected.upfrontTotalMinor)}</strong>
                </div>
              </div>
              <p className="property-detail-slots">
                <KeyRound size={16} aria-hidden="true" /> {selected.slotCount} furniture slots
                included
              </p>
              {selectedReason && (
                <p className="map-age-notice" role="status">
                  {selectedReason}
                </p>
              )}
              {rentError && (
                <p className="map-action-error" role="alert">
                  {rentError}
                </p>
              )}
              {eligibilityQuery.isError && (
                <button
                  type="button"
                  className="property-detail-retry"
                  onClick={() => void eligibilityQuery.refetch()}
                >
                  Retry eligibility check
                </button>
              )}
              <div className="property-detail-actions">
                {selected.isCurrentHome ? (
                  <Link className="map-primary-button" to="/house">
                    Go to my home
                  </Link>
                ) : (
                  <button
                    className="map-primary-button"
                    type="button"
                    disabled={!!selectedReason || rent.isPending}
                    onClick={() => rent.mutate(selected)}
                  >
                    {rent.isPending ? "Confirming rental…" : "Rent this"}
                  </button>
                )}
              </div>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
