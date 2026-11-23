/**
 * How long a live simulation request may run before the client gives up and retries.
 * A hung request must not hold the sync lock forever, or the character never reconnects.
 */
export const SIMULATION_REQUEST_TIMEOUT_MS = 12_000;

/** Rejects if the promise has not settled within `ms`. The timer is always cleared. */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/** How long a player-initiated game RPC may run before the action fails and can be tried again. */
export const GAME_RPC_TIMEOUT_MS = 15_000;

/** After this long on a loading screen, the player is offered a retry instead of waiting silently. */
export const SLOW_LOAD_AFTER_MS = 8_000;
