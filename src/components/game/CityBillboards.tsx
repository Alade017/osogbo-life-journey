import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Megaphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { q, type Advertisement, type GameBillboard } from "@/lib/game";

const CREATIVE_THEMES: Record<string, string> = {
  green: "bg-primary text-primary-foreground",
  ink: "bg-ink text-ink-foreground",
  sun: "bg-sun text-sun-foreground",
  clay: "bg-clay text-clay-foreground",
};

function isCurrentAdvertisement(ad: Advertisement, now: number) {
  const startsAt = Date.parse(ad.starts_at);
  const endsAt = ad.ends_at ? Date.parse(ad.ends_at) : Number.POSITIVE_INFINITY;
  return ad.status === "active" && startsAt <= now && endsAt > now;
}

function safeExternalUrl(value: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function safeInternalPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return undefined;
  return value;
}

function CurrentCampaign({
  billboard,
  advertisement,
}: {
  billboard: GameBillboard;
  advertisement: Advertisement;
}) {
  const externalUrl =
    advertisement.destination_action === "external_url"
      ? safeExternalUrl(advertisement.destination_url)
      : undefined;
  const internalPath =
    advertisement.destination_action === "internal_route"
      ? safeInternalPath(advertisement.destination_url)
      : undefined;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`View ${advertisement.advertiser_name} ad on ${billboard.name}`}
          className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
        >
          <span className="mx-auto flex h-7 items-center justify-center gap-2 rounded-t-sm bg-ink px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-foreground">
            <Megaphone className="h-3.5 w-3.5" />
            {billboard.name}
          </span>
          <span className="block rounded-sm border-[7px] border-ink bg-ink p-1 shadow-[0_8px_0_rgba(27,37,48,0.22)] transition-transform group-hover:-translate-y-1">
            <span
              className={cn(
                "relative flex min-h-40 flex-col justify-between overflow-hidden px-5 py-4 text-left sm:min-h-48 sm:px-8 sm:py-6",
                CREATIVE_THEMES[advertisement.creative_theme] ?? CREATIVE_THEMES["green"],
              )}
            >
              {advertisement.creative_image_url && (
                <img
                  src={advertisement.creative_image_url}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              {advertisement.creative_image_url && (
                <span className="absolute inset-0 bg-slate-950/35" />
              )}
              <span className="relative flex items-center justify-between gap-3">
                <span className="font-display text-2xl font-bold leading-none sm:text-4xl">
                  {advertisement.advertiser_name.toUpperCase()}
                </span>
                <span className="rounded-full border border-current/50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em]">
                  Advertisement
                </span>
              </span>
              <span className="relative mt-4 grid gap-1 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-4">
                <span>
                  <span className="block text-sm font-bold leading-snug sm:text-lg">
                    {advertisement.description}
                  </span>
                  <span className="mt-2 block font-display text-base font-semibold leading-tight sm:text-2xl">
                    {advertisement.title}
                  </span>
                </span>
                {advertisement.call_to_action && (
                  <span className="mt-2 inline-flex w-fit items-center gap-1 border-b border-current pb-1 text-xs font-bold uppercase tracking-wide sm:justify-self-end">
                    {advertisement.call_to_action}
                    <ArrowDownRight className="h-4 w-4" />
                  </span>
                )}
              </span>
            </span>
          </span>
          <span
            className="mx-auto block h-8 w-16 border-x-8 border-ink bg-secondary shadow-sm"
            aria-hidden="true"
          />
          <span className="mx-auto block h-2 w-28 rounded-full bg-ink" aria-hidden="true" />
          <span className="sr-only">
            Open {advertisement.advertiser_name} advertisement details
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{advertisement.advertiser_name}</DialogTitle>
          <DialogDescription>
            {billboard.name} · {billboard.placement}
          </DialogDescription>
        </DialogHeader>
        <div
          className={cn(
            "overflow-hidden rounded-lg p-5 sm:p-7",
            CREATIVE_THEMES[advertisement.creative_theme] ?? CREATIVE_THEMES["green"],
          )}
        >
          {advertisement.creative_image_url && (
            <img
              src={advertisement.creative_image_url}
              alt={`${advertisement.advertiser_name} creative`}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="mb-4 max-h-56 w-full rounded-md object-cover"
            />
          )}
          <p className="font-display text-3xl font-bold sm:text-4xl">
            {advertisement.advertiser_name.toUpperCase()}
          </p>
          <p className="mt-4 text-sm font-bold sm:text-base">{advertisement.description}</p>
          <h3 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
            {advertisement.title}
          </h3>
        </div>
        {externalUrl || internalPath ? (
          <Button asChild variant="ink" className="w-full sm:w-fit">
            <a
              href={externalUrl ?? internalPath}
              target={externalUrl ? "_blank" : undefined}
              rel={externalUrl ? "noopener noreferrer" : undefined}
            >
              {advertisement.call_to_action ?? "Learn more"}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </Button>
        ) : advertisement.call_to_action ? (
          <p className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground">
            {advertisement.call_to_action}
            <span className="text-xs font-normal">No destination configured</span>
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Campaign dates: {new Date(advertisement.starts_at).toLocaleDateString("en-NG")} –{" "}
          {advertisement.ends_at
            ? new Date(advertisement.ends_at).toLocaleDateString("en-NG")
            : "No end date"}
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function CityBillboards({ locationId }: { locationId: string }) {
  const { data: billboards } = useQuery(q.billboards());
  const { data: advertisements } = useQuery(q.advertisements());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const campaignsByBoard = new Map<string, Advertisement>();
  for (const ad of advertisements ?? []) {
    if (isCurrentAdvertisement(ad, now) && !campaignsByBoard.has(ad.billboard_id)) {
      campaignsByBoard.set(ad.billboard_id, ad);
    }
  }

  const placements = (billboards ?? []).filter(
    (board) => board.location_id === locationId && board.status === "active",
  );
  const visible = placements.flatMap((board) => {
    const advertisement = campaignsByBoard.get(board.id);
    return advertisement ? [{ billboard: board, advertisement }] : [];
  });

  if (!visible.length) return null;

  return (
    <section aria-label="City advertisements" className="space-y-3 py-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Around the district
        </p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-bold">
          <Megaphone className="h-5 w-5 text-primary" />
          Roadside billboard
        </h2>
      </div>
      <div className="mx-auto max-w-3xl">
        {visible.map(({ billboard, advertisement }) => (
          <CurrentCampaign key={billboard.id} billboard={billboard} advertisement={advertisement} />
        ))}
      </div>
    </section>
  );
}
