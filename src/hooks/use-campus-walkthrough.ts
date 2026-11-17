import { useEffect, useRef, useState } from "react";
import { useHouseMovement } from "./use-house-movement";
import type { CampusAreaId } from "@/game/school-campus";
import {
  CAMPUS_ENTRY,
  CAMPUS_ROOM_ENTRY,
  campusEntrance,
  campusWalkPath,
} from "@/game/campus-navigation";
import type { WalkPoint } from "@/game/grid-walk-path";
export function useCampusWalkthrough(resetKey: string) {
  const movement = useHouseMovement(resetKey, [CAMPUS_ENTRY[0], 0.06, CAMPUS_ENTRY[1]]);
  const [area, setArea] = useState<CampusAreaId>("courtyard"),
    [message, setMessage] = useState("Tap a path or choose a campus building."),
    [entering, setEntering] = useState(false);
  const operation = useRef(0);
  useEffect(() => {
    const lifecycle = operation;
    operation.current++;
    setArea("courtyard");
    setEntering(false);
    setMessage("Tap a path or choose a campus building.");
    return () => {
      lifecycle.current++;
    };
  }, [resetKey]);
  const go = async (inArea: CampusAreaId, target: WalkPoint, ticket: number) => {
    const current = movement.positionRef.current;
    const path = campusWalkPath(inArea, [current[0], current[2]], target);
    if (!path) {
      if (ticket === operation.current)
        setMessage("That spot is blocked. Choose a clear path or aisle.");
      return false;
    }
    setMessage("Walking…");
    const arrived = await movement.walk(path.map((p) => [p[0], 0.06, p[1]]));
    return arrived && ticket === operation.current;
  };
  const walkTo = async (target: WalkPoint) => {
    const ticket = ++operation.current;
    setEntering(false);
    movement.cancel();
    if (await go(area, target, ticket))
      setMessage(
        area === "courtyard"
          ? "Campus path · Choose a building to enter."
          : "Room aisle · Course actions remain in View courses.",
      );
  };
  const selectArea = async (target: CampusAreaId) => {
    if (target === area) return;
    const ticket = ++operation.current;
    setEntering(true);
    try {
      if (area !== "courtyard") {
        if (!(await go(area, CAMPUS_ROOM_ENTRY, ticket))) return;
        const exit = campusEntrance(area);
        movement.place([exit[0], 0.06, exit[1]]);
        setArea("courtyard");
      }
      if (target === "courtyard") {
        setMessage("Back outside at the building entrance.");
        return;
      }
      if (!(await go("courtyard", campusEntrance(target), ticket))) return;
      movement.place([CAMPUS_ROOM_ENTRY[0], 0.06, CAMPUS_ROOM_ENTRY[1]]);
      setArea(target);
      setMessage("Inside · Tap a clear aisle to walk.");
    } finally {
      if (ticket === operation.current) setEntering(false);
    }
  };
  return { ...movement, area, entering, message, walkTo, selectArea };
}
