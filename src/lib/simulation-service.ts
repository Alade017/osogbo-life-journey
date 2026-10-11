import { supabase } from "@/integrations/supabase/client";
import { type GameTime } from "@/lib/game-time";
import { NEED_NAMES, type LifeActionId, type Needs, ACTION_CATALOG } from "@/lib/life-simulation";

export type SimulationCommand =
  "open" | "tick" | "settings" | "start" | "complete" | "interrupt" | "queue";
export type SimulationSnapshot = {
  revision: number;
  needs: Needs;
  game_time: GameTime;
  paused: boolean;
  speed: 0.5 | 1 | 2;
  action: LifeActionId | null;
  request_id: string | null;
  skills: Record<string, number>;
  queued_actions: LifeActionId[];
};

export function isGameTime(value: unknown): value is GameTime {
  if (!value || typeof value !== "object") return false;
  const t = value as GameTime;
  return (
    Number.isInteger(t.minute) &&
    t.minute >= 0 &&
    t.minute < 60 &&
    Number.isInteger(t.hour) &&
    t.hour >= 0 &&
    t.hour < 24 &&
    Number.isInteger(t.day) &&
    t.day >= 1 &&
    Number.isInteger(t.weekday) &&
    t.weekday >= 0 &&
    t.weekday < 7
  );
}

export function parseSimulationSnapshot(value: unknown): SimulationSnapshot {
  const s = value as SimulationSnapshot | null;
  if (
    !s ||
    !Number.isSafeInteger(s.revision) ||
    s.revision < 0 ||
    !isGameTime(s.game_time) ||
    typeof s.paused !== "boolean" ||
    ![0.5, 1, 2].includes(s.speed) ||
    !s.needs ||
    NEED_NAMES.some(
      (name) => !Number.isFinite(s.needs[name]) || s.needs[name] < 0 || s.needs[name] > 100,
    ) ||
    (s.action !== null &&
      (!Object.hasOwn(ACTION_CATALOG, s.action) || typeof s.request_id !== "string")) ||
    (s.action === null && s.request_id !== null) ||
    !s.skills ||
    typeof s.skills !== "object" ||
    Array.isArray(s.skills) ||
    Object.values(s.skills).some((n) => !Number.isFinite(n) || n < 0) ||
    !Array.isArray(s.queued_actions) ||
    s.queued_actions.length > 20 ||
    s.queued_actions.some((id) => !Object.hasOwn(ACTION_CATALOG, id) || id === "travel")
  )
    throw new Error("The server returned an invalid simulation snapshot.");
  return s;
}

export async function simulationCommand(args: {
  session: string;
  revision: number;
  command: SimulationCommand;
  action?: LifeActionId;
  requestId?: string;
  paused?: boolean;
  speed?: 0.5 | 1 | 2;
  queuedActions?: readonly LifeActionId[];
}) {
  const { data, error } = await supabase.rpc("personal_simulation_command", {
    p_session: args.session,
    p_revision: args.revision,
    p_command: args.command,
    ...(args.action !== undefined ? { p_action: args.action } : {}),
    ...(args.requestId !== undefined ? { p_request: args.requestId } : {}),
    ...(args.paused !== undefined ? { p_paused: args.paused } : {}),
    ...(args.speed !== undefined ? { p_speed: args.speed } : {}),
    ...(args.queuedActions !== undefined ? { p_queue: [...args.queuedActions] } : {}),
  });
  if (error) throw new Error(error.message);
  return parseSimulationSnapshot(data);
}

export async function readWorldClock(): Promise<GameTime> {
  const { data, error } = await supabase.rpc("world_clock");
  if (error) throw new Error(error.message);
  if (!isGameTime(data)) throw new Error("The server returned an invalid world clock.");
  return data;
}

export async function joinCityEvent(id: string) {
  const { data, error } = await supabase.rpc("join_city_event", { p_event: id });
  if (error) throw new Error(error.message);
  return data as { joined: boolean; duplicate: boolean };
}
