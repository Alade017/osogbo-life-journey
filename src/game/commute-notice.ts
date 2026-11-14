/** What the neighbourhood screen does with a server "commute-state" message. */
export type CommuteNotice = {
  /** Whether the character is still walking to work (keeps the beacon and banner up). */
  heading: boolean;
  /** Opens the existing work panel once the character has arrived. */
  openWork: boolean;
  toast?: { kind: "success" | "error" | "message"; text: string };
};

const REASON_TEXT: Record<string, string> = {
  arrived: "You have arrived at work.",
  cancelled: "Commute cancelled.",
  blocked: "Could not find a way to work from here.",
};

/** Maps a raw server message to the client's reaction, or null for anything unexpected. */
export function commuteNotice(message: unknown): CommuteNotice | null {
  if (!message || typeof message !== "object") return null;
  const candidate = message as { status?: unknown; reason?: unknown };

  if (candidate.status === "started") {
    return { heading: true, openWork: false, toast: { kind: "message", text: "Heading to work" } };
  }
  if (candidate.status === "refused") {
    const reason =
      typeof candidate.reason === "string" && candidate.reason
        ? candidate.reason
        : "You cannot go to work right now.";
    return { heading: false, openWork: false, toast: { kind: "error", text: reason } };
  }
  if (candidate.status === "ended" && typeof candidate.reason === "string") {
    const text = REASON_TEXT[candidate.reason];
    if (!text) return null;
    if (candidate.reason === "arrived") {
      return { heading: false, openWork: true, toast: { kind: "success", text } };
    }
    return {
      heading: false,
      openWork: false,
      toast: { kind: candidate.reason === "cancelled" ? "message" : "error", text },
    };
  }
  return null;
}
