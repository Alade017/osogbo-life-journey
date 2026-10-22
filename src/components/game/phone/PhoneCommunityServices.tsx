import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, q } from "@/lib/game";

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
type Order = { id: string; total_minor: number; status: string; created_at: string };
type Contribution = { id: string; fund_id: string; amount_minor: number };

// Migration 0060 is not yet represented in the generated Supabase types.
// Keep the temporary cast at the database boundary instead of spreading it through UI code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const phoneDb = supabase as any;

function usePhoneRows<T>(table: string, columns: string, orderBy?: string, ascending = false) {
  return useQuery({
    queryKey: ["phoneService", table],
    queryFn: async (): Promise<T[]> => {
      let request = phoneDb.from(table).select(columns);
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
      const { error } = await phoneDb.rpc("save_phone_event_reminder", {
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
    <div className="phone-service-screen">
      <header>
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
        <article className="phone-service-card" key={event.id}>
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

function FoodApp() {
  const client = useQueryClient();
  const vendors = usePhoneRows<Vendor>("food_vendors", "id,name");
  const menu = usePhoneRows<MenuItem>("food_menu_items", "id,name,price_minor,vendor_id");
  const orders = usePhoneRows<Order>(
    "food_orders",
    "id,total_minor,status,created_at",
    "created_at",
  );
  const walletQuery = useQuery(q.wallet());
  const wallet = walletQuery.data;
  const [vendorId, setVendorId] = useState("");
  const [basket, setBasket] = useState<Record<string, number>>({});
  const selectedVendorId = vendorId || vendors.data?.[0]?.id || "";
  const selectedItems = menu.data?.filter((item) => item.vendor_id === selectedVendorId) ?? [];
  const total = selectedItems.reduce(
    (sum, item) => sum + item.price_minor * (basket[item.id] ?? 0),
    0,
  );
  const order = useMutation({
    mutationFn: async () => {
      const { error } = await phoneDb.rpc("request_food_delivery", {
        p_vendor_id: selectedVendorId,
        p_items: selectedItems
          .filter((item) => basket[item.id])
          .map((item) => ({ menu_item_id: item.id, quantity: basket[item.id] })),
        p_request_id: crypto.randomUUID(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBasket({});
      void client.invalidateQueries({ queryKey: ["phoneService", "food_orders"] });
      void client.invalidateQueries({ queryKey: q.wallet().queryKey });
      void client.invalidateQueries({ queryKey: q.transactions().queryKey });
      toast.success("Food order placed.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="phone-service-screen">
      <header>
        <h2>Food delivery</h2>
        <p>Order from town kitchens</p>
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
          <select
            value={selectedVendorId}
            onChange={(event) => {
              setVendorId(event.target.value);
              setBasket({});
            }}
          >
            {vendors.data.map((vendor) => (
              <option value={vendor.id} key={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {selectedItems.map((item) => (
        <article className="phone-service-card phone-service-row" key={item.id}>
          <div>
            <h3>{item.name}</h3>
            <p>{formatNaira(item.price_minor)}</p>
          </div>
          <label>
            Qty
            <input
              aria-label={`${item.name} quantity`}
              type="number"
              min="0"
              max="20"
              value={basket[item.id] ?? 0}
              onChange={(event) =>
                setBasket((current) => ({
                  ...current,
                  [item.id]: Math.min(20, Math.max(0, Number(event.target.value) || 0)),
                }))
              }
            />
          </label>
        </article>
      ))}
      {!!selectedItems.length && (
        <div className="phone-service-checkout">
          <span>
            Total <strong>{formatNaira(total)}</strong>
          </span>
          <span>Cash {formatNaira(wallet?.balance ?? 0)}</span>
          <button
            type="button"
            disabled={!total || order.isPending || !wallet || total > wallet.balance}
            onClick={() => order.mutate()}
          >
            {order.isPending
              ? "Ordering…"
              : total > (wallet?.balance ?? 0)
                ? "Insufficient cash"
                : "Place order"}
          </button>
        </div>
      )}
      <h3 className="phone-service-subheading">Recent orders</h3>
      <StateMessage
        loading={orders.isLoading}
        error={orders.isError}
        empty={!orders.data?.length}
        retry={() => void orders.refetch()}
      />
      {orders.data?.slice(0, 5).map((item) => (
        <article className="phone-service-card phone-service-row" key={item.id}>
          <span>{new Date(item.created_at).toLocaleDateString("en-NG")}</span>
          <strong>
            {formatNaira(item.total_minor)} · {item.status}
          </strong>
        </article>
      ))}
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
      const { error } = await phoneDb.rpc("request_okada_ride", {
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
      toast.success("Ride requested.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="phone-service-screen">
      <header>
        <h2>Okada rides</h2>
        <p>Request a town trip</p>
      </header>
      <StateMessage
        loading={price.isLoading}
        error={price.isError}
        empty={!fare}
        retry={() => void price.refetch()}
      />
      {walletQuery.isError && (
        <p role="alert" className="phone-service-state">
          Cash balance is unavailable. Try reopening this app.
        </p>
      )}
      {!!fare && (
        <div className="phone-service-card">
          <p>Current fare</p>
          <h3>{formatNaira(fare)}</h3>
          <label className="phone-service-field">
            Destination
            <input
              maxLength={120}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Where are you going?"
            />
          </label>
          <button
            type="button"
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
        </div>
      )}
      <h3 className="phone-service-subheading">Your rides</h3>
      <StateMessage
        loading={rides.isLoading}
        error={rides.isError}
        empty={!rides.data?.length}
        retry={() => void rides.refetch()}
      />
      {rides.data?.slice(0, 5).map((ride) => (
        <article className="phone-service-card phone-service-row" key={ride.id}>
          <span>
            {ride.destination}
            <small>{new Date(ride.created_at).toLocaleDateString("en-NG")}</small>
          </span>
          <strong>{ride.status}</strong>
        </article>
      ))}
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
      const { error } = await phoneDb.rpc("contribute_to_community_fund", {
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
    <div className="phone-service-screen">
      <header>
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
        <article className="phone-service-card" key={fund.id}>
          <h3>{fund.title}</h3>
          <p>Goal: {formatNaira(fund.goal_minor)}</p>
          <p>
            Your contributions:{" "}
            {formatNaira(
              contributions.data
                ?.filter((item) => item.fund_id === fund.id)
                .reduce((sum, item) => sum + item.amount_minor, 0) ?? 0,
            )}
          </p>
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
