import { X } from "lucide-react";
import { drawerItemName, type DrawerInventoryRow, type DrawerState } from "@/lib/drawer";
import "./drawer-sheet.css";

type Props = {
  drawer: DrawerState | null;
  /** Wearables in the inventory that the player is not wearing right now. */
  storable: DrawerInventoryRow[];
  offline: boolean;
  pending: boolean;
  error: string | null;
  onStore: (inventoryId: string) => void;
  onRetrieve: (drawerId: string) => void;
  onEquip: (drawerId: string) => void;
  onClose: () => void;
};

export function DrawerSheet({
  drawer,
  storable,
  offline,
  pending,
  error,
  onStore,
  onRetrieve,
  onEquip,
  onClose,
}: Props) {
  const capacity = drawer?.capacity ?? 0;
  const stored = drawer?.items ?? [];
  const full = capacity > 0 && stored.length >= capacity;
  const disabled = offline || pending;

  return (
    <section className="drawer-sheet" role="dialog" aria-label="Drawer">
      <header className="drawer-sheet-head">
        <div>
          <strong>Drawer</strong>
          <small>
            {stored.length}/{capacity} stored
          </small>
        </div>
        <button type="button" aria-label="Close drawer" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      {error && (
        <p className="drawer-sheet-error" role="alert">
          {error}
        </p>
      )}

      <h3>In the drawer</h3>
      {stored.length === 0 ? (
        <p className="drawer-sheet-empty">
          Nothing stored yet. Clothes, caps and footwear go here.
        </p>
      ) : (
        <ul className="drawer-sheet-list">
          {stored.map((item) => (
            <li key={item.id}>
              <span>{drawerItemName(item.item_id)}</span>
              <span className="drawer-sheet-actions">
                <button type="button" disabled={disabled} onClick={() => onEquip(item.id)}>
                  Wear
                </button>
                <button type="button" disabled={disabled} onClick={() => onRetrieve(item.id)}>
                  Take out
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3>In your inventory</h3>
      {storable.length === 0 ? (
        <p className="drawer-sheet-empty">No spare clothes, caps or footwear to store.</p>
      ) : (
        <ul className="drawer-sheet-list">
          {storable.map((row) => (
            <li key={row.id}>
              <span>{drawerItemName(row.item_id)}</span>
              <button
                type="button"
                disabled={disabled || full}
                title={full ? "Your drawer is full" : undefined}
                onClick={() => onStore(row.id)}
              >
                Store
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
