import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  billboardCampaignPrice,
  purchasePlayerAd,
  updatePlayerAd,
  type AdTheme,
  type AdvertisingMarket,
} from "@/lib/advertising-service";
import { formatNaira, q } from "@/lib/game";
import "./billboard-ad.css";
import { PaletteSelect } from "@/components/ui/palette-select";

const themes: { id: AdTheme; label: string }[] = [
  { id: "green", label: "Market green" },
  { id: "ink", label: "Midnight" },
  { id: "sun", label: "Sunshine" },
  { id: "clay", label: "Terracotta" },
];
type Campaign = AdvertisingMarket["myAds"][number];
type Creative = Pick<Campaign, "advertiserName" | "title" | "description" | "creativeTheme">;

export function BillboardAdApp() {
  const client = useQueryClient();
  const market = useQuery(q.advertisingMarket());
  const [billboardId, setBillboardId] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState<AdTheme>("green");
  const [duration, setDuration] = useState<7 | 14 | 30>(7);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCreative, setEditCreative] = useState<Creative>({
    advertiserName: "",
    title: "",
    description: "",
    creativeTheme: "green",
  });
  const selected =
    market.data?.billboards.find((board) => board.id === billboardId) ?? market.data?.billboards[0];
  const cost = selected ? billboardCampaignPrice(selected.dailyPrice, duration) : 0;
  const refreshAds = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["advertisingMarket"] }),
      client.invalidateQueries({ queryKey: ["playerAdvertisements"] }),
      client.invalidateQueries({ queryKey: ["advertisements"] }),
    ]);
  const purchase = useMutation({
    mutationFn: purchasePlayerAd,
    retry: false,
    onSuccess: async () => {
      toast.success("Your billboard campaign is live.");
      setTitle("");
      setDescription("");
      await Promise.all([
        refreshAds(),
        client.invalidateQueries({ queryKey: ["wallet"] }),
        client.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const update = useMutation({
    mutationFn: updatePlayerAd,
    onSuccess: async () => {
      setEditingId(null);
      toast.success("Your billboard creative has been updated.");
      await refreshAds();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (market.isPending) return <p className="p-5 text-sm">Loading billboard market…</p>;
  if (!market.data || market.error)
    return (
      <div className="p-5">
        <p role="alert">{market.error?.message ?? "Unable to load billboard market."}</p>
        <Button onClick={() => void market.refetch()}>Retry</Button>
      </div>
    );
  const startEdit = (ad: Campaign) => {
    setEditingId(ad.id);
    setEditCreative({
      advertiserName: ad.advertiserName,
      title: ad.title,
      description: ad.description,
      creativeTheme: ad.creativeTheme,
    });
  };
  return (
    <div className="phone-finance-app billboard-ad-app scrollbar-hidden">
      <header className="billboard-app-hero">
        <span className="billboard-app-hero-icon">
          <Megaphone size={21} aria-hidden="true" />
        </span>
        <div>
          <span className="billboard-eyebrow">Promote your business</span>
          <h2>Billboards</h2>
          <p>Choose a placement and create an ad for the city.</p>
        </div>
      </header>
      {purchase.isError && (
        <div role="alert" className="phone-finance-card">
          <p>{purchase.error.message}</p>
          <Button
            disabled={purchase.isPending}
            onClick={() => purchase.variables && purchase.mutate(purchase.variables)}
          >
            Retry purchase
          </Button>
        </div>
      )}
      <p className="phone-finance-disclaimer billboard-disclaimer">
        Active ads are visible to other players. Only you can manage your campaigns. Purchases use
        in-game Naira.
      </p>
      <div className="billboard-section-heading">
        <div>
          <span className="billboard-eyebrow">New promotion</span>
          <h2>Create a campaign</h2>
        </div>
      </div>
      {!selected ? (
        <p className="phone-finance-empty">There are no active billboards available right now.</p>
      ) : (
        <form
          className="billboard-ad-form"
          onSubmit={(event) => {
            event.preventDefault();
            purchase.mutate({
              billboardId: selected.id,
              advertiserName: advertiserName.trim(),
              title: title.trim(),
              description: description.trim(),
              creativeTheme: theme,
              durationDays: duration,
              requestId: crypto.randomUUID(),
            });
          }}
        >
          <label>
            Billboard
            <PaletteSelect
              value={billboardId || selected.id}
              onValueChange={setBillboardId}
              options={market.data.billboards.map((board) => ({
                value: board.id,
                label: `${board.name} · ${board.location} · ${board.sizeType}`,
              }))}
            />
          </label>
          <div className="billboard-location-card">
            <span className="billboard-eyebrow">Selected placement</span>
            <strong>{selected.name}</strong>
            <span>
              {selected.location} · {selected.sizeType}
            </span>
            <small>{selected.placement}</small>
          </div>
          <label>
            Advertiser name
            <input
              value={advertiserName}
              onChange={(event) => setAdvertiserName(event.target.value)}
              minLength={2}
              maxLength={48}
              required
            />
          </label>
          <label>
            Headline
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              minLength={3}
              maxLength={72}
              required
            />
          </label>
          <label>
            Ad description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={3}
              maxLength={180}
              rows={3}
              required
            />
          </label>
          <label>
            Design
            <PaletteSelect
              value={theme}
              onValueChange={(next) => setTheme(next as AdTheme)}
              options={themes.map((choice) => ({ value: choice.id, label: choice.label }))}
            />
          </label>
          <label>
            Campaign duration
            <PaletteSelect
              value={String(duration)}
              onValueChange={(next) => setDuration(Number(next) as 7 | 14 | 30)}
              options={[7, 14, 30].map((days) => ({ value: String(days), label: `${days} days` }))}
            />
          </label>
          <div
            className={`billboard-creative-preview billboard-theme-${theme}`}
            aria-label="Campaign preview"
          >
            <span>Preview</span>
            <strong>{title.trim() || "Your headline will appear here"}</strong>
            <p>{description.trim() || "Your ad description will appear here."}</p>
            {advertiserName.trim() && <small>{advertiserName.trim()}</small>}
          </div>
          <div className="billboard-ad-price">
            <span>Campaign total</span>
            <strong>{formatNaira(cost)}</strong>
          </div>
          <Button type="submit" disabled={purchase.isPending} className="w-full">
            {purchase.isPending ? "Publishing…" : `Purchase ad · ${formatNaira(cost)}`}
          </Button>
        </form>
      )}
      <section className="billboard-owned-campaigns">
        <div className="billboard-section-heading">
          <div>
            <span className="billboard-eyebrow">Your promotions</span>
            <h3>Your campaigns</h3>
          </div>
          <span className="billboard-campaign-count">{market.data.myAds.length}</span>
        </div>
        {!market.data.myAds.length && (
          <p className="phone-finance-empty">Your ads will appear here after purchase.</p>
        )}
        {market.data.myAds.map((ad) => (
          <article className="phone-finance-card billboard-campaign" key={ad.id}>
            {editingId === ad.id ? (
              <form
                className="billboard-ad-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  update.mutate({ advertisementId: ad.id, ...editCreative });
                }}
              >
                <label>
                  Advertiser name
                  <input
                    required
                    minLength={2}
                    maxLength={48}
                    value={editCreative.advertiserName}
                    onChange={(event) =>
                      setEditCreative((value) => ({ ...value, advertiserName: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Headline
                  <input
                    required
                    minLength={3}
                    maxLength={72}
                    value={editCreative.title}
                    onChange={(event) =>
                      setEditCreative((value) => ({ ...value, title: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Description
                  <textarea
                    required
                    minLength={3}
                    maxLength={180}
                    rows={3}
                    value={editCreative.description}
                    onChange={(event) =>
                      setEditCreative((value) => ({ ...value, description: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Design
                  <PaletteSelect
                    value={editCreative.creativeTheme}
                    onValueChange={(next) =>
                      setEditCreative((value) => ({
                        ...value,
                        creativeTheme: next as AdTheme,
                      }))
                    }
                    options={themes.map((choice) => ({ value: choice.id, label: choice.label }))}
                  />
                </label>
                <div className="billboard-edit-actions">
                  <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                    <X size={15} /> Cancel
                  </Button>
                  <Button type="submit" disabled={update.isPending}>
                    {update.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <strong>{ad.title}</strong>
                <p>
                  {ad.advertiserName} · {ad.billboardName}
                </p>
                <small>
                  {ad.status === "expired"
                    ? "Expired"
                    : `Live until ${new Date(ad.endsAt).toLocaleDateString("en-NG")}`}{" "}
                  · Paid {formatNaira(ad.amountPaid)}
                </small>
                {ad.status === "active" && (
                  <Button type="button" size="sm" variant="outline" onClick={() => startEdit(ad)}>
                    <Pencil size={15} /> Edit creative
                  </Button>
                )}
              </>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
