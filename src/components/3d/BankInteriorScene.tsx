import { useMemo } from "react";
import { BANK_INTERIORS, type BankInteriorVariant } from "@/game/bank-interiors";
import { buildBankWorld } from "@/game/bank-world-layout";
import type { VenueFixture } from "@/lib/location-venue-designs";
import { ProceduralBankArchitecture } from "./ProceduralBankArchitecture";

/** Embedded venue callers share the same authored hall, fitted to their existing room bounds. */
export function BankInteriorScene({
  variant,
  fixtures,
  selected,
  onSelect,
  onWalk,
}: {
  variant: BankInteriorVariant;
  fixtures: readonly VenueFixture[];
  selected: string;
  onSelect: (id: string) => void;
  onWalk: (point: [number, number]) => void;
  floorColor: string;
  wallColor: string;
  accentColor: string;
}) {
  const branch = variant === "teller-hall" ? "cedar-bank" : "meridian-bank";
  const world = useMemo(() => buildBankWorld(branch, "hall"), [branch]);
  const bounds = BANK_INTERIORS[variant];
  const selectedKind = fixtures.find((item) => item.id === selected)?.kind;
  const active = world.fixtures.find(
    (item) => item.action === (selectedKind === "seat" ? "seat" : "teller"),
  );
  return (
    <group
      name={variant === "teller-hall" ? "bank-teller-hall" : "bank-digital-lounge"}
      scale={[bounds.width / world.width, 0.65, bounds.depth / world.depth]}
    >
      <ProceduralBankArchitecture
        branch={branch}
        layout={world}
        onWalk={(point) => onWalk([point[0], point[2]])}
        onSelect={(id) => {
          const target = world.fixtures.find((item) => item.id === id);
          const fixture = fixtures.find(
            (item) => item.kind === (target?.action === "seat" ? "seat" : "counter"),
          );
          if (fixture && (target?.action === "seat" || target?.action === "teller"))
            onSelect(fixture.id);
        }}
      />
      {selected && active && (
        <mesh position={[active.point[0], 0.025, active.point[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.8, 24]} />
          <meshBasicMaterial color="#528fd4" />
        </mesh>
      )}
    </group>
  );
}
