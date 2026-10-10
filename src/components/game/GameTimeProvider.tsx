import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Character } from "@/lib/game";
import type { GameTime } from "@/lib/game-time";
import {
  ACTION_CATALOG,
  createSimulationState,
  deriveMood,
  type LifeActionId,
  type SimulationState,
} from "@/lib/life-simulation";
import {
  simulationCommand,
  type SimulationCommand,
  type SimulationSnapshot,
} from "@/lib/simulation-service";

type ContextValue = {
  simulation: SimulationState;
  syncError: string | null;
  busy: boolean;
  ready: boolean;
  reconnect: () => void;
  pause: () => void;
  resume: () => void;
  setSpeed: (speed: 0.5 | 1 | 2) => void;
  queue: (actions: readonly LifeActionId[]) => Promise<string | null>;
  startNext: (options?: { furniture?: readonly string[] }) => Promise<string | null>;
  start: (
    action: LifeActionId,
    requestId: string,
    options?: { furniture?: readonly string[]; targetLocationId?: string },
  ) => Promise<string | null>;
  complete: (requestId: string) => Promise<string | null>;
  interrupt: (requestId?: string) => Promise<string | null>;
};
const GameTimeContext = createContext<ContextValue | null>(null);

export function GameTimeProvider({
  children,
  gameTime,
  character,
  wallet = 0,
  locationType = "any",
  locationId = null,
}: {
  children: ReactNode;
  gameTime: GameTime;
  character: Character;
  wallet?: number;
  locationType?: SimulationState["locationType"];
  locationId?: string | null;
}) {
  const qc = useQueryClient();
  const [simulation, setSimulation] = useState(() =>
    createSimulationState({
      character: { id: character.id, name: character.name, level: character.level, traits: [] },
      needs: {
        hunger: 100 - character.hunger,
        energy: character.energy,
        hygiene: 80,
        bladder: 72,
        fun: character.happiness,
        social: character.social,
      },
      gameTime,
      wallet,
      locationType,
      locationId,
      experience: character.xp,
    }),
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const session = useRef<string>("");
  const revision = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const liveState = useRef(simulation);
  liveState.current = simulation;

  const applySnapshot = useCallback(
    (s: SimulationSnapshot) => {
      revision.current = s.revision;
      setSimulation((current) => ({
        ...current,
        needs: s.needs,
        gameTime: s.game_time,
        paused: s.paused,
        timeSpeed: s.speed,
        skills: s.skills,
        queuedActions: s.queued_actions,
        mood: deriveMood(s.needs),
        lastUpdatedAt: Date.now(),
        currentAction:
          s.action && s.request_id
            ? {
                actionId: s.action,
                requestId: s.request_id,
                startedAt: s.game_time,
                animation: ACTION_CATALOG[s.action].animation,
                reservedCost: 0,
              }
            : null,
      }));
      qc.setQueryData<Character | null>(["character"], (row) =>
        row
          ? {
              ...row,
              energy: Math.round(s.needs.energy),
              hunger: 100 - Math.round(s.needs.hunger),
              happiness: Math.round(s.needs.fun),
              social: Math.round(s.needs.social),
            }
          : row,
      );
    },
    [qc],
  );

  const send = useCallback(
    async (
      command: SimulationCommand,
      extra: {
        action?: LifeActionId;
        requestId?: string;
        paused?: boolean;
        speed?: 0.5 | 1 | 2;
        queuedActions?: readonly LifeActionId[];
      } = {},
    ): Promise<string | null> => {
      if (inFlight.current) return "Wait for the current activity to sync.";
      if (document.hidden || !navigator.onLine) {
        const message = "Reconnect and return to this tab to continue.";
        if (!navigator.onLine) {
          setReady(false);
          setSyncError(message);
        }
        return message;
      }
      inFlight.current = true;
      setBusy(true);
      try {
        if (!session.current) session.current = crypto.randomUUID();
        const result = await simulationCommand({
          session: session.current,
          revision: revision.current,
          command,
          ...extra,
        });
        if (mounted.current) {
          applySnapshot(result);
          setReady(true);
          setSyncError(null);
        }
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not sync your simulation.";
        if (mounted.current) {
          setSyncError(message);
          setReady(false);
        }
        return message;
      } finally {
        inFlight.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [applySnapshot],
  );

  useEffect(() => {
    mounted.current = true;
    void send("open");
    let needsOpen = false;
    const onVisibility = () => {
      needsOpen = true;
      if (!navigator.onLine) {
        setReady(false);
        setSyncError("You are offline. Personal progress is stopped until you reconnect.");
      }
      if (!document.hidden && navigator.onLine) void send("open");
    };
    const tick = window.setInterval(() => {
      if (document.hidden || !navigator.onLine || inFlight.current) {
        needsOpen = true;
        return;
      }
      const command = needsOpen ? "open" : "tick";
      needsOpen = false;
      void send(command).then((error) => {
        if (error) needsOpen = true;
      });
    }, 6000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onVisibility);
    window.addEventListener("offline", onVisibility);
    return () => {
      mounted.current = false;
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onVisibility);
      window.removeEventListener("offline", onVisibility);
    };
  }, [send]);

  useEffect(() => {
    setSimulation((current) => ({
      ...current,
      wallet,
      experience: character.xp,
      character: { ...current.character, name: character.name, level: character.level },
      locationId,
      locationType,
    }));
  }, [character.name, character.level, character.xp, wallet, locationId, locationType]);

  const pause = useCallback(() => {
    void send("settings", { paused: true });
  }, [send]);
  const resume = useCallback(() => {
    void send("settings", { paused: false });
  }, [send]);
  const setSpeed = useCallback(
    (speed: 0.5 | 1 | 2) => {
      void send("settings", { speed });
    },
    [send],
  );
  const queue = useCallback(
    (actions: readonly LifeActionId[]) => send("queue", { queuedActions: actions }),
    [send],
  );
  const start = useCallback(
    (action: LifeActionId, requestId: string) => send("start", { action, requestId }),
    [send],
  );
  const startNext = useCallback(async () => {
    const action = liveState.current.queuedActions[0];
    if (!action) return "Your activity queue is empty.";
    const error = await start(action, `${action}-${crypto.randomUUID()}`);
    return error;
  }, [start]);
  const complete = useCallback(
    (requestId: string) => {
      const action = liveState.current.currentAction?.actionId;
      if (!action) return Promise.resolve("There is no active activity.");
      return send("complete", { action, requestId });
    },
    [send],
  );
  const interrupt = useCallback(() => send("interrupt"), [send]);
  const reconnect = useCallback(() => {
    void send("open");
  }, [send]);
  const value = useMemo(
    () => ({
      simulation,
      syncError,
      busy,
      ready,
      reconnect,
      pause,
      resume,
      setSpeed,
      queue,
      startNext,
      start,
      complete,
      interrupt,
    }),
    [
      simulation,
      syncError,
      busy,
      ready,
      reconnect,
      pause,
      resume,
      setSpeed,
      queue,
      startNext,
      start,
      complete,
      interrupt,
    ],
  );
  return <GameTimeContext.Provider value={value}>{children}</GameTimeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGameTime() {
  const value = useContext(GameTimeContext);
  if (!value) throw new Error("useGameTime must be used inside GameTimeProvider.");
  return value;
}
