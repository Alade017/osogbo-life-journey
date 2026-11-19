import { AdireCraftingPanel } from "./AdireCraftingPanel";
import { NeighborhoodPersonalService } from "./NeighborhoodPersonalService";
import { LocationVenueScene } from "./LocationVenueScene";
import { useMapTravelController } from "@/components/map/use-map-travel-controller";
import { neighborhoodTripEstimate } from "@/game/neighborhood-transit";
import { BUKA_VENUE_DESIGN } from "@/lib/location-venue-designs";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  Bus,
  Coins,
  Landmark,
  Map as MapIcon,
  MessageCircle,
  Scissors,
  Sparkles,
  Utensils,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PhoneBankApp } from "@/components/game/phone/PhoneBankApp";
import { MarketPage } from "@/routes/_authenticated/_game/market";
import { JobsPage } from "@/routes/_authenticated/_game/jobs";
import { formatNaira, q, rpc } from "@/lib/game";
import type { Needs } from "@/lib/life-simulation";
import { TRAVEL_MODE_DETAILS, type TravelMode } from "@/lib/transport-service";
import {
  isServerBackedBankTransfer,
  type InteractableZoneSpec,
  type ZoneActionOutcome,
  type ZoneNpcSpec,
  type ZoneService,
} from "@/game/neighborhood-interactions";

function serviceLabel(service: ZoneService, foodOnly: boolean) {
  return {
    craft: "Adire crafting",
    barber: "Hair styling",
    pos: "POS withdrawal",
    bank: "Bank services",
    market: foodOnly ? "Food & drinks" : "Shop catalogue",
    jobs: "Career shifts",
    transit: "District routes",
    interior: "Explore Buka",
  }[service];
}
function serviceDescription(service: ZoneService) {
  return {
    craft: "Use owned materials and collect a finished Adire piece",
    barber: "Choose and save a new hairstyle",
    pos: "Withdraw cash with a clear fee breakdown",
    bank: "Account, deposits and withdrawals",
    market: "Browse current offers and buy into your inventory",
    jobs: "View available jobs and start a confirmed shift",
    transit: "Choose a destination and confirm your fare",
    interior: "Look around the kitchen and dining area",
  }[service];
}

function CategoryIcon({ category }: { category: InteractableZoneSpec["category"] }) {
  switch (category) {
    case "filling-station":
      return <Coins size={18} aria-hidden="true" />;
    case "bank":
      return <Landmark size={18} aria-hidden="true" />;
    case "adire":
      return <Sparkles size={18} aria-hidden="true" />;
    case "market":
      return <Utensils size={18} aria-hidden="true" />;
    case "shops":
      return <Scissors size={18} aria-hidden="true" />;
    case "transit":
      return <Bus size={18} aria-hidden="true" />;
    default:
      return <MessageCircle size={18} aria-hidden="true" />;
  }
}

export function NeighborhoodZoneModal({
  open,
  onOpenChange,
  zone,
  npc,
  pocketBalance,
  bankBalance,
  needs,
  currentLocationId,
  currentLocationSlug,
  npcTip,
  onNpcTipSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone: InteractableZoneSpec | null;
  npc: ZoneNpcSpec | null;
  pocketBalance: number;
  bankBalance: number;
  needs: Needs;
  currentLocationId?: string | undefined;
  currentLocationSlug?: string | undefined;
  npcTip: string | null;
  onNpcTipSelect: (npc: ZoneNpcSpec, tipIndex: number) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<"actions" | ZoneService>("actions");
  const [tipIndex, setTipIndex] = useState(0);
  const [travelMode, setTravelMode] = useState<TravelMode>("keke");
  const bankLock = useRef(false);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [bankNeedsRefresh, setBankNeedsRefresh] = useState(false);
  const characterQuery = useQuery({
    ...q.character(),
    enabled: open && zone?.category === "transit",
  });

  useEffect(() => {
    setSubTab("actions");
    setTipIndex(0);
  }, [zone?.id, npc?.id]);

  const locationsQuery = useQuery({
    ...q.locations(),
    enabled: open && zone?.category === "transit",
  });
  const bankAccountQuery = useQuery({
    ...q.bankAccount(),
    enabled: open && zone?.category === "bank",
    retry: false,
  });

  const transit = useMapTravelController<NonNullable<typeof locationsQuery.data>[number]>({
    character: characterQuery.data,
    queryClient,
    navigate,
  });
  const services = zone?.services ?? [];
  const bankTransfer = useMutation({
    retry: false,
    mutationFn: async (args: { kind: "deposit" | "withdraw"; amount: number }) => {
      if (args.kind === "deposit") return rpc.depositCash(args.amount);
      return rpc.withdrawCash(args.amount);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: q.wallet().queryKey }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: q.bankAccount().queryKey }),
      ]);
    },
    onError: (error) => {
      setBankNeedsRefresh(true);
      toast.error(
        `${error instanceof Error ? error.message : "Transfer could not be confirmed."} Refresh your account before another transfer; no automatic retry was made.`,
      );
    },
    onSettled: () => {
      bankLock.current = false;
    },
  });
  const refreshBank = useMutation({
    mutationFn: async () =>
      Promise.all([
        queryClient.fetchQuery({ ...q.wallet(), staleTime: 0 }),
        queryClient.fetchQuery({ ...q.transactions(), staleTime: 0 }),
        bankAccountQuery.refetch({ throwOnError: true }),
      ]),
    onSuccess: () => setBankNeedsRefresh(false),
    onError: () => toast.error("Your account could not be refreshed. Check your connection."),
  });
  const handleClose = (nextOpen: boolean) => {
    if (
      !nextOpen &&
      (serviceBusy || bankLock.current || bankTransfer.isPending || !transit.canDismiss)
    )
      return;
    if (!nextOpen) {
      setSubTab("actions");
      setTipIndex(0);
      transit.close();
    }
    onOpenChange(nextOpen);
  };
  useEffect(() => {
    if (open && transit.state.phase === "arrived") onOpenChange(false);
  }, [open, transit.state.phase, onOpenChange]);

  const handleOutcomeClick = (zoneSpec: InteractableZoneSpec, outcome: ZoneActionOutcome) => {
    if (bankLock.current || bankNeedsRefresh) return;
    if (!isServerBackedBankTransfer(zoneSpec, outcome) || !bankAccountQuery.data) {
      toast.error("This activity is not connected to a server-authoritative action yet.");
      return;
    }
    if (outcome.walletDelta < 0 && pocketBalance < Math.abs(outcome.walletDelta)) {
      toast.error(
        `You need ${formatNaira(Math.abs(outcome.walletDelta))} pocket cash. Withdraw from the Bank or ATM first.`,
      );
      return;
    }
    if ((outcome.bankDelta ?? 0) < 0 && bankBalance < Math.abs(outcome.bankDelta ?? 0)) {
      toast.error("Insufficient bank savings for that withdrawal.");
      return;
    }

    const bankDelta = outcome.bankDelta ?? 0;
    const amount = Math.abs(bankDelta);
    bankLock.current = true;
    bankTransfer.mutate(
      { kind: bankDelta > 0 ? "deposit" : "withdraw", amount },
      {
        onSuccess: () => toast.success(outcome.toastMessage),
      },
    );
  };

  const transitDestinations = (locationsQuery.data ?? []).filter(
    (loc) => loc.is_active && loc.id !== currentLocationId,
  );
  const selectedTrip = transit.state.landmark;
  const selectedEstimate = selectedTrip
    ? neighborhoodTripEstimate(selectedTrip, currentLocationId, travelMode)
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        data-locked={serviceBusy || bankTransfer.isPending || !transit.canDismiss}
        className={`neighborhood-zone-modal ${subTab === "actions" ? "is-compact" : "is-service"} max-h-[90vh] overflow-y-auto sm:max-w-3xl`}
      >
        {zone && (
          <>
            <div className="neighborhood-zone-modal-header">
              <div className="neighborhood-zone-modal-badge">
                <CategoryIcon category={zone.category} />
                <span>{zone.zoneTag.replace("_", " ")}</span>
              </div>
              <DialogTitle className="text-xl font-black text-[#16225C]">{zone.title}</DialogTitle>
              <DialogDescription className="text-sm text-[#3a4668]">
                {zone.subtitle}
              </DialogDescription>

              {/* Wallet & Need Summary Bar */}
              <div className="neighborhood-zone-stats-bar">
                <div className="neighborhood-zone-stat-pill">
                  <Wallet size={14} aria-hidden="true" />
                  <span>Pocket</span>
                  <strong>{formatNaira(pocketBalance)}</strong>
                </div>
                <div className="neighborhood-zone-stat-pill">
                  <Landmark size={14} aria-hidden="true" />
                  <span>Savings</span>
                  <strong>{formatNaira(bankBalance)}</strong>
                </div>
                <div className="neighborhood-zone-stat-pill">
                  <Utensils size={14} aria-hidden="true" />
                  <span>Fullness</span>
                  <strong>{needs.hunger}%</strong>
                </div>
                <div className="neighborhood-zone-stat-pill">
                  <Sparkles size={14} aria-hidden="true" />
                  <span>Hygiene</span>
                  <strong>{needs.hygiene}%</strong>
                </div>
                <div className="neighborhood-zone-stat-pill">
                  <Briefcase size={14} aria-hidden="true" />
                  <span>Energy</span>
                  <strong>{needs.energy}%</strong>
                </div>
              </div>
            </div>

            <div className="neighborhood-zone-tabs" role="group" aria-label="Local services">
              <button
                type="button"
                className={subTab === "actions" ? "is-active" : ""}
                aria-pressed={subTab === "actions"}
                disabled={
                  serviceBusy || bankTransfer.isPending || transit.busy || transit.arrivalConfirmed
                }
                onClick={() => setSubTab("actions")}
              >
                Overview
              </button>
              {services.map((service) => (
                <button
                  key={service}
                  type="button"
                  className={subTab === service ? "is-active" : ""}
                  aria-pressed={subTab === service}
                  disabled={
                    serviceBusy ||
                    bankTransfer.isPending ||
                    transit.busy ||
                    transit.arrivalConfirmed
                  }
                  onClick={() => setSubTab(service)}
                >
                  {serviceLabel(service, !!zone.foodOnly)}
                </button>
              ))}
            </div>

            {subTab === "interior" &&
              zone.venueInterior === "buka" &&
              (currentLocationSlug ? (
                <LocationVenueScene
                  slug={currentLocationSlug}
                  locationName={zone.title}
                  design={BUKA_VENUE_DESIGN}
                  {...(zone.shopSlug !== undefined ? { shopSlug: zone.shopSlug } : {})}
                />
              ) : (
                <p role="status">Loading your location…</p>
              ))}
            {subTab === "actions" && (
              <div className="space-y-4">
                {services.length > 0 && (
                  <div className="neighborhood-zone-service-cards">
                    {services.map((service) => (
                      <button
                        key={service}
                        type="button"
                        className="neighborhood-zone-action-tile"
                        disabled={
                          bankTransfer.isPending || transit.busy || transit.arrivalConfirmed
                        }
                        onClick={() => setSubTab(service)}
                      >
                        <strong>{serviceLabel(service, !!zone.foodOnly)}</strong>
                        <span className="text-xs text-muted-foreground">
                          {serviceDescription(service)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {bankNeedsRefresh && (
                  <div role="alert">
                    <p>Refresh your account and history before making another transfer.</p>
                    <button
                      type="button"
                      className="neighborhood-zone-action-tile"
                      disabled={refreshBank.isPending}
                      onClick={() => refreshBank.mutate()}
                    >
                      Refresh account
                    </button>
                  </div>
                )}
                {zone.actions.some((outcome) => isServerBackedBankTransfer(zone, outcome)) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {zone.actions
                      .filter((outcome) => isServerBackedBankTransfer(zone, outcome))
                      .map((outcome) => {
                        const priceLabel =
                          outcome.walletDelta > 0
                            ? `+${formatNaira(outcome.walletDelta)}`
                            : formatNaira(Math.abs(outcome.walletDelta));
                        const affordable =
                          (outcome.walletDelta >= 0 ||
                            pocketBalance >= Math.abs(outcome.walletDelta)) &&
                          ((outcome.bankDelta ?? 0) >= 0 ||
                            bankBalance >= Math.abs(outcome.bankDelta ?? 0));

                        return (
                          <button
                            key={outcome.id}
                            type="button"
                            aria-busy={bankTransfer.isPending}
                            disabled={
                              !bankAccountQuery.data ||
                              !affordable ||
                              bankTransfer.isPending ||
                              bankNeedsRefresh
                            }
                            onClick={() => handleOutcomeClick(zone, outcome)}
                            className="neighborhood-zone-action-tile"
                          >
                            <div className="flex w-full items-start justify-between gap-2">
                              <strong className="text-sm font-extrabold text-[#16225C]">
                                {outcome.label}
                              </strong>
                              <span
                                className={`neighborhood-zone-price-tag${
                                  outcome.walletDelta > 0 ? " is-earn" : ""
                                }`}
                              >
                                {priceLabel}
                              </span>
                            </div>
                            <p className="text-xs text-[#4b5970]">{outcome.description}</p>
                            {!bankAccountQuery.data && (
                              <span className="text-xs text-muted-foreground">
                                Open a bank account to use
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                )}
                {zone.actions.some((outcome) => !isServerBackedBankTransfer(zone, outcome)) && (
                  <details className="neighborhood-zone-upcoming">
                    <summary>Activities coming later</summary>
                    <p>
                      These activities are not available yet.
                      {services.length > 0
                        ? " Use the services above for confirmed purchases, shifts or travel."
                        : " This spot does not have a playable service yet."}
                    </p>
                    <ul>
                      {zone.actions
                        .filter((outcome) => !isServerBackedBankTransfer(zone, outcome))
                        .map((outcome) => (
                          <li key={outcome.id}>{outcome.label}</li>
                        ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {subTab === "craft" && (
              <AdireCraftingPanel
                key={zone.id}
                zoneId={zone.id}
                onBusyChange={setServiceBusy}
                onBuyMaterials={() => setSubTab("market")}
              />
            )}
            {(subTab === "barber" || subTab === "pos") && (
              <NeighborhoodPersonalService
                key={zone.id}
                zoneId={zone.id}
                kind={subTab}
                onBusyChange={setServiceBusy}
              />
            )}

            {subTab === "bank" && (
              <div className="rounded-xl border border-[#16225C]/15 bg-white/85 p-2">
                <PhoneBankApp />
              </div>
            )}

            {subTab === "market" && (
              <div className="rounded-xl border border-[#16225C]/15 bg-white/85 p-2">
                <MarketPage
                  {...(zone.shopSlug != null ? { shopSlug: zone.shopSlug } : {})}
                  foodOnly={zone.foodOnly ?? false}
                />
              </div>
            )}

            {subTab === "jobs" && (
              <div className="rounded-xl border border-[#16225C]/15 bg-white/85 p-2">
                <JobsPage />
              </div>
            )}

            {subTab === "transit" && (
              <div className="space-y-3">
                <div role="group" aria-label="Transport mode" className="neighborhood-zone-tabs">
                  {(["walking", "keke", "danfo", "okada"] as const).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      aria-pressed={travelMode === mode}
                      disabled={transit.busy || transit.arrivalConfirmed}
                      onClick={() => setTravelMode(mode)}
                    >
                      {TRAVEL_MODE_DETAILS[mode].label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Estimates use each destination's route settings. The server confirms the final
                  fare and arrival.
                </p>
                {locationsQuery.isPending && <p role="status">Loading routes…</p>}
                {locationsQuery.isError && (
                  <div role="alert">
                    Routes could not load.{" "}
                    <button type="button" onClick={() => void locationsQuery.refetch()}>
                      Retry routes
                    </button>
                  </div>
                )}
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {transitDestinations.map((loc) => {
                    const estimate = neighborhoodTripEstimate(loc, currentLocationId, travelMode);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        className="neighborhood-zone-action-tile"
                        aria-pressed={selectedTrip?.id === loc.id}
                        disabled={!estimate || transit.busy || transit.arrivalConfirmed}
                        onClick={() => transit.select(loc)}
                      >
                        <strong>{loc.name}</strong>
                        <span>
                          {estimate
                            ? `${formatNaira(estimate.fare)} · ~${estimate.minutes} min`
                            : "Mode unavailable"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedTrip && (
                  <div className="neighborhood-zone-trip-confirm" aria-live="polite">
                    <strong>{selectedTrip.name}</strong>
                    <p>
                      {selectedEstimate
                        ? `${TRAVEL_MODE_DETAILS[travelMode].label} · ${formatNaira(selectedEstimate.fare)} estimated`
                        : "Choose an available transport mode."}
                    </p>
                    {transit.state.error && <p role="alert">{transit.state.error}</p>}
                    {transit.arrivalConfirmed ? (
                      <button
                        type="button"
                        className="neighborhood-zone-action-tile"
                        disabled={transit.busy}
                        onClick={() => void transit.retryArrival()}
                      >
                        Retry destination loading
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="neighborhood-zone-action-tile"
                        disabled={
                          !selectedEstimate ||
                          pocketBalance < selectedEstimate.fare ||
                          transit.busy ||
                          !characterQuery.data
                        }
                        onClick={() => void transit.confirm(selectedTrip.id, travelMode)}
                      >
                        {transit.busy ? "Confirming trip…" : "Confirm trip"}
                      </button>
                    )}
                    {selectedEstimate && pocketBalance < selectedEstimate.fare && (
                      <p>Not enough pocket cash. Choose a cheaper option or walk.</p>
                    )}
                  </div>
                )}
                {!transit.busy && !transit.arrivalConfirmed && (
                  <button
                    type="button"
                    className="neighborhood-zone-action-tile"
                    onClick={() => {
                      handleClose(false);
                      void navigate({ to: "/map" });
                    }}
                  >
                    <MapIcon size={16} aria-hidden="true" /> Open city map
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {npc && !zone && (
          <>
            <div className="neighborhood-zone-modal-header">
              <div className="neighborhood-zone-modal-badge">
                <MessageCircle size={16} aria-hidden="true" />
                <span>{npc.role}</span>
              </div>
              <DialogTitle className="text-xl font-black text-[#16225C]">{npc.name}</DialogTitle>
              <DialogDescription className="text-sm text-[#3a4668]">
                Local Olaiya resident · Conversation tips
              </DialogDescription>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[#16225C]/20 bg-[#f5f2ea] p-4">
                <p className="text-sm font-semibold text-[#16225C]" aria-live="polite">
                  “{npcTip ?? npc.greeting}”
                </p>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = (tipIndex + 1) % npc.tips.length;
                    setTipIndex(nextIdx);
                    onNpcTipSelect(npc, nextIdx);
                  }}
                  className="neighborhood-zone-action-tile"
                >
                  <strong className="flex items-center gap-1.5 text-sm text-[#16225C]">
                    <Sparkles size={15} className="text-[#F2B21C]" aria-hidden="true" />
                    Ask for Local Zone Tip
                  </strong>
                  <span className="text-xs text-[#4b5970]">
                    Hear informational guidance about nearby spots
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = (tipIndex + 1) % npc.tips.length;
                    setTipIndex(nextIdx);
                    onNpcTipSelect(npc, nextIdx);
                  }}
                  className="neighborhood-zone-action-tile"
                >
                  <strong className="flex items-center gap-1.5 text-sm text-[#16225C]">
                    <MessageCircle size={15} aria-hidden="true" />
                    Hear another local tip
                  </strong>
                  <span className="text-xs text-[#4b5970]">
                    Browse another piece of local information. No relationship reward is granted.
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
