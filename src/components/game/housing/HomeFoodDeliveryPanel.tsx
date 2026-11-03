import { PackageCheck, PackageOpen, Truck } from "lucide-react";
import type { FoodDelivery } from "@/lib/food-delivery-service";

type Props = {
  deliveries: FoodDelivery[];
  error: boolean;
  responsePending: boolean;
  collectionPending: boolean;
  onRetry: () => void;
  onRespond: (orderId: string, choice: "inside" | "outside") => void;
  onCollect: (orderId: string) => void;
};

export function HomeFoodDeliveryPanel({
  deliveries,
  error,
  responsePending,
  collectionPending,
  onRetry,
  onRespond,
  onCollect,
}: Props) {
  const waitingCourier = deliveries.find(
    (delivery) => delivery.deliveryState === "awaiting_response",
  );
  const approachingCourier = deliveries.find(
    (delivery) => delivery.deliveryState === "approaching",
  );
  const waitingPackages = deliveries.filter(
    (delivery) => delivery.deliveryState === "package_waiting",
  );

  if (!error && !waitingCourier && !approachingCourier && waitingPackages.length === 0) return null;

  return (
    <aside className="house-delivery-overlay" aria-live="polite">
      {error && (
        <div className="house-delivery-card" role="alert">
          <p>Delivery updates are unavailable.</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
      {waitingCourier && (
        <div className="house-delivery-card">
          <strong>
            <Truck size={16} aria-hidden="true" /> Your food is here
          </strong>
          <p>
            {waitingCourier.vendorName} ·{" "}
            {waitingCourier.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}
          </p>
          <div className="house-delivery-actions">
            <button
              type="button"
              disabled={responsePending}
              onClick={() => onRespond(waitingCourier.id, "inside")}
            >
              Invite inside
            </button>
            <button
              type="button"
              disabled={responsePending}
              onClick={() => onRespond(waitingCourier.id, "outside")}
            >
              Receive outside
            </button>
          </div>
        </div>
      )}
      {approachingCourier && (
        <div className="house-delivery-card">
          <strong>
            <Truck size={16} aria-hidden="true" /> Food handoff in progress
          </strong>
          <p>
            {approachingCourier.vendorName} ·{" "}
            {approachingCourier.items.map((item) => item.name).join(", ")}
          </p>
        </div>
      )}
      {waitingPackages.slice(0, 4).map((delivery) => (
        <div className="house-delivery-card" key={delivery.id}>
          <strong>
            <PackageOpen size={16} aria-hidden="true" /> {delivery.vendorName}
          </strong>
          <p>{delivery.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</p>
          <button
            className="house-delivery-collect"
            type="button"
            disabled={collectionPending}
            onClick={() => onCollect(delivery.id)}
          >
            <PackageCheck size={16} aria-hidden="true" /> Collect package
          </button>
        </div>
      ))}
    </aside>
  );
}
