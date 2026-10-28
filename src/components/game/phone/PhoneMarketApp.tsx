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

const GOODS_CATEGORIES = [
  {
    id: "fabrics",
    label: "Adire & Ankara Fabrics",
    desc: "Authentic Osogbo tie-dye and tailored wear",
  },
  {
    id: "groceries",
    label: "Fresh Market Produce",
    desc: "Yam, peppers, plantain, palm oil and fruits",
  },
  {
    id: "phones",
    label: "Phone Care & Accessories",
    desc: "Chargers, screen guards, earphones, casing",
  },
  {
    id: "hospitality",
    label: "Street Food & Cold Drinks",
    desc: "Puff-puff, roasted plantain, suya, soft drinks",
  },
  {
    id: "crafts",
    label: "Handcrafted Beads & Art",
    desc: "Osogbo sacred grove inspired wooden carvings and beads",
  },
];

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

  // Player stall query
  const stallQuery = useQuery({
    queryKey: ["playerStall", character?.id],
    enabled: !!character?.id,
    queryFn: async () => {
      // Migration 0060 is not in the generated client types yet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("player_stalls")
        .select("id,name,goods,is_open")
        .eq("character_id", character!.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data as { id: string; name: string; goods: string; is_open: boolean } | null;
    },
  });
  const npcStalls = useQuery({
    queryKey: ["npcMarketStalls"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
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
  const [selectedCategory, setSelectedCategory] = useState(
    GOODS_CATEGORIES[0]?.label ?? "General Goods",
  );
  const [selectedTheme, setSelectedTheme] = useState("indigo");
  const [stallOpen, setStallOpen] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);

  if (stallQuery.data && !formInitialized) {
    setStallName(stallQuery.data.name);
    setSelectedCategory(stallQuery.data.goods);
    setStallOpen(stallQuery.data.is_open);
    setFormInitialized(true);
  }

  // Save/rent stall mutation
  const saveStallMutation = useMutation({
    mutationFn: async () => {
      if (!character?.id) throw new Error("Character not loaded");
      const name = stallName.trim() || `${character.name}'s Oja-Oba Stall`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("save_player_stall", {
        p_name: name,
        p_goods: selectedCategory,
        p_is_open: stallOpen,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(stallOpen ? "Stall is now open at Oja-Oba Market." : "Stall details saved.");
      void queryClient.invalidateQueries({ queryKey: ["playerStall"] });
      void queryClient.invalidateQueries({ queryKey: ["ownedStalls"] });
      void queryClient.invalidateQueries({ queryKey: ["publicPlayerStalls"] });
      if (character?.user_id)
        void queryClient.invalidateQueries({ queryKey: stallIncomeKey(character.user_id) });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update stall");
    },
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
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                  >
                    {GOODS_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.label}>
                        {cat.label} ({cat.desc})
                      </option>
                    ))}
                  </select>
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
                  disabled={saveStallMutation.isPending}
                  onClick={() => saveStallMutation.mutate()}
                  className="w-full py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {saveStallMutation.isPending ? "Saving stall..." : "Save stall details"}
                </button>
              </div>
            </div>

            {character?.user_id && (
              <StallIncomePanel key={character.user_id} userId={character.user_id} />
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
