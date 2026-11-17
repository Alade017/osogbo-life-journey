import { useEffect } from "react";

/** How long the computer waits before it acts, so the human can follow each move. */
export const COMPUTER_DELAY_MS = 550;

/** Runs `act` once after the computer delay while `active` is true. */
export function useComputerTurn(active: boolean, deps: unknown[], act: () => void) {
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(act, COMPUTER_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);
}
