import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Shirt } from "lucide-react";
import { toast } from "sonner";
import { q, rpc, useGameAction } from "@/lib/game";
import { Button } from "@/components/ui/button";
import { validatePlayerAction } from "@/lib/player-action-service";
import { announceEquipmentRefresh, EQUIPMENT_SLOTS, filterEquippableInventoryForSlot, normalizeEquippedItems } from "@/lib/equipment-service";
import type { EquipmentSlot } from "@/lib/player-state";
import "@/components/game/profile-inventory.css";

export function CharacterWardrobePanel() {
  const inventoryQuery = useQuery(q.inventory());
  const characterQuery = useQuery(q.character());
  const equipmentQuery = useQuery(q.equipment());
  const [activeSlot, setActiveSlot] = useState<EquipmentSlot>("top");
  const equip = useGameAction(({ id, slot }: { id: string; slot: string }) => rpc.equipInventoryItem(id, slot), {
    onSuccess: () => { announceEquipmentRefresh(); toast.success("Your look has been updated."); },
  });
  const unequip = useGameAction(rpc.unequipItem, {
    onSuccess: () => { announceEquipmentRefresh(); toast.success("Item removed from your outfit."); },
  });
  if (inventoryQuery.isLoading || characterQuery.isLoading || equipmentQuery.isLoading) return <p className="pi-note">Loading your wardrobe…</p>;
  if (!inventoryQuery.data || !characterQuery.data || !equipmentQuery.data) return <p className="pi-note" role="alert">Your wardrobe could not be loaded. Try reopening Profile.</p>;
  const equipped = normalizeEquippedItems(equipmentQuery.data);
  const current = equipped.find((entry) => entry.slot === activeSlot);
  const options = filterEquippableInventoryForSlot(inventoryQuery.data, activeSlot);
  return (
    <section className="pi-wardrobe-editor" aria-label="Character appearance editor">
      <header><div><p className="pi-eyebrow">Character studio</p><h2>Change your look</h2><p>Choose owned clothing and accessories to update your saved outfit. Changes appear on your character throughout Osogbo.</p></div><span><Shirt size={22} /></span></header>
      <nav className="pi-wardrobe-slots" aria-label="Clothing and accessory slots">
        {EQUIPMENT_SLOTS.map((slot) => <button key={slot} type="button" aria-pressed={activeSlot === slot} onClick={() => setActiveSlot(slot)}>{slot}</button>)}
      </nav>
      <div className="pi-wardrobe-current"><span>Currently equipped</span><strong>{current?.item?.name ?? "Nothing equipped"}</strong>{current && <Button size="sm" variant="outline" disabled={unequip.isPending || !!validatePlayerAction({ action: "unequip", characterId: characterQuery.data.id, equippedItem: current, slot: activeSlot })} onClick={() => unequip.mutate(activeSlot)}>Remove</Button>}</div>
      <div className="pi-wardrobe-options">
        {options.length ? options.map((entry) => {
          const isCurrent = current?.item?.id === entry.item?.id;
          const validation = validatePlayerAction({ action: "equip", characterId: characterQuery.data.id, inventoryEntry: entry, slot: activeSlot });
          return <article key={entry.id} className="pi-wardrobe-option"><div><strong>{entry.item?.name ?? "Owned item"}</strong><small>Owned ×{entry.quantity}</small></div>{isCurrent ? <span className="pi-wardrobe-worn"><Check size={14} /> Wearing</span> : <Button size="sm" disabled={!!validation || equip.isPending} onClick={() => equip.mutate({ id: entry.id, slot: activeSlot })}>Wear</Button>}</article>;
        }) : <p className="pi-bag-empty">No owned items fit this slot yet. Items you acquire will appear here.</p>}
      </div>
    </section>
  );
}
