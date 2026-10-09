import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Character } from "@/lib/game";
import type { GameTime } from "@/lib/game-time";
import {
  createSimulationState,
  advanceSimulation,
  completeAction,
  interruptAction,
  isValidSimulationSnapshot,
  queueActions,
  startAction,
  startNextQueuedAction,
  validateAction,
  type LifeActionId,
  type SimulationState,
} from "@/lib/life-simulation";

function sameTime(a: GameTime, b: GameTime) {
  return a.minute === b.minute && a.hour === b.hour && a.day === b.day && a.weekday === b.weekday;
}

type GameTimeContextValue = {
  simulation: SimulationState;
  pause: () => void;
  resume: () => void;
  setSpeed: (speed: 0.5 | 1 | 2) => void;
  queue: (actions: readonly LifeActionId[]) => void;
  startNext: (options?: { furniture?: readonly string[] }) => string | null;
  start: (
    action: LifeActionId,
    requestId: string,
    options?: { furniture?: readonly string[]; targetLocationId?: string },
  ) => string | null;
  complete: (requestId: string) => string | null;
  interrupt: (requestId?: string) => void;
};

const GameTimeContext = createContext<GameTimeContextValue | null>(null);
const SAVE_KEY = "osogbo-life-simulation-v1";

function makeInitialState(
  character: Character,
  wallet: number,
  gameTime: GameTime,
  locationType: SimulationState["locationType"],
  locationId: string | null,
) {
  const personality = character.personality;
  const traits: SimulationState["character"]["traits"] =
    personality === "social"
      ? ["sociable"]
      : personality === "studious"
        ? ["studious", "disciplined"]
        : personality === "creative"
          ? ["creative"]
          : personality === "ambitious"
            ? ["ambitious"]
            : ["easygoing"];
  let state = createSimulationState({
    character: { id: character.id, name: character.name, level: character.level, traits },
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
    locationId,
    locationType,
    experience: character.xp,
    serverSnapshot: {
      updatedAt: character.updated_at,
      gameTime,
      energy: character.energy,
      hunger: character.hunger,
      happiness: character.happiness,
      social: character.social,
      wallet,
      experience: character.xp,
      level: character.level,
      locationId,
    },
  });
  if (typeof window !== "undefined") {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "null");
      if (
        isValidSimulationSnapshot(saved, character.id) &&
        saved.lastUpdatedAt > Date.parse(character.updated_at)
      )
        state = { ...state, ...saved, character: state.character };
    } catch {
      /* Invalid snapshots are ignored and rebuilt from the character row. */
    }
  }
  return state;
}

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
  const [simulation, setSimulation] = useState(() =>
    makeInitialState(character, wallet, gameTime, locationType, locationId),
  );
  useEffect(() => {
    if (simulation.character.id !== character.id) {
      setSimulation(makeInitialState(character, wallet, gameTime, locationType, locationId));
      return;
    }
    setSimulation((current) => {
      const source = current.serverSnapshot;
      const incomingNeeds = { ...current.needs };
      if (character.energy !== source.energy) incomingNeeds.energy = character.energy;
      if (character.hunger !== source.hunger) incomingNeeds.hunger = 100 - character.hunger;
      if (character.happiness !== source.happiness) incomingNeeds.fun = character.happiness;
      if (character.social !== source.social) incomingNeeds.social = character.social;
      const serverTimeChanged = !sameTime(gameTime, source.gameTime);
      const walletChanged = wallet !== source.wallet;
      const experienceChanged = character.xp !== source.experience;
      const levelChanged = character.level !== source.level;
      const locationChanged = locationId !== source.locationId;
      const nextTime = serverTimeChanged ? gameTime : current.gameTime;
      const nextLocationType = locationChanged ? locationType : current.locationType;
      return {
        ...current,
        character: { ...current.character, level: character.level },
        needs: incomingNeeds,
        gameTime: nextTime,
        wallet: walletChanged ? wallet : current.wallet,
        experience: experienceChanged ? character.xp : current.experience,
        locationId: locationChanged ? locationId : current.locationId,
        locationType: nextLocationType,
        serverSnapshot: {
          updatedAt: character.updated_at,
          gameTime,
          energy: character.energy,
          hunger: character.hunger,
          happiness: character.happiness,
          social: character.social,
          wallet,
          experience: character.xp,
          level: character.level,
          locationId,
        },
      };
    });
  }, [
    character.id,
    character,
    character.updated_at,
    character.energy,
    character.hunger,
    character.happiness,
    character.social,
    character.xp,
    character.level,
    wallet,
    gameTime.minute,
    gameTime.hour,
    gameTime.day,
    gameTime.weekday,
    gameTime,
    locationId,
    locationType,
    simulation.character.id,
  ]);
  useEffect(() => {
    const id = window.setInterval(
      () =>
        setSimulation((current) =>
          advanceSimulation(current, Math.max(0, (Date.now() - current.lastUpdatedAt) / 1000)),
        ),
      6000,
    );
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    try {
      if (typeof window !== "undefined")
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(simulation));
    } catch {
      /* Storage can be unavailable in private browsing; memory state still works. */
    }
  }, [simulation]);
  const pause = useCallback(() => setSimulation((current) => ({ ...current, paused: true })), []);
  const resume = useCallback(
    () => setSimulation((current) => ({ ...current, paused: false, lastUpdatedAt: Date.now() })),
    [],
  );
  const setSpeed = useCallback(
    (speed: 0.5 | 1 | 2) => setSimulation((current) => ({ ...current, timeSpeed: speed })),
    [],
  );
  const queue = useCallback(
    (actions: readonly LifeActionId[]) =>
      setSimulation((current) => queueActions(current, actions)),
    [],
  );
  const startNext = useCallback(
    (options?: { furniture?: readonly string[] }) => {
      const result = startNextQueuedAction(simulation, options);
      if (!result.error) setSimulation(result.state);
      return result.error;
    },
    [simulation],
  );
  const start = useCallback(
    (
      action: LifeActionId,
      requestId: string,
      options?: { furniture?: readonly string[]; targetLocationId?: string },
    ) => {
      const error = validateAction(
        simulation,
        action,
        options?.furniture,
        options?.targetLocationId,
      );
      if (error) return error;
      setSimulation((current) => startAction(current, action, requestId, options).state);
      return null;
    },
    [simulation],
  );
  const complete = useCallback(
    (requestId: string) => {
      const result = completeAction(simulation, requestId);
      if (!result.error) setSimulation(result.state);
      return result.error;
    },
    [simulation],
  );
  const interrupt = useCallback(
    (requestId?: string) => setSimulation((current) => interruptAction(current, requestId)),
    [],
  );
  const value = useMemo(
    () => ({ simulation, pause, resume, setSpeed, queue, startNext, start, complete, interrupt }),
    [simulation, pause, resume, setSpeed, queue, startNext, start, complete, interrupt],
  );
  return <GameTimeContext.Provider value={value}>{children}</GameTimeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGameTime() {
  const value = useContext(GameTimeContext);
  if (!value) throw new Error("useGameTime must be used inside GameTimeProvider.");
  return value;
}
