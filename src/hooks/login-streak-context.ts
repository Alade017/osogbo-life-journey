import { createContext, useContext } from "react";
import type { LoginStreakSnapshot } from "@/lib/login-streak-service";
export type LoginStreakStatus = {
  snapshot: LoginStreakSnapshot | undefined;
  busy: boolean;
  loading: boolean;
  active: boolean;
  error: string | null;
  retry: () => void;
};
export const LoginStreakContext = createContext<LoginStreakStatus | null>(null);
export const useLoginStreak = () => useContext(LoginStreakContext);
