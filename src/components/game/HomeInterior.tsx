import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  CookingPot,
  Gamepad2,
  Lightbulb,
  Sofa,
  DoorOpen,
  Hammer,
  RotateCw,
  X,
  Sparkles,
} from "lucide-react";
import { Avatar } from "@/components/game/Avatar";
import {
  canPlace,
  DEFAULT_HOUSING_SAVE,
  findPath,
  FURNITURE_CATALOG,
  HOME_LAYOUTS,
  type HousingSave,
  type PlacedFurniture,
  type RoomId,
} from "@/lib/housing-service";
import { parseHousingSave } from "@/lib/housing-service";
import { readLocalHousingSave, writeLocalHousingSave } from "@/lib/save-storage";
import type { HouseRoomId } from "@/components/game/housing/HouseScene";

const HouseScene = import.meta.env.SSR
  ? (_props: {
      selectedRoom: HouseRoomId;
      lightsOn: boolean;
      onSelectRoom: (room: HouseRoomId) => void;
    }) => (
      <div className="house-scene house-scene-loading" role="status">
        Preparing your home...
      </div>
    )
  : lazy(() =>
      import("@/components/game/housing/HouseScene").then((module) => ({
        default: module.HouseScene,
      })),
    );

const ROOM_ICONS = {
  lounge: Sofa,
  den: Gamepad2,
  kitchen: CookingPot,
  bedroom: BedDouble,
  bathroom: Sparkles,
  study: Hammer,
  dining: Sofa,
};
const SAVE_KEY = "osogbo-life-housing-v1";
type Props = {
  balance?: number;
  saveKey?: string;
  initialSave?: HousingSave;
  onSave?: (save: HousingSave) => void;
  powerAvailable?: boolean;
};

function loadSave(key: string): HousingSave {
  if (typeof window === "undefined") return DEFAULT_HOUSING_SAVE;
  return readLocalHousingSave(key)?.payload ?? DEFAULT_HOUSING_SAVE;
}

export function HomeInterior({
  balance = 5000,
  saveKey = SAVE_KEY,
  initialSave,
  onSave,
  powerAvailable = true,
}: Props) {
  const [saved, setSaved] = useState(() => initialSave ?? loadSave(saveKey));
  const onSaveRef = useRef(onSave);
  const [inside, setInside] = useState(false);
  const [lightsOn, setLightsOn] = useState(true);
  const [buildMode, setBuildMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [previewRotation, setPreviewRotation] = useState<0 | 90 | 180 | 270>(0);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [target, setTarget] = useState<[number, number] | null>(null);
  const [notice, setNotice] = useState("");
  const [category, setCategory] = useState("all");
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  const layout = HOME_LAYOUTS.find((entry) => entry.id === saved.layoutId) ?? HOME_LAYOUTS[1]!;
  const room = layout.rooms.find((entry) => entry.id === saved.room) ?? layout.rooms[0]!;
  const usableFurniture = useMemo(
    () => saved.furniture.filter((item) => item.room === room.id),
    [saved.furniture, room.id],
  );
  const chosenItem = FURNITURE_CATALOG.find((item) => item.id === selectedItem);
  const blocked = useMemo(() => {
    const cells = new Set<string>();
    for (const placed of usableFurniture) {
      const item = FURNITURE_CATALOG.find((entry) => entry.id === placed.itemId);
      if (!item) continue;
      const w = placed.rotation % 180 ? item.height : item.width;
      const h = placed.rotation % 180 ? item.width : item.height;
      for (let y = placed.y; y < placed.y + h; y++)
        for (let x = placed.x; x < placed.x + w; x++) cells.add(`${x},${y}`);
    }
    return cells;
  }, [usableFurniture]);
  const save = (next: HousingSave) => {
    const validated = parseHousingSave(next);
    if (!validated) {
      setNotice("That home change could not be saved safely.");
      return;
    }
    setSaved(validated);
    if (typeof window !== "undefined") {
      const stored = writeLocalHousingSave(saveKey, validated);
      if (!stored)
        setNotice("Browser storage is unavailable. Your cloud save will still be attempted.");
      window.dispatchEvent(new Event("osogbo-life-home-changed"));
    }
    onSaveRef.current?.(validated);
  };
  useEffect(() => {
    if (!target || buildMode) return;
    const path = findPath(room.width, room.height, [saved.x, saved.y], target, blocked);
    if (!path) {
      setNotice("There is no clear path to that spot.");
      setTarget(null);
      return;
    }
    let step = 0;
    const timer = window.setInterval(() => {
      const point = path[step++];
      if (!point) {
        window.clearInterval(timer);
        setTarget(null);
        return;
      }
      setSaved((current) => {
        const next = { ...current, x: point[0], y: point[1] };
        const validated = parseHousingSave(next);
        if (validated) {
          writeLocalHousingSave(saveKey, validated);
          onSaveRef.current?.(validated);
          window.dispatchEvent(new Event("osogbo-life-home-changed"));
          return validated;
        }
        return current;
      });
    }, 170);
    return () => window.clearInterval(timer);
  }, [target, room, saved.x, saved.y, blocked, buildMode, saveKey]);
  const visitRoom = (nextRoom: RoomId) => {
    if (!room.connections.includes(nextRoom) && room.id !== nextRoom) {
      setNotice("That room is not connected from here.");
      return;
    }
    const def = layout.rooms.find((entry) => entry.id === nextRoom);
    if (!def) return;
    save({ ...saved, room: nextRoom, x: Math.floor(def.width / 2), y: Math.floor(def.height / 2) });
    setNotice(`Entered ${def.name}.`);
  };
  const placeAt = (x: number, y: number) => {
    if (!buildMode) {
      setTarget([x, y]);
      return;
    }
    if (movingItemId) {
      const existing = saved.furniture.find((entry) => entry.id === movingItemId);
      const item = existing && FURNITURE_CATALOG.find((entry) => entry.id === existing.itemId);
      if (!existing || !item) return;
      const moved = { ...existing, x, y, rotation: previewRotation };
      if (!canPlace(room, item, x, y, saved.furniture, existing.id, previewRotation)) {
        setNotice("That footprint is blocked or outside the room.");
        return;
      }
      save({
        ...saved,
        furniture: saved.furniture.map((entry) => (entry.id === existing.id ? moved : entry)),
      });
      setMovingItemId(null);
      setPreviewRotation(0);
      setNotice(`${item.name} moved.`);
      return;
    }
    if (!chosenItem) return;
    const valid = canPlace(room, chosenItem, x, y, saved.furniture, undefined, previewRotation);
    if (!valid) {
      setNotice("That footprint is blocked or outside the room.");
      return;
    }
    if (balance < chosenItem.price) {
      setNotice("You need more Naira for this item.");
      return;
    }
    const placed: PlacedFurniture = {
      id: `${chosenItem.id}-${Date.now()}`,
      itemId: chosenItem.id,
      room: room.id,
      x,
      y,
      rotation: previewRotation,
    };
    save({ ...saved, furniture: [...saved.furniture, placed] });
    setNotice(`${chosenItem.name} placed. Payment will be enabled with home services.`);
    setSelectedItem(null);
    setPreviewRotation(0);
  };
  const rotatePreview = () => {
    if (!selectedItem && !movingItemId) return;
    setPreviewRotation((current) => ((current + 90) % 360) as 0 | 90 | 180 | 270);
  };
  const interact = (placed: PlacedFurniture) => {
    const item = FURNITURE_CATALOG.find((entry) => entry.id === placed.itemId);
    if (!item) return;
    if (!powerAvailable && ["stove", "computer", "television"].includes(placed.itemId)) {
      setNotice(
        `${item.name} is unavailable during the outage. Rest, hygiene, and other home activities still work.`,
      );
      return;
    }
    const delta = item.effects;
    const needs = { ...saved.needs };
    for (const [key, value] of Object.entries(delta))
      needs[key] = Math.min(100, (needs[key] ?? 0) + (value ?? 0));
    save({ ...saved, needs });
    setNotice(
      `${item.name}: ${Object.keys(delta)
        .map((key) => `${key} +${delta[key as keyof typeof delta]}`)
        .join(" · ")}`,
    );
  };
  const storeItem = (placed: PlacedFurniture) => {
    save({
      ...saved,
      furniture: saved.furniture.filter((item) => item.id !== placed.id),
      storage: [...saved.storage, placed.itemId],
    });
    setNotice("Furniture stored safely.");
  };
  const exitHome = () => {
    save({ ...saved, room: layout.rooms[0]!.id });
    setInside(false);
    setNotice("You stepped outside at your saved city location.");
  };
  const currentIcon = ROOM_ICONS[room.id] ?? Sofa;
  const RoomIcon = currentIcon;

  return (
    <section className="home-interior" aria-labelledby="home-interior-title">
      <div className="home-interior-heading">
        <div>
          <p className="home-interior-eyebrow">YOUR PLACE IN OSOGBO</p>
          <h2 id="home-interior-title">{inside ? layout.name : "Make yourself at home"}</h2>
          <p>
            {inside
              ? "Tap a clear floor tile to walk. Use connected doors to move between rooms."
              : "Choose a starter home layout, then step inside to explore and furnish it."}
          </p>
        </div>
        <button
          type="button"
          className="home-lights-toggle"
          aria-pressed={powerAvailable && lightsOn}
          disabled={!powerAvailable}
          onClick={() => setLightsOn((on) => !on)}
        >
          <Lightbulb size={16} />
          {!powerAvailable ? "Power outage" : lightsOn ? "Lights on" : "Lights off"}
        </button>
      </div>
      {!inside ? (
        <div className="housing-layout-picker">
          {HOME_LAYOUTS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={option.id === layout.id ? "is-active" : ""}
              onClick={() =>
                save({
                  ...saved,
                  layoutId: option.id,
                  room: option.rooms[0]!.id,
                  x: Math.floor(option.rooms[0]!.width / 2),
                  y: Math.floor(option.rooms[0]!.height / 2),
                })
              }
            >
              <span>{option.propertyType}</span>
              <strong>{option.name}</strong>
              <small>{option.description}</small>
              <small>
                {option.rooms.length} rooms · {option.rooms.map((entry) => entry.name).join(" · ")}
              </small>
            </button>
          ))}
        </div>
      ) : null}
      <div className="home-interior-layout house-interior-layout">
        <div className="house-view-column">
          {inside && (
            <nav className="house-room-switcher" aria-label="Connected rooms">
              {layout.rooms.map((entry) => {
                const Icon = ROOM_ICONS[entry.id] ?? Sofa;
                const connected = entry.id === room.id || room.connections.includes(entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={entry.id === room.id ? "is-active" : ""}
                    disabled={!connected}
                    aria-pressed={entry.id === room.id}
                    onClick={() => visitRoom(entry.id)}
                  >
                    <Icon size={16} />
                    <span>{entry.name}</span>
                  </button>
                );
              })}
            </nav>
          )}
          <Suspense
            fallback={
              <div className="house-scene house-scene-loading" role="status">
                Preparing your home...
              </div>
            }
          >
            <HouseScene
              selectedRoom={room.id as HouseRoomId}
              lightsOn={lightsOn}
              onSelectRoom={(id) =>
                inside ? visitRoom(id as RoomId) : save({ ...saved, room: id as RoomId })
              }
            />
          </Suspense>
          {inside && (
            <div className="walkable-room" aria-label={`${room.name} walkable floor`}>
              <div className="walkable-room-head">
                <strong>{room.name}</strong>
                <span>
                  {room.width} × {room.height} floor grid
                </span>
              </div>
              <div
                className="walkable-grid"
                style={{ gridTemplateColumns: `repeat(${room.width}, minmax(30px, 1fr))` }}
              >
                {Array.from({ length: room.width * room.height }, (_, index) => {
                  const x = index % room.width;
                  const y = Math.floor(index / room.width);
                  const f = usableFurniture.find((entry) => {
                    const item = FURNITURE_CATALOG.find((it) => it.id === entry.itemId);
                    return (
                      item &&
                      x >= entry.x &&
                      x < entry.x + (entry.rotation % 180 ? item.height : item.width) &&
                      y >= entry.y &&
                      y < entry.y + (entry.rotation % 180 ? item.width : item.height)
                    );
                  });
                  const isPlayer = saved.x === x && saved.y === y;
                  const furniture = f && FURNITURE_CATALOG.find((it) => it.id === f.itemId);
                  return (
                    <button
                      type="button"
                      key={`${x}-${y}`}
                      className={`walkable-cell ${blocked.has(`${x},${y}`) ? "is-blocked" : ""} ${isPlayer ? "has-player" : ""} ${buildMode && chosenItem && canPlace(room, chosenItem, x, y, saved.furniture) ? "is-valid" : ""}`}
                      aria-label={`${x + 1}, ${y + 1}${furniture ? ` ${furniture.name}` : " floor"}`}
                      onClick={() =>
                        f && buildMode
                          ? setMovingItemId(f.id)
                          : f && !buildMode
                            ? interact(f)
                            : placeAt(x, y)
                      }
                    >
                      {isPlayer ? (
                        <span className="home-player-avatar">
                          <Avatar size={34} appearance={{}} />
                        </span>
                      ) : furniture ? (
                        <>
                          <span>{furniture.icon}</span>
                          {buildMode && (
                            <span className="furniture-actions">
                              <i
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setMovingItemId(f.id);
                                  setPreviewRotation(f.rotation);
                                }}
                                title="Move"
                              >
                                ↔
                              </i>
                              <i
                                onClick={(event) => {
                                  event.stopPropagation();
                                  storeItem(f);
                                }}
                                title="Store"
                              >
                                ×
                              </i>
                              <i
                                onClick={(event) => {
                                  event.stopPropagation();
                                  save({
                                    ...saved,
                                    furniture: saved.furniture.filter((entry) => entry.id !== f.id),
                                  });
                                  setNotice("Furniture sold. Refunds require the home service.");
                                }}
                                title="Sell"
                              >
                                $
                              </i>
                            </span>
                          )}
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="walk-hint">
                {buildMode
                  ? "Choose an item, then a valid tile. Select existing furniture to move/store/sell."
                  : "Tap an open tile to walk · Tap furniture to use it"}
              </p>
            </div>
          )}
        </div>
        <aside className="home-room-detail house-room-detail" aria-live="polite">
          <div className="home-room-detail-top">
            <span className="home-room-detail-icon">
              <RoomIcon size={19} />
            </span>
            <span className="home-room-detail-caption">
              {inside ? "ROOM & CHARACTER" : "HOME OVERVIEW"}
            </span>
          </div>
          <h3>{inside ? room.name : layout.name}</h3>
          <p className="home-room-description">
            {inside
              ? `Move around the ${room.name.toLowerCase()} and use owned furniture. The room has ${room.upgrades.length} upgrade options.`
              : layout.description}
          </p>
          {inside ? (
            <div className="home-needs">
              {Object.entries(saved.needs)
                .filter(([key]) => key !== "skill")
                .map(([key, value]) => (
                  <div key={key}>
                    <span>{key}</span>
                    <progress value={value} max={100} />
                    <b>{value}</b>
                  </div>
                ))}
            </div>
          ) : (
            <div className="house-milestone-note">
              <span className="house-milestone-status">
                <i /> STARTER HOME
              </span>
              <p>
                Property acquisition remains separate from furniture purchases. This room layout is
                a playable home template.
              </p>
            </div>
          )}
          {inside && (
            <div className="home-build-tools">
              <button
                type="button"
                className={buildMode ? "is-active" : ""}
                onClick={() => {
                  setBuildMode((v) => !v);
                  setSelectedItem(null);
                }}
              >
                <Hammer size={16} />
                {buildMode ? "Finish building" : "Build mode"}
              </button>
              <button type="button" onClick={exitHome}>
                <DoorOpen size={16} />
                Leave home
              </button>
            </div>
          )}
          {inside && buildMode && (
            <div className="home-catalog">
              <div className="catalog-filter">
                <label htmlFor="furniture-category">Catalog</label>
                <select
                  id="furniture-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="all">All items</option>
                  {[...new Set(FURNITURE_CATALOG.map((item) => item.category))].map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
              </div>
              {FURNITURE_CATALOG.filter(
                (item) => category === "all" || item.category === category,
              ).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={selectedItem === item.id ? "selected" : ""}
                  onClick={() => {
                    setSelectedItem(item.id);
                    setMovingItemId(null);
                    setPreviewRotation(0);
                  }}
                >
                  <span>{item.icon}</span>
                  <strong>{item.name}</strong>
                  <small>
                    ₦{item.price.toLocaleString()} · {item.width}×{item.height}
                  </small>
                </button>
              ))}
              <button type="button" onClick={rotatePreview}>
                <RotateCw size={14} />
                Rotate {previewRotation}°
              </button>
              {(selectedItem || movingItemId) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItem(null);
                    setMovingItemId(null);
                  }}
                >
                  <X size={14} />
                  Cancel placement
                </button>
              )}
            </div>
          )}
          {inside && (
            <div className="home-upgrades">
              <strong>Home upgrades</strong>
              {room.upgrades.map((upgrade) => (
                <button
                  type="button"
                  key={upgrade}
                  className={saved.upgrades.includes(`${layout.id}:${upgrade}`) ? "is-owned" : ""}
                  onClick={() => {
                    const id = `${layout.id}:${upgrade}`;
                    if (saved.upgrades.includes(id)) return;
                    if (balance < 500) {
                      setNotice("You need ₦500 for this upgrade.");
                      return;
                    }
                    save({ ...saved, upgrades: [...saved.upgrades, id] });
                    setNotice(`${upgrade} upgrade added.`);
                  }}
                >
                  {saved.upgrades.includes(`${layout.id}:${upgrade}`) ? "✓ " : "+ "}
                  {upgrade} · ₦500
                </button>
              ))}
            </div>
          )}
          <div className="home-room-footnote">
            <span />
            {!powerAvailable
              ? "Power is out · natural light and essential activities remain available"
              : lightsOn
                ? "Warm daylight is filling the house"
                : "Ambient lighting dimmed"}
          </div>
        </aside>
      </div>
      {!inside && (
        <button
          type="button"
          className="home-enter-button"
          onClick={() => {
            const first = layout.rooms[0]!;
            save({
              ...saved,
              room: first.id,
              x: Math.floor(first.width / 2),
              y: Math.floor(first.height / 2),
            });
            setInside(true);
            setNotice("Welcome home. You are at the entrance.");
          }}
        >
          Enter home <DoorOpen size={17} />
        </button>
      )}
      {notice && (
        <div className="housing-notice" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
    </section>
  );
}
