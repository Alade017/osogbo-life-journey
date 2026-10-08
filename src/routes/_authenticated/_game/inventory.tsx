import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Backpack, GlassWater, Package, Shirt, Smartphone, type LucideIcon } from "lucide-react";
import { q } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Chip, ComingSoon, EmptyState, LoadingState, PageHeader } from "@/components/game/ui";

export const Route = createFileRoute("/_authenticated/_game/inventory")({
  head: () => pageMeta("Inventory", "Items your character carries around Osogbo."),
  component: InventoryPage,
});

const ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  backpack: Backpack,
  shirt: Shirt,
  "glass-water": GlassWater,
};
const TONES = ["bg-sun", "bg-leaf", "bg-sky", "bg-clay"];

function InventoryPage() {
  const { data: items, isLoading } = useQuery(q.inventory());
  if (isLoading) return <LoadingState />;
  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Using, buying and selling items is coming in a later phase."
        right={<ComingSoon>Shop</ComingSoon>}
      />
      {!items?.length ? (
        <EmptyState title="Empty backpack" body="You don't own any items yet." />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((pi, i) => {
            const Icon = ICONS[pi.item?.icon ?? ""] ?? Package;
            return (
              <div
                key={pi.id}
                className="game-panel pop-in p-4"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div
                  className={`game-panel-accent flex aspect-square items-center justify-center rounded-xl border-2 border-edge ${TONES[i % TONES.length]}`}
                >
                  <span className="rounded-xl border-2 border-edge bg-card p-3">
                    <Icon className="h-8 w-8" />
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-1">
                  <h3 className="font-bold">{pi.item?.name}</h3>
                  <Chip>×{pi.quantity}</Chip>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{pi.item?.description}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
