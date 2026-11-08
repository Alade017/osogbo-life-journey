import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, ShoppingBag, Sparkles, Check, Package, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
import { purchaseTotal, shopIsOpen } from "@/lib/economy-service";
import { useWorldClock } from "@/hooks/use-world-clock";
import { StallIncomePanel } from "@/components/game/StallIncomePanel";
import { stallIncomeKey } from "@/lib/stall-income-service";
import { PublicStallDirectory } from "./PublicStallDirectory";
import {
  getMarketStallRentStatus,
  getMyPlayerStall,
  getMyStallStock,
  manageMyStallStock,
  payMarketStallRent,
  rentMarketStall,
  saveMyPlayerStall,
  STALL_CATEGORY_OPTIONS,
  type StallCategory,
} from "@/lib/market-stall-service";
import { PaletteSelect } from "@/components/ui/palette-select";

const THEMES = [
  { id: "indigo", label: "Adire Indigo", color: "#1e3a8a", border: "#3b82f6" },
  { id: "gold", label: "Osun Gold", color: "#854d0e", border: "#eab308" },
  { id: "green", label: "Grove Green", color: "#14532d", border: "#22c55e" },
  { id: "terracotta", label: "Warm Terracotta", color: "#7c2d12", border: "#f97316" },
];

export function PhoneMarketApp() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"stalls" | "shops" | "players">("stalls");
  const { data: character } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const { data: inventory } = useQuery(q.inventory());
  const { data: shopItems, isLoading: shopsLoading } = useQuery(q.shopItems());
  const { data: locations } = useQuery(q.locations());
  const { data: worldTime } = useWorldClock();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const stallQuery = useQuery({
    queryKey: ["playerStall", character?.id],
    enabled: !!character?.id,
    queryFn: () => getMyPlayerStall(character!.id),
  });
  const rentQuery = useQuery({
    queryKey: ["marketStallRent", character?.id],
    enabled: !!character?.id,
    queryFn: getMarketStallRentStatus,
    retry: false,
  });
  const activeLease = rentQuery.data?.status === "current";
  const stockQuery = useQuery({
    queryKey: ["myStallStock", character?.id],
    enabled: !!character?.id && activeLease,
    queryFn: getMyStallStock,
    retry: false,
  });
  const npcStalls = useQuery({
    queryKey: ["npcMarketStalls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("npc_market_stalls")
        .select("id,name,goods,status,visitor_count");
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        name: string;
        goods: string;
        status: string;
        visitor_count: number;
      }[];
    },
  });

  const [stallName, setStallName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<StallCategory>(
    STALL_CATEGORY_OPTIONS[0]?.id ?? "fabrics",
  );
  const [selectedTheme, setSelectedTheme] = useState("indigo");
  const [stallOpen, setStallOpen] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);

  if (stallQuery.data && !formInitialized) {
    setStallName(stallQuery.data.name);
    setSelectedCategory(
      STALL_CATEGORY_OPTIONS.find((option) => option.id === stallQuery.data?.stall_category)?.id ??
        "fabrics",
    );
    setStallOpen(stallQuery.data.is_open);
    setFormInitialized(true);
  }

  const invalidateStallState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["playerStall", character?.id] }),
      queryClient.invalidateQueries({ queryKey: ["marketStallRent", character?.id] }),
      queryClient.invalidateQueries({ queryKey: ["myStallStock", character?.id] }),
      queryClient.invalidateQueries({ queryKey: ["ownedStalls", character?.id] }),
      queryClient.invalidateQueries({ queryKey: ["publicPlayerStalls"] }),
      queryClient.invalidateQueries({ queryKey: q.wallet().queryKey }),
      queryClient.invalidateQueries({ queryKey: q.inventory().queryKey }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    ]);
    if (character?.user_id)
      await queryClient.invalidateQueries({ queryKey: stallIncomeKey(character.user_id) });
  };
  const rentMutation = useMutation({
    mutationFn: () => rentMarketStall(),
    onSuccess: async () => {
      await invalidateStallState();
      toast.success("You rented an Oja-Oba stall for one week.");
    },
    onError: (error: Error) => toast.error(error.message.replaceAll("_", " ")),
  });
  const payRentMutation = useMutation({
    mutationFn: () => payMarketStallRent(),
    onSuccess: async () => {
      await invalidateStallState();
      toast.success("Your Oja-Oba stall rent is current. Reopen it when you are ready.");
    },
    onError: (error: Error) => toast.error(error.message.replaceAll("_", " ")),
  });
  const saveStallMutation = useMutation({
    mutationFn: async () => {
      if (!character?.id) throw new Error("Character not loaded");
      const name = stallName.trim() || `${character.name}'s Oja-Oba Stall`;
      return saveMyPlayerStall({
        name,
        category: selectedCategory,
        isOpen: stallOpen,
      });
    },
    onSuccess: async () => {
      await invalidateStallState();
      toast.success(stallOpen ? "Stall is now open at Oja-Oba Market." : "Stall details saved.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update stall");
    },
  });
  const stockMutation = useMutation({
    mutationFn: manageMyStallStock,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["myStallStock", character?.id] }),
        queryClient.invalidateQueries({ queryKey: q.inventory().queryKey }),
      ]);
      toast.success("Stall stock updated.");
    },
    onError: (error: Error) => toast.error(error.message.replaceAll("_", " ")),
  });

  // Shop purchase and sell
  const purchase = useGameAction(rpc.purchaseShopItem, {
    onSuccess: () => toast.success("Item purchased successfully."),
  });
  const sell = useGameAction(rpc.sellInventoryItem, {
    onSuccess: () => toast.success("Item sold. Cash added to your wallet."),
  });

  const currentLocation = locations?.find((loc) => loc.id === character?.current_location_id);
  const currentShops = useMemo(
    () =>
      shopItems?.filter(
        (offer) =>
          !!offer.shop &&
          (!currentLocation || offer.shop.location_id === currentLocation.id) &&
          shopIsOpen(
            offer.shop.is_open,
            offer.shop.opening_hour,
            offer.shop.closing_hour,
            worldTime?.hour ?? 12,
          ),
      ) ?? [],
    [shopItems, currentLocation, worldTime?.hour],
  );

  return (
    <div className="phone-sub-app" role="region" aria-label="Market and Stall Rental">
      <div className="phone-sub-header">
        <div className="phone-segmented-tabs">
          <button
            type="button"
            className={tab === "stalls" ? "is-active" : ""}
            onClick={() => setTab("stalls")}
          >
            <Store className="h-4 w-4" aria-hidden="true" />
            <span>My Stall</span>
          </button>
          <button
            type="button"
            className={tab === "shops" ? "is-active" : ""}
            onClick={() => setTab("shops")}
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            <span>City Shops</span>
          </button>
          <button
            type="button"
            className={tab === "players" ? "is-active" : ""}
            onClick={() => setTab("players")}
          >
            <Store className="h-4 w-4" aria-hidden="true" />
            <span>Player stalls</span>
          </button>
        </div>
      </div>

      <div className="phone-sub-content">
        {tab === "players" ? (
          character?.user_id ? (
            <PublicStallDirectory key={character.user_id} accountId={character.user_id} />
          ) : (
            <p role="status" className="p-3">
              Sign in and load your character to browse player stalls.
            </p>
          )
        ) : tab === "stalls" ? (
          <div className="space-y-4 p-3">
            <section className="phone-card space-y-3 p-3" aria-label="Market stall rent">
              <div>
                <h3 className="text-sm font-bold">Oja-Oba Stall Lease</h3>
                <p className="text-xs text-muted-foreground">
                  Rent is paid weekly. An overdue stall closes until rent is current and you reopen
                  it.
                </p>
              </div>
              {rentQuery.isPending && <p role="status">Checking your stall lease…</p>}
              {rentQuery.isError && (
                <div role="alert" className="space-y-2">
                  <p>{rentQuery.error.message}</p>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => void rentQuery.refetch()}
                  >
                    Try again
                  </button>
                </div>
              )}
              {rentQuery.data === null && !rentQuery.isPending && !rentQuery.isError && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold">First week: {formatNaira(2000)}</p>
                  <button
                    type="button"
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                    disabled={rentMutation.isPending || !character}
                    onClick={() => rentMutation.mutate()}
                  >
                    {rentMutation.isPending ? "Renting…" : "Rent a stall"}
                  </button>
                </div>
              )}
              {rentQuery.data && (
                <div className="space-y-2">
                  <p className="text-xs">
                    <strong>{formatNaira(rentQuery.data.weeklyRentMinor)} per week</strong>
                    {" · "}
                    <span className="capitalize">{rentQuery.data.status}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Due{" "}
                    {new Intl.DateTimeFormat("en-NG", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Africa/Lagos",
                    }).format(new Date(rentQuery.data.dueAt))}
                    {" (Lagos)"}
                  </p>
                  {rentQuery.data.status !== "current" && (
                    <div className="space-y-2">
                      <p role="status" className="text-xs">
                        Your stall is closed while rent is overdue. Pay now or use the rent relief
                        options on Property.
                      </p>
                      <button
                        type="button"
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                        disabled={payRentMutation.isPending}
                        onClick={() => payRentMutation.mutate()}
                      >
                        {payRentMutation.isPending ? "Paying…" : "Pay overdue rent"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
            {/* Player's Stall Builder Card */}
            <div className="phone-card">
              <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <span className="phone-app-icon-badge phone-app-green">
                    <Store className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm">Your Oja-Oba Market Stall</h3>
                    <p className="text-xs text-muted-foreground">Manage your town stall</p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    stallOpen
                      ? "bg-emerald-500/20 text-emerald-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {stallOpen ? "● Open" : "○ Closed"}
                </span>
              </div>

              {/* Stall Live Preview */}
              <div
                className="my-3 p-3 rounded-xl text-white transition-all"
                style={{
                  backgroundColor: THEMES.find((t) => t.id === selectedTheme)?.color ?? "#1e3a8a",
                  borderColor: THEMES.find((t) => t.id === selectedTheme)?.border ?? "#3b82f6",
                  borderWidth: 2,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider uppercase opacity-80">
                    Oja-Oba Stall
                  </span>
                  <span className="text-xs flex items-center gap-1 opacity-90">
                    <TrendingUp className="h-3 w-3" />
                    {stallOpen ? "Receiving Shoppers" : "Standby"}
                  </span>
                </div>
                <h4 className="text-lg font-black mt-1">
                  {stallName.trim() || `${character?.name ?? "Your"}'s Market Stall`}
                </h4>
                <p className="text-xs opacity-90 mt-0.5">{selectedCategory}</p>
                <div className="mt-3 pt-2 border-t border-white/20 flex justify-between text-xs font-medium">
                  <span>Saved town stall</span>
                  <span>{stallOpen ? "Open to visitors" : "Closed"}</span>
                </div>
              </div>

              {/* Stall Form Controls */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold block mb-1">Stall Name</label>
                  <input
                    type="text"
                    value={stallName}
                    placeholder={`${character?.name ?? "My"}'s Corner Store`}
                    onChange={(e) => setStallName(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                    maxLength={50}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1">Goods or Service Category</label>
                  <PaletteSelect
                    value={selectedCategory}
                    disabled={!activeLease}
                    onValueChange={(next) => {
                      const category = STALL_CATEGORY_OPTIONS.find((option) => option.id === next);
                      if (category) setSelectedCategory(category.id);
                    }}
                    options={STALL_CATEGORY_OPTIONS.map((cat) => ({
                      value: cat.id,
                      label: `${cat.label} (${cat.desc})`,
                    }))}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1">Canopy colour preview</label>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Preview on this phone; your stall name, goods and open status are saved.
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {THEMES.map((theme) => (
                      <button
                        type="button"
                        key={theme.id}
                        onClick={() => setSelectedTheme(theme.id)}
                        className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all text-center ${
                          selectedTheme === theme.id
                            ? "ring-2 ring-primary border-primary"
                            : "border-border"
                        }`}
                        style={{ backgroundColor: `${theme.color}25` }}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs font-bold block">Open for Customers</span>
                    <span className="text-[11px] text-muted-foreground">
                      Show your stall as open in town
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!activeLease}
                    onClick={() => setStallOpen((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      stallOpen
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                  >
                    {stallOpen ? "Stall is Open" : "Stall is Closed"}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!activeLease || saveStallMutation.isPending}
                  onClick={() => saveStallMutation.mutate()}
                  className="w-full py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {saveStallMutation.isPending ? "Saving stall..." : "Save stall details"}
                </button>
                {!activeLease && (
                  <p role="status" className="text-xs text-muted-foreground">
                    Rent a current stall before saving or opening your stall.
                  </p>
                )}
              </div>
            </div>

            {character?.user_id && (
              <StallIncomePanel key={character.user_id} userId={character.user_id} />
            )}
            {activeLease && (
              <section className="phone-card space-y-3 p-3" aria-label="My stall stock">
                <div>
                  <h3 className="text-sm font-bold">Manage stock</h3>
                  <p className="text-xs text-muted-foreground">
                    Stock comes from your inventory. Prices must stay between the shop buy price and
                    five times that reference price.
                  </p>
                </div>
                {stockQuery.isPending && <p role="status">Loading your stock…</p>}
                {stockQuery.isError && (
                  <div role="alert">
                    <p>Your stall stock could not be loaded.</p>
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() => void stockQuery.refetch()}
                    >
                      Try again
                    </button>
                  </div>
                )}
                {stockQuery.data?.map((item) => {
                  const quantity = quantities[`${item.id}:stock`] ?? item.quantity;
                  const price = quantities[`${item.id}:price`] ?? item.priceMinor;
                  return (
                    <div
                      className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t pt-2"
                      key={item.id}
                    >
                      <div className="min-w-0">
                        <strong className="block text-xs">{item.name}</strong>
                        <span className="text-[11px] text-muted-foreground">
                          {item.quantity} listed · {formatNaira(item.priceMinor)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          aria-label={`Listed quantity for ${item.name}`}
                          type="number"
                          min={0}
                          max={999}
                          value={quantity}
                          onChange={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [`${item.id}:stock`]: Math.max(
                                0,
                                Math.min(999, Number(event.target.value)),
                              ),
                            }))
                          }
                          className="w-14 rounded border bg-background px-2 py-1 text-xs"
                        />
                        <input
                          aria-label={`Listed price for ${item.name}`}
                          type="number"
                          min={item.referenceBuyPrice}
                          max={item.referenceBuyPrice * 5}
                          value={price}
                          onChange={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [`${item.id}:price`]: Math.max(
                                item.referenceBuyPrice,
                                Math.min(item.referenceBuyPrice * 5, Number(event.target.value)),
                              ),
                            }))
                          }
                          className="w-20 rounded border bg-background px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-[11px]"
                          disabled={stockMutation.isPending}
                          onClick={() =>
                            stockMutation.mutate({
                              action: "set_price",
                              itemId: item.id,
                              priceMinor: price,
                            })
                          }
                        >
                          Save price
                        </button>
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-[11px]"
                          disabled={stockMutation.isPending}
                          onClick={() =>
                            stockMutation.mutate({
                              action: "set_quantity",
                              itemId: item.id,
                              quantity,
                            })
                          }
                        >
                          Set quantity
                        </button>
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-[11px]"
                          disabled={stockMutation.isPending}
                          onClick={() =>
                            stockMutation.mutate({ action: "remove", itemId: item.id })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
                {inventory
                  ?.filter((entry) => entry.item?.sellable && entry.item.buy_price > 0)
                  .map((entry) => {
                    const quantity = quantities[entry.item_id] ?? 1;
                    const price = quantities[`${entry.item_id}:price`] ?? entry.item.buy_price * 2;
                    return (
                      <div
                        className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t pt-2"
                        key={entry.id}
                      >
                        <div className="min-w-0">
                          <strong className="block text-xs">{entry.item.name}</strong>
                          <span className="text-[11px] text-muted-foreground">
                            {entry.quantity} in bag · reference {formatNaira(entry.item.buy_price)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            aria-label={`Quantity to stock for ${entry.item.name}`}
                            type="number"
                            min={1}
                            max={entry.quantity}
                            value={quantity}
                            onChange={(event) =>
                              setQuantities((current) => ({
                                ...current,
                                [entry.item_id]: Math.max(
                                  1,
                                  Math.min(entry.quantity, Number(event.target.value)),
                                ),
                              }))
                            }
                            className="w-14 rounded border bg-background px-2 py-1 text-xs"
                          />
                          <input
                            aria-label={`Price for ${entry.item.name}`}
                            type="number"
                            min={entry.item.buy_price}
                            max={entry.item.buy_price * 5}
                            value={price}
                            onChange={(event) =>
                              setQuantities((current) => ({
                                ...current,
                                [`${entry.item_id}:price`]: Math.max(
                                  entry.item.buy_price,
                                  Math.min(entry.item.buy_price * 5, Number(event.target.value)),
                                ),
                              }))
                            }
                            className="w-20 rounded border bg-background px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                            disabled={stockMutation.isPending || quantity > entry.quantity}
                            onClick={() =>
                              stockMutation.mutate({
                                action: "add",
                                itemId: entry.item_id,
                                quantity,
                                priceMinor: price,
                              })
                            }
                          >
                            Stock
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {!inventory?.some((entry) => entry.item?.sellable && entry.item.buy_price > 0) &&
                  !stockQuery.data?.length &&
                  !stockQuery.isPending && (
                    <p role="status" className="text-xs text-muted-foreground">
                      Carry sellable items to add them to your stall.
                    </p>
                  )}
              </section>
            )}
            {/* Popular NPC Market Stalls */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                Active Oja-Oba Market Vendors
              </h4>
              <div className="space-y-2">
                {npcStalls.isLoading && <p role="status">Loading market vendors...</p>}
                {npcStalls.isError && (
                  <p role="alert">
                    Market vendors are unavailable.{" "}
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => void npcStalls.refetch()}
                    >
                      Try again
                    </button>
                  </p>
                )}
                {!npcStalls.isLoading && !npcStalls.isError && !npcStalls.data?.length && (
                  <p className="text-xs text-muted-foreground">No town vendors are listed yet.</p>
                )}
                {npcStalls.data?.map((npc) => (
                  <div
                    key={npc.id}
                    className="phone-card flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold truncate">{npc.name}</strong>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-600 px-1.5 py-0.2 rounded font-bold">
                          {npc.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{npc.goods}</p>
                      <small className="text-[11px] text-primary block mt-1">
                        {npc.visitor_count} visits
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-3">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold text-muted-foreground">
                Wallet Cash:{" "}
                <strong className="text-foreground">{formatNaira(wallet?.balance)}</strong>
              </span>
              <span>{currentLocation?.name ?? "Osogbo District"}</span>
            </div>

            {currentShops.length > 0 ? (
              <div className="space-y-3">
                {currentShops.map((offer) => {
                  const item = offer.item;
                  const unitPrice = offer.buy_price ?? item?.buy_price ?? 0;
                  const minimumQuantity = offer.minimum_quantity ?? 1;
                  const quantity = quantities[offer.id] ?? minimumQuantity;
                  const quote = purchaseTotal(unitPrice, quantity, wallet?.balance ?? 0);
                  const canBuy =
                    item &&
                    unitPrice > 0 &&
                    quantity >= minimumQuantity &&
                    (offer.stock === null || offer.stock >= quantity);

                  return (
                    <div key={offer.id} className="phone-card p-3 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <span className="p-2 rounded-lg bg-primary/10 text-primary flex-none">
                          <ShoppingBag className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm">{item?.name ?? "Market Goods"}</h4>
                          <p className="text-xs text-muted-foreground">{item?.description}</p>
                          <span className="text-xs font-bold text-primary mt-1 block">
                            {formatNaira(unitPrice)} each
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground">Qty:</label>
                          <input
                            type="number"
                            min={minimumQuantity}
                            max={item?.stackable ? item.max_stack : 1}
                            value={quantity}
                            onChange={(e) =>
                              setQuantities((old) => ({
                                ...old,
                                [offer.id]: Math.max(minimumQuantity, Number(e.target.value)),
                              }))
                            }
                            className="w-14 px-2 py-1 text-xs rounded border border-border bg-background"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{formatNaira(quote.total)}</span>
                          <button
                            type="button"
                            disabled={!canBuy || purchase.isPending}
                            onClick={() =>
                              purchase.mutate({
                                shopItemId: offer.id,
                                quantity,
                                requestId: crypto.randomUUID(),
                              })
                            }
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                          >
                            Buy
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="phone-empty-state">
                <Store className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="font-bold text-sm">No shops currently open in this district</p>
                <small className="text-xs text-muted-foreground">
                  Visit Oja-Oba Market, Sabo, or Osun Mall to browse city store inventory.
                </small>
              </div>
            )}

            {/* Inventory Selling Section */}
            {inventory && inventory.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                  Sell Carried Items
                </h4>
                <div className="space-y-2">
                  {inventory
                    .filter((entry) => entry.item?.sellable)
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="phone-card flex items-center justify-between p-2.5"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-xs block truncate">
                            {entry.item?.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {entry.quantity} in bag · {formatNaira(entry.item?.sell_price ?? 0)}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={sell.isPending}
                          onClick={() => {
                            const firstShop = currentShops[0]?.shop_id;
                            if (firstShop) {
                              sell.mutate({
                                shopId: firstShop,
                                inventoryId: entry.id,
                                quantity: 1,
                              });
                            } else {
                              toast.info("Visit a local market shop to sell your items.");
                            }
                          }}
                          className="text-xs font-bold px-2.5 py-1 rounded bg-leaf text-foreground border border-border"
                        >
                          Sell 1
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export default PhoneMarketApp;
