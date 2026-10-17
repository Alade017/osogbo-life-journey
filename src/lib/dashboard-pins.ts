export const DASHBOARD_PIN_IDS = ["jobs", "bank", "map", "social", "missions", "messages"] as const;
export type DashboardPinId = (typeof DASHBOARD_PIN_IDS)[number];
export const DEFAULT_DASHBOARD_PINS: readonly DashboardPinId[] = [
  "jobs",
  "bank",
  "map",
  "social",
  "missions",
];
const priority: readonly DashboardPinId[] = [
  "jobs",
  "bank",
  "map",
  "missions",
  "messages",
  "social",
];

export function normalizeDashboardPins(value: unknown): DashboardPinId[] {
  if (!Array.isArray(value)) return [...DEFAULT_DASHBOARD_PINS];
  const allowed = new Set<DashboardPinId>(DASHBOARD_PIN_IDS);
  const unique = [
    ...new Set(
      value.flatMap((entry) =>
        typeof entry === "string" && allowed.has(entry as DashboardPinId)
          ? [entry as DashboardPinId]
          : [],
      ),
    ),
  ].slice(0, 5);
  return unique.length ? unique : [...DEFAULT_DASHBOARD_PINS];
}

export function visibleDashboardPins(pins: readonly DashboardPinId[], width: number) {
  const maximum = width <= 340 ? 4 : 5;
  return [...pins].sort((a, b) => priority.indexOf(a) - priority.indexOf(b)).slice(0, maximum);
}

export function dashboardBadgeCounts(
  notifications: readonly { kind: string; read_at: string | null }[] | null | undefined,
) {
  const counts: Partial<Record<DashboardPinId, number>> = {};
  for (const notification of notifications ?? []) {
    if (notification.read_at) continue;
    const kind = notification.kind.toLowerCase();
    const pin: DashboardPinId | null = kind.includes("message")
      ? "messages"
      : kind.includes("job") || kind.includes("career")
        ? "jobs"
        : kind.includes("rent") || kind.includes("wallet") || kind.includes("bill")
          ? "bank"
          : kind.includes("friend") || kind.includes("social")
            ? "social"
            : kind.includes("mission") || kind.includes("reward")
              ? "missions"
              : null;
    if (pin) counts[pin] = (counts[pin] ?? 0) + 1;
  }
  return counts;
}
