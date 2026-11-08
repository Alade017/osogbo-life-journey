import { useEffect, useState } from "react";
import {
  Archive,
  Armchair,
  ChevronDown,
  ChevronUp,
  Bath,
  BedDouble,
  CookingPot,
  LayoutGrid,
  Lightbulb,
  Monitor,
  Package,
  Palette,
  Search,
  Shirt,
  X,
} from "lucide-react";
import { formatNaira } from "@/lib/game";
import { homeFurnitureAction } from "@/lib/home-furniture-actions";
import { ACTION_CATALOG } from "@/lib/life-simulation";
import { hasItemModel } from "@/components/3d/ItemPreview3D";
import type { HouseInventoryItem, HousePlacement } from "./HouseRoomScene";
import { CatalogThumbnailQueue, requestCatalogThumb, useCatalogThumb } from "./CatalogThumbnail";

export type CatalogItem = {
  id: string;
  category: string;
  slot_type: string;
  art_key: string;
  price_minor: number;
};

type Props = {
  open: boolean;
  offline: boolean;
  pending: boolean;
  cash: number | null;
  inventory: HouseInventoryItem[];
  catalog: CatalogItem[];
  placements: HousePlacement[];
  onOpen: () => void;
  onClose: () => void;
  onBuy: (itemId: string) => void;
  onPlaceOwned: (itemId: string) => void;
};

const itemName = (id: string) => id.replaceAll("-", " ");

// Category rail: each entry groups the item types the catalogue uses.
const RAIL = [
  { id: "all", label: "All", icon: LayoutGrid, types: null },
  { id: "sleep", label: "Sleep", icon: BedDouble, types: ["bed"] },
  { id: "storage", label: "Storage", icon: Archive, types: ["storage"] },
  { id: "seats", label: "Seats", icon: Armchair, types: ["seat"] },
  { id: "kitchen", label: "Kitchen", icon: CookingPot, types: ["kitchen"] },
  { id: "styles", label: "Styles", icon: Palette, types: ["decor", "plant"] },
  { id: "light", label: "Light", icon: Lightbulb, types: ["light"] },
  { id: "bath", label: "Bath", icon: Bath, types: ["bathroom"] },
  { id: "tech", label: "Tech", icon: Monitor, types: ["device", "table"] },
] as const;

function ItemImage({ item }: { item: CatalogItem }) {
  const key =
    item.category === "furniture"
      ? item.art_key
        ? `furniture:${item.art_key}`
        : null
      : hasItemModel(item.id)
        ? `item:${item.id}`
        : null;
  const thumb = useCatalogThumb(key);
  useEffect(() => {
    if (key) requestCatalogThumb(key);
  }, [key]);

  if (!thumb)
    return (
      <span className="house-catalogue-image" aria-hidden="true">
        {item.category === "furniture" ? <Package size={26} /> : <Shirt size={26} />}
      </span>
    );
  return <img className="house-catalogue-image" src={thumb} alt="" />;
}

export function HouseCatalogue({
  open,
  offline,
  pending,
  cash,
  inventory,
  catalog,
  placements,
  onOpen,
  onClose,
  onBuy,
  onPlaceOwned,
}: Props) {
  const [railId, setRailId] = useState<(typeof RAIL)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [affordableOnly, setAffordableOnly] = useState(false);
  // Minimised, the panel is only its title bar, so the room underneath stays reachable.
  // Narrow screens start minimised so the room is never covered when the catalogue opens.
  const [minimized, setMinimized] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 1023px)").matches,
  );

  if (!open) {
    return (
      <button type="button" className="house-catalogue-fab" onClick={onOpen}>
        <LayoutGrid size={16} aria-hidden="true" />
        Catalogue
      </button>
    );
  }

  const rail = RAIL.find((entry) => entry.id === railId) ?? RAIL[0];
  const search = query.trim().toLowerCase();
  const shown = catalog
    .filter((item) => item.category === "furniture" && item.price_minor > 0)
    .filter((item) => !rail.types || (rail.types as readonly string[]).includes(item.slot_type))
    .filter(
      (item) => !search || `${itemName(item.id)} ${item.slot_type}`.toLowerCase().includes(search),
    )
    .filter((item) => !affordableOnly || cash === null || cash >= item.price_minor);

  const ownedQuantity = (itemId: string) =>
    inventory
      .filter((item) => item.item_id === itemId)
      .reduce((total, item) => total + (item.quantity ?? 1), 0);
  const placedCount = (itemId: string) =>
    placements.filter((placement) => placement.item_id === itemId).length;

  return (
    <section
      className={minimized ? "house-catalogue house-catalogue--minimized" : "house-catalogue"}
      role="dialog"
      aria-label="Catalogue"
    >
      <CatalogThumbnailQueue />
      <header className="house-catalogue-header">
        <h2>Catalogue</h2>
        <div className="house-catalogue-header-actions">
          <button
            type="button"
            className="house-icon-button"
            onClick={() => setMinimized((value) => !value)}
            aria-expanded={!minimized}
            aria-label={minimized ? "Show catalogue" : "Minimise catalogue"}
          >
            {minimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button
            type="button"
            className="house-icon-button"
            onClick={onClose}
            aria-label="Close catalogue"
          >
            <X size={18} />
          </button>
        </div>
      </header>
      <label className="house-catalogue-search">
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">Search the catalogue</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chairs, beds, tables…"
        />
      </label>
      <div className="house-catalogue-filters" role="group" aria-label="Price">
        <button
          type="button"
          aria-pressed={!affordableOnly}
          onClick={() => setAffordableOnly(false)}
        >
          Any price
        </button>
        <button type="button" aria-pressed={affordableOnly} onClick={() => setAffordableOnly(true)}>
          I can afford
        </button>
      </div>
      <div className="house-catalogue-body">
        <nav className="house-catalogue-rail" aria-label="Categories">
          {RAIL.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={railId === entry.id}
                onClick={() => setRailId(entry.id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{entry.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="house-catalogue-grid" aria-label={`${rail.label} items`}>
          {shown.length === 0 && <p className="house-empty-copy">Nothing matches here yet.</p>}
          {shown.map((item) => {
            const owned = ownedQuantity(item.id);
            const unplaced = owned - placedCount(item.id);
            const activity = homeFurnitureAction(item.id);
            const cannotAfford = owned === 0 && cash !== null && cash < item.price_minor;
            return (
              <article className="house-catalogue-card" key={item.id}>
                <ItemImage item={item} />
                <strong>{itemName(item.id)}</strong>
                <small>{item.slot_type}</small>
                {activity && (
                  <small className="house-item-task">{ACTION_CATALOG[activity].name}</small>
                )}
                <small className="house-catalog-price">{formatNaira(item.price_minor)}</small>
                {cannotAfford && (
                  <small className="house-catalog-unaffordable">Insufficient funds</small>
                )}
                {unplaced > 0 ? (
                  <button
                    type="button"
                    className="house-catalogue-action"
                    disabled={offline || pending}
                    onClick={() => onPlaceOwned(item.id)}
                  >
                    Place
                  </button>
                ) : owned > 0 ? (
                  <small className="house-owned-badge">Placed</small>
                ) : (
                  <button
                    type="button"
                    className="house-catalogue-action"
                    disabled={offline || pending || cannotAfford}
                    onClick={() => onBuy(item.id)}
                  >
                    Buy
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
