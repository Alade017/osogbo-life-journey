import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { GameTime } from "@/lib/game-time";

type GameTimeContextValue = {
  gameTime: GameTime;
};

const GameTimeContext = createContext<GameTimeContextValue | null>(null);

export function GameTimeProvider({
  children,
  gameTime,
}: {
  children: ReactNode;
  gameTime: GameTime;
}) {
  const value = useMemo(() => ({ gameTime }), [gameTime]);

  return <GameTimeContext.Provider value={value}>{children}</GameTimeContext.Provider>;
}

export function useGameTime() {
  const value = useContext(GameTimeContext);
  if (!value) throw new Error("useGameTime must be used inside GameTimeProvider.");
  return value;
}
