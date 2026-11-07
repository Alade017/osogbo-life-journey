export type EntrySession = "checking" | "signed-out" | "signed-in" | "error";

/** Keeps the entry page on one action: sign up for a new player, or continue for a saved one. */
export function entryAction(sessionState: EntrySession, hasCharacter: boolean) {
  if (hasCharacter) return { kind: "continue" as const, to: "/home" as const };
  if (sessionState === "signed-in")
    return { kind: "sign-up" as const, to: "/create-character" as const };
  return { kind: "sign-up" as const, to: "/signup" as const };
}
