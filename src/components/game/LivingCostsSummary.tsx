import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ReceiptText } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { canonicalHomeOptions, parseHousingCost, readFoodCost } from "@/lib/living-cost-service";
import { formatNaira } from "@/lib/game";

function Freshness({
  offline,
  failed,
  updated,
  refreshing,
}: {
  offline: boolean;
  failed: boolean;
  updated: number;
  refreshing: boolean;
}) {
  if (!updated || (!offline && !failed && !refreshing)) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Previously loaded {new Date(updated).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}{" "}
      (Lagos). {offline ? "Offline." : failed ? "Refresh failed." : "Refreshing…"}
    </p>
  );
}

export function LivingCostsSummary({
  characterId,
  userId,
}: {
  characterId: string;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const housing = useQuery({
    ...canonicalHomeOptions(characterId),
    select: parseHousingCost,
    enabled: open && online && !!characterId && !!userId,
    refetchOnMount: "always",
    retry: false,
  });
  const food = useQuery({
    queryKey: ["livingCostsFood", userId],
    queryFn: readFoodCost,
    enabled: open && online && !!userId,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  const refreshHousing = housing.refetch;
  const refreshFood = food.refetch;
  useEffect(() => {
    if (open && online) {
      void refreshHousing();
      void refreshFood();
    }
    // Refresh when the panel opens, including when its observers were previously disabled.
  }, [open, online, refreshHousing, refreshFood]);
  const home = housing.data;
  const date = (value: string) =>
    new Date(value).toLocaleString("en-NG", {
      timeZone: "Africa/Lagos",
      dateStyle: "medium",
      timeStyle: "short",
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="hd-icon-button"
          aria-label="Living costs"
          title="Living costs"
        >
          <ReceiptText className="h-4 w-4" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="living-costs-dialog">
        <DialogTitle>Living costs</DialogTitle>
        <DialogDescription>
          Plan for weekly housing and individual food and travel purchases.
        </DialogDescription>
        <section aria-label="Housing costs" className="space-y-2">
          <h3 className="font-semibold">Housing</h3>
          {home === undefined ? (
            <p role="status">
              {!online
                ? "Offline. Housing unavailable."
                : housing.isError
                  ? "Housing unavailable."
                  : "Loading housing…"}
            </p>
          ) : home === null ? (
            <p>No current home.</p>
          ) : (
            <>
              <p>
                {home.owned
                  ? "Owned home · no weekly rent"
                  : `${formatNaira(home.weeklyRent!)} per week`}
              </p>
              {!home.owned && (
                <p>
                  Status: {home.status}.{" "}
                  {home.dueAt ? `Due ${date(home.dueAt)} (Lagos).` : "Due date unavailable."}
                </p>
              )}
              {!home.owned && home.status === "grace" && home.graceEndsAt && (
                <p>Grace ends {date(home.graceEndsAt)} (Lagos).</p>
              )}
              {!home.owned && home.status === "rescue" && home.rescueEndsAt && (
                <p>Rescue ends {date(home.rescueEndsAt)} (Lagos).</p>
              )}
            </>
          )}
          <Freshness
            offline={!online}
            failed={housing.isError}
            updated={housing.dataUpdatedAt}
            refreshing={housing.isFetching}
          />
          {online && housing.isError && (
            <button type="button" onClick={() => void housing.refetch()}>
              Retry housing
            </button>
          )}
          <Link to="/properties" onClick={() => setOpen(false)} className="underline">
            Manage housing
          </Link>
        </section>
        <section aria-label="Food costs" className="space-y-2">
          <h3 className="font-semibold">Food</h3>
          <p role="status">
            {food.data === undefined
              ? !online
                ? "Offline. Menu unavailable."
                : food.isError
                  ? "Menu unavailable."
                  : "Loading menu…"
              : food.data === null
                ? "No menu items available."
                : `Menu items from ${formatNaira(food.data)} each.`}
          </p>
          <Freshness
            offline={!online}
            failed={food.isError}
            updated={food.dataUpdatedAt}
            refreshing={food.isFetching}
          />
          {online && food.isError && (
            <button type="button" onClick={() => void food.refetch()}>
              Retry menu
            </button>
          )}
          <p className="text-sm text-muted-foreground">
            Open Phone → Food Delivery. Selection and quantity determine your total; prices can
            change before ordering.
          </p>
        </section>
        <section aria-label="Transport costs" className="space-y-2">
          <h3 className="font-semibold">Transport</h3>
          <p>Cost depends on your destination and travel option.</p>
          <Link to="/map" onClick={() => setOpen(false)} className="underline">
            Explore travel options
          </Link>
        </section>
        <p className="text-sm text-muted-foreground">
          Use existing jobs to earn cash, and leave room in your budget for savings.
        </p>
      </DialogContent>
    </Dialog>
  );
}
