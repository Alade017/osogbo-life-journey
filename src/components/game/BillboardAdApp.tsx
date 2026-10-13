import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  billboardCampaignPrice,
  getAdvertisingMarket,
  purchasePlayerAd,
  type AdTheme,
} from "@/lib/advertising-service";
import { formatNaira, q } from "@/lib/game";
import "./billboard-ad.css";

const themes: { id: AdTheme; label: string }[] = [
  { id: "green", label: "Market green" },
  { id: "ink", label: "Midnight" },
  { id: "sun", label: "Sunshine" },
  { id: "clay", label: "Terracotta" },
];

export function BillboardAdApp() {
  const client = useQueryClient();
  const market = useQuery(q.advertisingMarket());
  const [billboardId, setBillboardId] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState<AdTheme>("green");
  const [duration, setDuration] = useState<7 | 14 | 30>(7);
  const selected =
    market.data?.billboards.find((board) => board.id === billboardId) ?? market.data?.billboards[0];
  const cost = selected ? billboardCampaignPrice(selected.dailyPrice, duration) : 0;

  const purchase = useMutation({
    mutationFn: purchasePlayerAd,
    retry: false,
    onSuccess: async () => {
      toast.success("Your billboard campaign is live.");
      setTitle("");
      setDescription("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["advertisingMarket"] }),
        client.invalidateQueries({ queryKey: ["playerAdvertisements"] }),
        client.invalidateQueries({ queryKey: ["advertisements"] }),
        client.invalidateQueries({ queryKey: ["wallet"] }),
        client.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
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

  function submit() {
    if (!selected) return;
    purchase.mutate({
      billboardId: selected.id,
      advertiserName: advertiserName.trim(),
      title: title.trim(),
      description: description.trim(),
      creativeTheme: theme,
      durationDays: duration,
      requestId: crypto.randomUUID(),
    });
  }

  return (
    <div className="phone-finance-app billboard-ad-app">
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
      <p className="phone-finance-disclaimer">
        Virtual in-game Naira only. Other players can view active ads; only you can manage your
        campaigns.
      </p>
      <h2>
        <Megaphone size={18} /> Create a campaign
      </h2>
      {!selected ? (
        <p className="phone-finance-empty">There are no active billboards available right now.</p>
      ) : (
        <form
          className="billboard-ad-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label>
            Billboard
            <select
              value={billboardId || selected.id}
              onChange={(event) => setBillboardId(event.target.value)}
            >
              {market.data.billboards.map((board) => (
                <option value={board.id} key={board.id}>
                  {board.name} · {board.location} · {board.sizeType}
                </option>
              ))}
            </select>
          </label>
          <p className="billboard-placement">{selected.placement}</p>
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
            <select value={theme} onChange={(event) => setTheme(event.target.value as AdTheme)}>
              {themes.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Campaign duration
            <select
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value) as 7 | 14 | 30)}
            >
              {[7, 14, 30].map((days) => (
                <option value={days} key={days}>
                  {days} days
                </option>
              ))}
            </select>
          </label>
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
        <h3>Your campaigns</h3>
        {!market.data.myAds.length && (
          <p className="phone-finance-empty">Your ads will appear here after purchase.</p>
        )}
        {market.data.myAds.map((ad) => (
          <article className="phone-finance-card" key={ad.id}>
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
          </article>
        ))}
      </section>
    </div>
  );
}
