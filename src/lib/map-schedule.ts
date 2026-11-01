export type MapSchedule = {
  sampledAt: string;
  clock: { day: number; hour: number; minute: number; weekday: number };
  actions: { id: string; start: number; end: number; open: boolean | null }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/** Validate the projection, never derive eligibility from browser time. */
export function parseMapSchedule(value: unknown, actionIds: string[]): MapSchedule | undefined {
  if (!isRecord(value) || !isRecord(value["clock"]) || !Array.isArray(value["actions"])) return;
  const sampledAt = value["sampledAt"];
  const clock = value["clock"];
  if (
    typeof sampledAt !== "string" ||
    !Number.isFinite(Date.parse(sampledAt)) ||
    !isIntegerInRange(clock["day"], 1, 1_000_000) ||
    !isIntegerInRange(clock["hour"], 0, 23) ||
    !isIntegerInRange(clock["minute"], 0, 59) ||
    !isIntegerInRange(clock["weekday"], 0, 6) ||
    actionIds.length !== new Set(actionIds).size ||
    value["actions"].length !== actionIds.length
  )
    return;

  const actions: MapSchedule["actions"] = [];
  for (const action of value["actions"]) {
    if (
      !isRecord(action) ||
      typeof action["id"] !== "string" ||
      !actionIds.includes(action["id"]) ||
      !isIntegerInRange(action["start"], 0, 23) ||
      !isIntegerInRange(action["end"], 1, 24) ||
      (typeof action["open"] !== "boolean" && action["open"] !== null)
    )
      return;
    actions.push({
      id: action["id"],
      start: action["start"],
      end: action["end"],
      open: action["open"],
    });
  }
  if (new Set(actions.map((action) => action.id)).size !== actionIds.length) return;

  return {
    sampledAt,
    clock: {
      day: clock["day"],
      hour: clock["hour"],
      minute: clock["minute"],
      weekday: clock["weekday"],
    },
    actions,
  };
}

export function mapActivityHours(start: number, end: number) {
  const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return start === end
    ? "All day"
    : `${hour(start)}–${hour(end)}${start > end ? " (next day)" : ""}`;
}
