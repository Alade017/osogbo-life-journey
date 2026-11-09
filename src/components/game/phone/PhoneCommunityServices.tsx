import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { foodDeliveryService, type FoodDelivery } from "@/lib/food-delivery-service";
import { formatNaira, q } from "@/lib/game";
import { PaletteSelect } from "@/components/ui/palette-select";
import { Bike, MapPin, UtensilsCrossed } from "lucide-react";

type ServiceApp = "Calendar" | "Food Delivery" | "Okada Rides" | "Contribution";
type TownEvent = { id: string; title: string; venue: string; starts_at: string };
type MenuItem = { id: string; name: string; price_minor: number; vendor_id: string };
type Vendor = { id: string; name: string };
type Fund = { id: string; title: string; goal_minor: number };
type Ride = {
  id: string;
  destination: string;
  fare_minor: number;
  status: string;
  created_at: string;
};
type Contribution = { id: string; fund_id: string; amount_minor: number };

/** Visual tone for a ride status: active, finished, or stopped. */
function rideTone(status: string): "active" | "done" | "stopped" {
  if (status === "completed") return "done";
  if (status === "cancelled") return "stopped";
  return "active";
}

function rideStatusLabel(status: string) {
  if (status === "assigned") return "Driver assigned";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Searching for a rider";
}

type PhoneRowTable =
  | "food_vendors"
  | "food_menu_items"
  | "community_funds"
  | "community_contributions"
  | "player_event_reminders"
  | "town_events"
  | "town_service_prices"
  | "okada_ride_requests";

function usePhoneRows<T>(
  table: PhoneRowTable,
  columns: string,
  orderBy?: string,
  ascending = false,
) {
  return useQuery({
    queryKey: ["phoneService", table],
    queryFn: async (): Promise<T[]> => {
      let request = supabase.from(table).select(columns);
      if (orderBy) request = request.order(orderBy, { ascending });
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

function StateMessage({
  loading,
  error,
  empty,
  retry,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  retry: () => void;
}) {
  if (loading)
    return (
      <p className="phone-service-state" role="status">
        Loading…
      </p>
    );
  if (error)
    return (
      <div className="phone-service-state" role="alert">
        Could not load this app.{" "}
        <button type="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  if (empty) return <p className="phone-service-state">Nothing available right now.</p>;
  return null;
}

function CalendarApp() {
  const client = useQueryClient();
  const events = usePhoneRows<TownEvent>(
    "town_events",
    "id,title,venue,starts_at",
    "starts_at",
    true,
  );
  const reminders = usePhoneRows<{ event_id: string }>("player_event_reminders", "event_id");
  const save = useMutation({
    mutationFn: async ({ eventId, enabled }: { eventId: string; enabled: boolean }) => {
      const { error } = await supabase.rpc("save_phone_event_reminder", {
        p_event_id: eventId,
        p_enabled: enabled,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["phoneService", "player_event_reminders"] });
      toast.success("Reminder saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const saved = new Set(reminders.data?.map((item) => item.event_id));
  return (
    <div className="phone-service-screen calendar-app">
      <header className="calendar-hero">
        <h2>Town calendar</h2>
        <p>Town events and your saved reminders</p>
      </header>
      <StateMessage
        loading={events.isLoading || reminders.isLoading}
        error={events.isError || reminders.isError}
        empty={!events.data?.length}
        retry={() => {
          void events.refetch();
          void reminders.refetch();
        }}
      />
      {events.data?.map((event) => (
        <article className="phone-service-card calendar-event" key={event.id}>
          <time>
            {new Date(event.starts_at).toLocaleString("en-NG", {
              timeZone: "Africa/Lagos",
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
          <h3>{event.title}</h3>
          <p>{event.venue}</p>
          <button
            type="button"
            disabled={save.isPending}
            aria-pressed={saved.has(event.id)}
            onClick={() => save.mutate({ eventId: event.id, enabled: !saved.has(event.id) })}
          >
            {saved.has(event.id) ? "Remove reminder" : "Save reminder"}
          </button>
        </article>
      ))}
    </div>
  );
}

function DeliveryRecords() {
  const records = useQuery({
    queryKey: ["phoneService", "food_delivery_history"],
    queryFn: foodDeliveryService.getHistory,
    refetchInterval: 15_000,
  });
  const rows = records.data ?? [];
  const stateLabels: Record<string, string> = {
    pending: "Preparing",
    awaiting_response: "At your door",
    approaching: "On the way",
    package_waiting: "Waiting for you",
    collected: "Collected",
    cancelled: "Cancelled",
  };

  return (
    <section className="phone-delivery-records" aria-label="Delivery records">
      <h3 className="phone-service-subheading">Delivery records</h3>
      {records.isLoading && <p className="phone-empty-state">Loading recent deliveries.</p>}
      {records.isError && (
        <div className="phone-service-state" role="alert">
          <p>Could not load deliveries.</p>
          <small>
            {records.error instanceof Error ? records.error.message : String(records.error)}
          </small>
          <button
            type="button"
            className="phone-service-action"
            onClick={() => void records.refetch()}
          >
            Try again
          </button>
        </div>
      )}
      {!records.isLoading && !records.isError && rows.length === 0 && (
        <p className="phone-empty-state">No deliveries yet.</p>
      )}
      <ul className="phone-record-list">
        {rows.map((row) => (
          <li key={row.id} className="phone-record-row">
            <div>
              <strong>{row.vendorName}</strong>
              <small>
                {new Date(row.createdAt).toLocaleString("en-NG", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
            <div>
              <span>{row.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</span>
              <small>
                {row.deliveryChoice === "inside"
                  ? "Brought inside"
                  : row.deliveryChoice === "outside"
                    ? "Left at door"
                    : "Awaiting choice"}{" "}
                · {stateLabels[row.deliveryState] ?? row.deliveryState}
              </small>
            </div>
            <strong>{formatNaira(row.totalMinor)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FoodApp() {
  const client = useQueryClient();
  const vendors = usePhoneRows<Vendor>("food_vendors", "id,name");
  const menu = usePhoneRows<MenuItem>("food_menu_items", "id,name,price_minor,vendor_id");
  const walletQuery = useQuery(q.wallet());
  const wallet = walletQuery.data;
  const [vendorId, setVendorId] = useState("");
  const [pickedId, setPickedId] = useState("");
  const [quantityText, setQuantityText] = useState("1");
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [lineText, setLineText] = useState<Record<string, string>>({});
  const selectedVendorId = vendorId || vendors.data?.[0]?.id || "";
  const selectedItems = menu.data?.filter((item) => item.vendor_id === selectedVendorId) ?? [];
  const pickedItem = selectedItems.find((item) => item.id === pickedId) ?? selectedItems[0];
  const basketLines = selectedItems.filter((item) => (basket[item.id] ?? 0) > 0);
  const portions = basketLines.reduce((sum, item) => sum + (basket[item.id] ?? 0), 0);
  const total = basketLines.reduce(
    (sum, item) => sum + item.price_minor * (basket[item.id] ?? 0),
    0,
  );
  const insufficient = total > (wallet?.balance ?? 0);
  const typedQuantity = Math.min(20, Number(quantityText) || 0);

  const chooseKitchen = (id: string) => {
    setVendorId(id);
    setPickedId("");
    setQuantityText("1");
    setBasket({});
    setLineText({});
  };

  const addPicked = () => {
    if (!pickedItem || typedQuantity < 1) return;
    setBasket((current) => ({
      ...current,
      [pickedItem.id]: Math.min(20, (current[pickedItem.id] ?? 0) + typedQuantity),
    }));
    setQuantityText("1");
  };

  // Typed quantities in the basket: digits only, capped at 20.
  const setLineQuantity = (itemId: string, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "").slice(0, 2);
    const value = Math.min(20, Number(digits) || 0);
    setLineText((current) => ({ ...current, [itemId]: digits }));
    if (value > 0) setBasket((current) => ({ ...current, [itemId]: value }));
  };

  const finishLine = (itemId: string) => {
    setLineText((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  };

  const removeLine = (itemId: string) => {
    setBasket((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
    finishLine(itemId);
  };

  const order = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_food_delivery", {
        p_vendor_id: selectedVendorId,
        p_items: basketLines.map((item) => ({
          menu_item_id: item.id,
          quantity: basket[item.id],
        })),
        p_request_id: crypto.randomUUID(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBasket({});
      setLineText({});
      setQuantityText("1");
      void client.invalidateQueries({ queryKey: ["phoneService", "food_delivery_history"] });
      void client.invalidateQueries({ queryKey: q.wallet().queryKey });
      void client.invalidateQueries({ queryKey: q.transactions().queryKey });
      toast.success("Order approved. The kitchen is preparing it.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="phone-service-screen food-app">
      <header className="food-hero">
        <span className="food-hero-icon">
          <UtensilsCrossed aria-hidden="true" />
        </span>
        <div className="food-hero-copy">
          <p className="food-eyebrow">Town kitchens</p>
          <h2>Food delivery</h2>
          <p>Choose your food, type the portions, and we will bring it to you.</p>
        </div>
        <span className="food-wallet">Cash {formatNaira(wallet?.balance ?? 0)}</span>
      </header>

      <StateMessage
        loading={vendors.isLoading || menu.isLoading}
        error={vendors.isError || menu.isError}
        empty={!vendors.data?.length || !menu.data?.length}
        retry={() => {
          void vendors.refetch();
          void menu.refetch();
        }}
      />

      {walletQuery.isError && (
        <p role="alert" className="phone-service-state">
          Cash balance is unavailable. Try reopening this app.
        </p>
      )}

      {!!vendors.data?.length && (
        <label className="phone-service-field">
          Kitchen
          <PaletteSelect
            value={selectedVendorId}
            onValueChange={chooseKitchen}
            options={vendors.data.map((vendor) => ({ value: vendor.id, label: vendor.name }))}
          />
        </label>
      )}

      {!!selectedItems.length && (
        <section className="food-card" aria-label="Add food">
          <label className="phone-service-field">
            Food
            <PaletteSelect
              value={pickedItem?.id ?? ""}
              onValueChange={setPickedId}
              options={selectedItems.map((item) => ({
                value: item.id,
                label: `${item.name} · ${formatNaira(item.price_minor)}`,
              }))}
            />
          </label>
          <div className="food-add-row">
            <label className="food-qty">
              <span>Portions</span>
              <input
                aria-label="Portions"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={quantityText}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) =>
                  setQuantityText(event.target.value.replace(/\D/g, "").slice(0, 2))
                }
              />
            </label>
            <button
              type="button"
              className="food-add-button"
              disabled={!pickedItem || typedQuantity < 1}
              onClick={addPicked}
            >
              Add to order
            </button>
          </div>
        </section>
      )}

      {!!basketLines.length && (
        <section className="food-card" aria-label="Your basket">
          <h3 className="food-card-title">Your order</h3>
          <ul className="food-basket">
            {basketLines.map((item) => (
              <li key={item.id} className="food-line">
                <div>
                  <strong>{item.name}</strong>
                  <small>{formatNaira(item.price_minor)} each</small>
                </div>
                <input
                  aria-label={`${item.name} portions in basket`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={lineText[item.id] ?? String(basket[item.id] ?? 0)}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => setLineQuantity(item.id, event.target.value)}
                  onBlur={() => finishLine(item.id)}
                />
                <strong>{formatNaira(item.price_minor * (basket[item.id] ?? 0))}</strong>
                <button type="button" className="food-remove" onClick={() => removeLine(item.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!basketLines.length && (
        <div className="food-checkout" role="region" aria-label="Checkout">
          <div>
            <span>
              {portions} {portions === 1 ? "portion" : "portions"}
            </span>
            <strong>{formatNaira(total)}</strong>
            {insufficient && (
              <small role="alert" className="food-warning">
                Not enough cash for this order
              </small>
            )}
          </div>
          <button
            type="button"
            disabled={!total || order.isPending || !wallet || insufficient}
            onClick={() => order.mutate()}
          >
            {order.isPending ? "Ordering…" : insufficient ? "Insufficient cash" : "Place order"}
          </button>
        </div>
      )}

      <DeliveryRecords />
    </div>
  );
}

function RidesApp() {
  const client = useQueryClient();
  const price = usePhoneRows<{ service: string; amount_minor: number }>(
    "town_service_prices",
    "service,amount_minor",
  );
  const rides = usePhoneRows<Ride>(
    "okada_ride_requests",
    "id,destination,fare_minor,status,created_at",
    "created_at",
  );
  const walletQuery = useQuery(q.wallet());
  const wallet = walletQuery.data;
  const [destination, setDestination] = useState("");
  const fare = price.data?.find((item) => item.service === "okada_ride")?.amount_minor;
  const request = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_okada_ride", {
        p_destination: destination.trim(),
        p_request_id: crypto.randomUUID(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDestination("");
      void client.invalidateQueries({ queryKey: ["phoneService", "okada_ride_requests"] });
      void client.invalidateQueries({ queryKey: q.wallet().queryKey });
      void client.invalidateQueries({ queryKey: q.transactions().queryKey });
      toast.success("An okada rider has been assigned.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="okada-app">
      <section className="okada-hero">
        <span className="okada-hero-icon">
          <Bike aria-hidden="true" />
        </span>
        <div>
          <h2>Okada rides</h2>
          <p>Quick motorbike trips around town</p>
        </div>
      </section>
      <StateMessage
        loading={price.isLoading}
        error={price.isError}
        empty={!fare}
        retry={() => void price.refetch()}
      />
      {walletQuery.isError && (
        <p role="alert" className="okada-notice">
          Cash balance is unavailable. Try reopening this app.
        </p>
      )}
      {!!fare && (
        <section className="okada-request" aria-label="Request a ride">
          <div className="okada-fare">
            <span>Fare</span>
            <strong>{formatNaira(fare)}</strong>
          </div>
          <label className="okada-field">
            <span>
              <MapPin aria-hidden="true" />
              Destination
            </span>
            <input
              maxLength={120}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Where are you going?"
            />
          </label>
          <button
            type="button"
            className="okada-submit"
            disabled={
              request.isPending || destination.trim().length < 2 || !wallet || fare > wallet.balance
            }
            onClick={() => request.mutate()}
          >
            {request.isPending
              ? "Requesting…"
              : fare > (wallet?.balance ?? 0)
                ? "Insufficient cash"
                : "Request ride"}
          </button>
          {wallet && <p className="okada-balance">Cash balance {formatNaira(wallet.balance)}</p>}
        </section>
      )}
      <section className="okada-history" aria-labelledby="okada-rides-heading">
        <h3 id="okada-rides-heading">Your rides</h3>
        <StateMessage
          loading={rides.isLoading}
          error={rides.isError}
          empty={!rides.data?.length}
          retry={() => void rides.refetch()}
        />
        {rides.data?.slice(0, 5).map((ride) => (
          <article className="okada-ride" key={ride.id}>
            <span className="okada-ride-icon">
              <MapPin aria-hidden="true" />
            </span>
            <span className="okada-ride-copy">
              <strong>{ride.destination}</strong>
              <small>{new Date(ride.created_at).toLocaleDateString("en-NG")}</small>
            </span>
            <span className={`okada-status okada-status-${rideTone(ride.status)}`}>
              {rideStatusLabel(ride.status)}
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}

function ContributionApp() {
  const client = useQueryClient();
  const funds = usePhoneRows<Fund>("community_funds", "id,title,goal_minor");
  const contributions = usePhoneRows<Contribution>(
    "community_contributions",
    "id,fund_id,amount_minor",
  );
  const walletQuery = useQuery(q.wallet());
  const wallet = walletQuery.data;
  const [amount, setAmount] = useState(500);
  const contribute = useMutation({
    mutationFn: async (fundId: string) => {
      const { error } = await supabase.rpc("contribute_to_community_fund", {
        p_fund_id: fundId,
        p_amount_minor: amount,
        p_request_id: crypto.randomUUID(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["phoneService", "community_contributions"] });
      void client.invalidateQueries({ queryKey: q.wallet().queryKey });
      void client.invalidateQueries({ queryKey: q.transactions().queryKey });
      toast.success("Contribution recorded.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="phone-service-screen contribution-app">
      <header className="contribution-hero">
        <h2>Community contribution</h2>
        <p>Support town projects with Virtual Naira</p>
      </header>
      <StateMessage
        loading={funds.isLoading || contributions.isLoading}
        error={funds.isError || contributions.isError}
        empty={!funds.data?.length}
        retry={() => {
          void funds.refetch();
          void contributions.refetch();
        }}
      />
      {walletQuery.isError && (
        <p role="alert" className="phone-service-state">
          Cash balance is unavailable. Try reopening this app.
        </p>
      )}
      {!!funds.data?.length && (
        <label className="phone-service-field">
          Contribution amount
          <input
            type="number"
            min="100"
            max="1000000"
            step="100"
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        </label>
      )}
      {funds.data?.map((fund) => (
        <article className="phone-service-card contribution-card" key={fund.id}>
          <h3>{fund.title}</h3>
          <dl className="contribution-figures">
            <div>
              <dt>Goal</dt>
              <dd>{formatNaira(fund.goal_minor)}</dd>
            </div>
            <div>
              <dt>Your contributions</dt>
              <dd>
                {formatNaira(
                  contributions.data
                    ?.filter((item) => item.fund_id === fund.id)
                    .reduce((sum, item) => sum + item.amount_minor, 0) ?? 0,
                )}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            disabled={
              contribute.isPending ||
              !Number.isInteger(amount) ||
              amount < 100 ||
              amount > 1000000 ||
              !wallet ||
              amount > wallet.balance
            }
            onClick={() => contribute.mutate(fund.id)}
          >
            {contribute.isPending
              ? "Saving…"
              : amount > (wallet?.balance ?? 0)
                ? "Insufficient cash"
                : `Contribute ${formatNaira(amount)}`}
          </button>
        </article>
      ))}
    </div>
  );
}

export function PhoneCommunityServices({ app }: { app: ServiceApp }) {
  if (app === "Calendar") return <CalendarApp />;
  if (app === "Food Delivery") return <FoodApp />;
  if (app === "Okada Rides") return <RidesApp />;
  return <ContributionApp />;
}

export default PhoneCommunityServices;
