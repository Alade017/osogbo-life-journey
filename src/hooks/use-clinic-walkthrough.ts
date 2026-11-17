import { useEffect, useRef, useState } from "react";
import { useHouseMovement } from "./use-house-movement";
import { CLINIC_SPAWN, clinicPath, type ClinicPoint } from "@/game/clinic-navigation";
import { clinicRoomAt } from "@/game/tier-one-clinic";
export function useClinicWalkthrough(resetKey: string) {
  const movement = useHouseMovement(resetKey, [CLINIC_SPAWN[0] - 12, 0.06, CLINIC_SPAWN[1] - 9]);
  const [message, setMessage] = useState("Tap the floor or choose a room to walk.");
  const position: ClinicPoint = [movement.position[0] + 12, movement.position[2] + 9];
  const operation = useRef(0);
  useEffect(() => { operation.current++; return () => { operation.current++; }; }, [resetKey]);
  const walkTo = (target: ClinicPoint) => {
    const ticket = ++operation.current;
    movement.cancel();
    const from = movement.positionRef.current;
    const path = clinicPath([from[0] + 12, from[2] + 9], target);
    if (!path) {
      setMessage("That spot is blocked or restricted. Choose a clear floor area.");
      return;
    }
    setMessage("Walking…");
    void movement.walk(path.map((p) => [p[0] - 12, 0.06, p[1] - 9])).then((arrived) => {
      if (arrived && ticket === operation.current)
        setMessage(
          `${clinicRoomAt(target[0], target[1])?.name ?? "Corridor"} · Use available place activities for services.`,
        );
    });
  };
  return { ...movement, walkTo, message, room: clinicRoomAt(position[0], position[1])?.id };
}
