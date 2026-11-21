# Wearable outfits

The stylized semi-realistic low-poly male and female models share the existing animation rig. Tops now support fitted short- and long-sleeved geometry. Clothes use the body's skin weights, and covered skin triangles are omitted from the dressed render. Default dressed male/female models are tested against a 10,000-triangle ceiling for both sleeve cuts; additional hair/headwear/equipment can add geometry.

Inventory → Wardrobe previews owned clothing on a rotatable model. Wear equips through the existing server-owned `equip_inventory_item` RPC. Replacing an item returns the previous one to the bag; removing it restores the saved starter appearance for that slot. Base skin, face, hair, height and build are unchanged. All clothing slots compose independently. Previewing never grants ownership or equips anything.

Migration `0109_wearable_outfits.sql` adds cream tees, indigo Adire shirts, terracotta long sleeves, charcoal trousers and cream trainers to existing clothing shops. Prices, stock and equip permissions remain database-owned. The identical Supabase migration is `20261118193000_wearable_outfits.sql`; use the configured migration path, not both manually. Number 0108 is reserved by the independent stall-management branch. This migration does not depend on that stall change.

Bounded item `effects.wearable` metadata controls slot colour, top cut and optional Adire pattern. Invalid colours, wrong slots and unknown styling fields are ignored. Existing basic outfit equipment has a legacy visual fallback. Crafted wrappers/scarves are still sellable cloth, separate from these wearable shirts.

The same resolver drives 2D avatars, 3D previews and world characters. The multiplayer server now reads equipped item cosmetics from Supabase under its existing player authentication, then projects only public slot/slug/style fields. Inventory IDs, owner IDs, prices and unrelated effects never enter that projection. Existing equipment refresh messages re-read the authoritative state; the multiplayer server must be redeployed for other clients to receive the new cosmetics. Saved clothed state is now retained at the world appearance boundary.

Tests cover all presentations, independent slots, restoring base looks, unsafe metadata, multiplayer projection, actual database purchases/equipping/replacement/removal and foreign ownership rejection, sleeve geometry, dressed triangle budget and existing animation coverage. Hosted migration execution and live multiplayer/mobile appearance checks are not performed in this workspace.
