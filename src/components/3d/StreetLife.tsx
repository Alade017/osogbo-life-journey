import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import {
  advanceTrafficCar,
  trafficCarPoint,
  trafficCarRotation,
  type TrafficCar,
} from "@/game/neighborhood-dressing";
import type { WorldPoint } from "@/game/neighborhood-model";
import { createWalkers, stepWalker, WALK_SPEED, type Walker } from "@/game/street-walkers";
import { WorldCars, WorldPeople } from "@/components/3d/WorldScene";

/** Cars drive at this many street units per second. */
const CAR_SPEED = 22;

/**
 * Cars that drive along their lanes and people who walk the footpaths. Each frame moves the
 * existing nodes directly, so React renders do not reset their positions.
 */
export function StreetLife({
  cars,
  people,
  toWorld,
  carSize,
}: {
  cars: readonly TrafficCar[];
  people: readonly WorldPoint[];
  toWorld: (x: number, y: number) => [number, number, number];
  carSize: number;
}) {
  const walkers = useMemo(() => createWalkers(people), [people]);
  // Starting points are computed once per street; later frames only move the nodes.
  const carOrigins = useMemo(
    () =>
      cars.map((car) => {
        const p = trafficCarPoint(car);
        return toWorld(p.x, p.y);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cars],
  );
  const walkerOrigins = useMemo(
    () => walkers.map((walker) => toWorld(walker.x, walker.y)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walkers],
  );
  const carState = useRef<TrafficCar[]>([...cars]);
  const walkerState = useRef<Walker[]>(walkers);
  const carNodes = useRef<(Group | null)[]>([]);
  const walkerNodes = useRef<(Group | null)[]>([]);
  useEffect(() => {
    carState.current = [...cars];
  }, [cars]);
  useEffect(() => {
    walkerState.current = walkers;
  }, [walkers]);

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.1);
    carState.current = carState.current.map((car, index) => {
      const next = advanceTrafficCar(car, CAR_SPEED * step);
      const node = carNodes.current[index];
      if (node) {
        const p = trafficCarPoint(next);
        node.position.set(...toWorld(p.x, p.y));
      }
      return next;
    });
    walkerState.current = walkerState.current.map((walker, index) => {
      const next = stepWalker(walker, WALK_SPEED * step);
      const node = walkerNodes.current[index];
      if (node) node.position.set(...toWorld(next.x, next.y));
      return next;
    });
    // Keep the demand-driven canvas drawing while anything moves.
    if (carState.current.length || walkerState.current.length) state.invalidate();
  });

  return (
    <>
      {cars.map((car, index) => (
        <group
          key={`car-${index}`}
          ref={(node: Group | null) => {
            carNodes.current[index] = node;
          }}
          position={carOrigins[index] ?? [0, 0, 0]}
        >
          <WorldCars positions={[[0, 0, trafficCarRotation(car)]]} size={carSize} />
        </group>
      ))}
      {walkers.map((walker, index) => (
        <group
          key={`walker-${index}`}
          ref={(node: Group | null) => {
            walkerNodes.current[index] = node;
          }}
          position={walkerOrigins[index] ?? [0, 0, 0]}
        >
          <WorldPeople positions={[[0, 0]]} />
        </group>
      ))}
    </>
  );
}
