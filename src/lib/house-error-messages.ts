/** Player-facing copy for house server error codes. Unknown codes get a neutral line, never the raw code. */
const HOUSE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NO_ACTIVE_HOUSE: "This home is not active right now. Pay the overdue rent to change it.",
  SLOT_OCCUPIED: "That spot already has something in it.",
  SLOT_MISMATCH: "That item does not fit this spot.",
  EMPTY_SLOT: "That item is no longer in this spot.",
  NOT_OWNED: "You no longer own that item.",
  INSUFFICIENT_FUNDS: "You do not have enough cash for that.",
  INVALID_POSITION: "That position is not free.",
  LAYOUT_CHANGED: "Your home changed while you were editing. Check the layout and try again.",
  INVALID_REQUEST: "That change could not be read. Try again.",
  HOUSE_SERVICE_UNAVAILABLE: "The home service is not responding. Try again in a moment.",
};

const FALLBACK = "That change could not be completed. Try again.";

export function houseErrorMessage(code: string | null | undefined): string {
  if (code && HOUSE_ERROR_MESSAGES[code]) return HOUSE_ERROR_MESSAGES[code];
  return FALLBACK;
}

/** Toast line for a house change that the server refused. */
export function houseSaveFailureMessage(code: string | null | undefined): string {
  return `Your change wasn’t saved. ${houseErrorMessage(code)}`;
}
