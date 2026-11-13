import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  Bus,
  CheckCircle2,
  Coins,
  Landmark,
  Map as MapIcon,
  MessageCircle,
  Package,
  Scissors,
  ShoppingBag,
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
import { estimateTrip, type TravelMode } from "@/lib/transport-service";
import type {
  InteractableZoneSpec,
  ZoneActionOutcome,
  ZoneNpcSpec,
} from "@/game/neighborhood-interactions";
import type { NeighborhoodInventoryEntry } from "@/store/neighborhoodSlice";

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
  localInventory,
  equippedAccessorySlug,
  currentLocationId,
  npcTip,
  onPerformZoneAction,
  onNpcTipSelect,
  onToggleAccessory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone: InteractableZoneSpec | null;
  npc: ZoneNpcSpec | null;
  pocketBalance: number;
  bankBalance: number;
  needs: Needs;
  localInventory: readonly NeighborhoodInventoryEntry[];
  equippedAccessorySlug: string | null;
  currentLocationId?: string | undefined;
  npcTip: string | null;
  onPerformZoneAction: (zone: InteractableZoneSpec, outcome: ZoneActionOutcome) => void;
  onNpcTipSelect: (npc: ZoneNpcSpec, tipIndex: number) => void;
  onToggleAccessory: (slug: string | null) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<"actions" | "bank" | "market" | "jobs" | "transit">(
    "actions",
  );
  const [tipIndex, setTipIndex] = useState(0);
  const [travelMode, setTravelMode] = useState<TravelMode>("keke");

  const locationsQuery = useQuery({
    ...q.locations(),
    enabled: open && zone?.category === "transit",
  });
  const bankAccountQuery = useQuery({
    ...q.bankAccount(),
    enabled: open && zone?.category === "bank",
    retry: false,
  });

  const bankTransfer = useMutation({
    mutationFn: async (args: { kind: "deposit" | "withdraw"; amount: number }) => {
      if (args.kind === "deposit") return rpc.depositCash(args.amount);
      return rpc.withdrawCash(args.amount);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const transitMutation = useMutation({
    mutationFn: async (args: { locationId: string; mode: TravelMode; name: string }) =>
      rpc.travelToLocation({ locationId: args.locationId, mode: args.mode }),
    onSuccess: async (result, vars) => {
      toast.success(`Arrived at ${vars.name} by ${vars.mode} (₦${result.fare}).`);
      await queryClient.invalidateQueries();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Transit route unavailable.");
    },
  });

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSubTab("actions");
      setTipIndex(0);
    }
    onOpenChange(nextOpen);
  };

  const handleOutcomeClick = (zoneSpec: InteractableZoneSpec, outcome: ZoneActionOutcome) => {
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

    // Attempt server-authoritative bank transfer when bank account exists; always sync slice/cache cleanly.
    if (zoneSpec.category === "bank" && bankAccountQuery.data && outcome.bankDelta) {
      const amt = Math.abs(outcome.bankDelta);
      bankTransfer.mutate(
        { kind: outcome.bankDelta > 0 ? "deposit" : "withdraw", amount: amt },
        {
          onError: () => {
            // Fall back smoothly to local state update in preview mode.
            onPerformZoneAction(zoneSpec, outcome);
          },
          onSuccess: () => {
            toast.success(outcome.toastMessage);
          },
        },
      );
      return;
    }

    onPerformZoneAction(zoneSpec, outcome);
  };

  const transitDestinations = (locationsQuery.data ?? [])
    .filter((loc) => loc.id !== currentLocationId)
    .slice(0, 6);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="neighborhood-zone-modal max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {zone && (
          <>
            <div className="neighborhood-zone-modal-header">
              <div className="neighborhood-zone-modal-badge">
                <CategoryIcon category={zone.category} />
                <span>{zone.zoneTag.replace("_", " ")}</span>
              </div>
              <DialogTitle className="text-xl font-black text-[#14213d]">{zone.title}</DialogTitle>
              <DialogDescription className="text-sm text-[#3e4c63]">
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

            {/* Sub-navigation Tabs when zone integrates Banking, Shop Catalog, Careers, or Transit */}
            <div className="neighborhood-zone-tabs">
              <button
                type="button"
                className={subTab === "actions" ? "is-active" : ""}
                onClick={() => setSubTab("actions")}
              >
                Zone Actions
              </button>
              {zone.category === "bank" && (
                <button
                  type="button"
                  className={subTab === "bank" ? "is-active" : ""}
                  onClick={() => setSubTab("bank")}
                >
                  Full Osun Bank App
                </button>
              )}
              {(zone.category === "market" || zone.id === "zone-mini-mart") && (
                <button
                  type="button"
                  className={subTab === "market" ? "is-active" : ""}
                  onClick={() => setSubTab("market")}
                >
                  Server Shop Catalogue
                </button>
              )}
              {(zone.category === "adire" || zone.category === "filling-station") && (
                <button
                  type="button"
                  className={subTab === "jobs" ? "is-active" : ""}
                  onClick={() => setSubTab("jobs")}
                >
                  Career Shifts
                </button>
              )}
              {zone.category === "transit" && (
                <button
                  type="button"
                  className={subTab === "transit" ? "is-active" : ""}
                  onClick={() => setSubTab("transit")}
                >
                  Osogbo District Routes
                </button>
              )}
            </div>

            {subTab === "actions" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {zone.actions.map((outcome) => {
                    const priceLabel =
                      outcome.walletDelta > 0
                        ? `+${formatNaira(outcome.walletDelta)}`
                        : outcome.walletDelta < 0
                          ? formatNaira(Math.abs(outcome.walletDelta))
                          : "Service";
                    const affordable =
                      (outcome.walletDelta >= 0 ||
                        pocketBalance >= Math.abs(outcome.walletDelta)) &&
                      ((outcome.bankDelta ?? 0) >= 0 ||
                        bankBalance >= Math.abs(outcome.bankDelta ?? 0));

                    return (
                      <button
                        key={outcome.id}
                        type="button"
                        disabled={!affordable || bankTransfer.isPending}
                        onClick={() => handleOutcomeClick(zone, outcome)}
                        className="neighborhood-zone-action-tile"
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <strong className="text-sm font-extrabold text-[#14213d]">
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
                        <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] font-bold text-[#014baa]">
                          {outcome.needDeltas?.hunger ? (
                            <span>
                              {outcome.needDeltas.hunger > 0 ? "+" : ""}
                              {outcome.needDeltas.hunger} Fullness
                            </span>
                          ) : null}
                          {outcome.needDeltas?.energy ? (
                            <span>
                              {outcome.needDeltas.energy > 0 ? "+" : ""}
                              {outcome.needDeltas.energy} Energy
                            </span>
                          ) : null}
                          {outcome.needDeltas?.hygiene ? (
                            <span>
                              {outcome.needDeltas.hygiene > 0 ? "+" : ""}
                              {outcome.needDeltas.hygiene} Hygiene
                            </span>
                          ) : null}
                          {outcome.needDeltas?.fun ? (
                            <span>+{outcome.needDeltas.fun} Mood</span>
                          ) : null}
                          {outcome.needDeltas?.social ? (
                            <span>+{outcome.needDeltas.social} Social</span>
                          ) : null}
                          {outcome.craftItem ? (
                            <span className="text-[#9a5f00]">+ Item: {outcome.craftItem.name}</span>
                          ) : null}
                          {outcome.xpGain ? <span>+{outcome.xpGain} XP</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Local Crafted / Purchased Items Inventory Preview */}
                {localInventory.length > 0 && (
                  <div className="neighborhood-zone-pack-box">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#014baa]">
                        <Package size={14} aria-hidden="true" />
                        Satchel & Zone Crafts ({localInventory.length})
                      </span>
                      <Link to="/inventory" className="text-xs font-bold text-[#014baa] underline">
                        Open Inventory
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {localInventory.slice(0, 6).map((item) => {
                        const isWearable = item.slot === "accessory";
                        const equipped = equippedAccessorySlug === item.slug;
                        return (
                          <div key={item.id} className="neighborhood-zone-item-chip">
                            <ShoppingBag size={12} aria-hidden="true" />
                            <span>
                              {item.name} ×{item.quantity}
                            </span>
                            {isWearable && (
                              <button
                                type="button"
                                onClick={() => onToggleAccessory(equipped ? null : item.slug)}
                                className="ml-1 rounded bg-[#014baa] px-1.5 py-0.5 text-[10px] font-bold text-white"
                              >
                                {equipped ? "Unequip" : "Equip"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {subTab === "bank" && (
              <div className="rounded-xl border border-[#014baa]/15 bg-white/80 p-2">
                <PhoneBankApp />
              </div>
            )}

            {subTab === "market" && (
              <div className="rounded-xl border border-[#014baa]/15 bg-white/80 p-2">
                <MarketPage shopSlug={zone.shopSlug ?? null} />
              </div>
            )}

            {subTab === "jobs" && (
              <div className="rounded-xl border border-[#014baa]/15 bg-white/80 p-2">
                <JobsPage />
              </div>
            )}

            {subTab === "transit" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#014baa]/15 bg-[#f5f2ea] p-3">
                  <div>
                    <strong className="block text-sm text-[#14213d]">Choose Transit Vehicle</strong>
                    <span className="text-xs text-[#4b5970]">
                      Board from Olaiya Right Avenue shoulder bay
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {(["keke", "danfo", "okada"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTravelMode(mode)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold capitalize ${
                          travelMode === mode
                            ? "border-[#014baa] bg-[#014baa] text-white"
                            : "border-[#014baa]/20 bg-white text-[#14213d]"
                        }`}
                      >
                        {mode === "danfo" ? "Korope / Danfo" : mode}
                      </button>
                    ))}
                  </div>
                </div>

                {transitDestinations.length > 0 ? (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {transitDestinations.map((loc) => {
                      const est = estimateTrip(travelMode, 350, 12);
                      return (
                        <button
                          key={loc.id}
                          type="button"
                          disabled={transitMutation.isPending || pocketBalance < est.fare}
                          onClick={() =>
                            transitMutation.mutate({
                              locationId: loc.id,
                              mode: travelMode,
                              name: loc.name,
                            })
                          }
                          className="neighborhood-zone-action-tile"
                        >
                          <div className="flex w-full items-center justify-between">
                            <strong className="text-sm text-[#14213d]">{loc.name}</strong>
                            <span className="neighborhood-zone-price-tag">
                              {formatNaira(est.fare)}
                            </span>
                          </div>
                          <span className="text-xs text-[#4b5970]">
                            ~{est.minutes} min · {loc.type.replace("_", " ")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#014baa]/15 bg-[#f5f2ea] p-4 text-center">
                    <p className="mb-3 text-sm text-[#3e4c63]">
                      Open the interactive Osogbo City Map to board a Keke or Korope to any
                      district.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        handleClose(false);
                        void navigate({ to: "/map" });
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#014baa] px-4 py-2 text-sm font-bold text-white"
                    >
                      <MapIcon size={16} aria-hidden="true" />
                      Open City Transit Map
                    </button>
                  </div>
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
              <DialogTitle className="text-xl font-black text-[#14213d]">{npc.name}</DialogTitle>
              <DialogDescription className="text-sm text-[#3e4c63]">
                Local Olaiya resident · Social score: <strong>{needs.social}%</strong>
              </DialogDescription>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[#014baa]/20 bg-[#f5f2ea] p-4">
                <p className="text-sm font-semibold text-[#14213d]" aria-live="polite">
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
                  <strong className="flex items-center gap-1.5 text-sm text-[#14213d]">
                    <Sparkles size={15} className="text-[#014baa]" aria-hidden="true" />
                    Ask for Local Zone Tip
                  </strong>
                  <span className="text-xs text-[#4b5970]">
                    Hear insider guidance about nearby spots (+10 Social)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNpcTipSelect(npc, tipIndex);
                  }}
                  className="neighborhood-zone-action-tile"
                >
                  <strong className="flex items-center gap-1.5 text-sm text-[#14213d]">
                    <CheckCircle2 size={15} className="text-[#0f766e]" aria-hidden="true" />
                    Share Friendly Banter
                  </strong>
                  <span className="text-xs text-[#4b5970]">
                    Boost your Social & Mood around Olaiya (+10 Social, +4 Mood)
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
