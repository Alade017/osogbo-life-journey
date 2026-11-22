/** What a visitor can click in the mall. Ids come from the layout and staff data. */
export type MallTarget =
  | { kind: "shelf"; id: string }
  | { kind: "till"; id: string }
  | { kind: "seat"; id: string }
  | { kind: "display"; id: string }
  | { kind: "staff"; role: string; id: string }
  | { kind: "shopper"; id: string };

/** Cosmetic items a visitor can place once each. They change nothing else in the game. */
export const MALL_PROPS = [
  { id: "basket", label: "Shopping basket", color: "#c2410c" },
  { id: "bag", label: "Shopping bag", color: "#1d4ed8" },
  { id: "sign", label: "Promo sign", color: "#15803d" },
] as const;

export type MallPropId = (typeof MALL_PROPS)[number]["id"];

const LINES = {
  shelf: [
    "Shopkeeper: Those are fresh this morning. Ask if you need a bigger pack.",
    "Shopper: Is the price on the shelf the same at the till?",
  ],
  till: [
    "Cashier: Next, please. Cash or card?",
    "Cashier: Have your receipt ready before you leave.",
  ],
  seat: ["Shopper: Good spot to rest your feet before the next aisle."],
  display: ["Staff: The featured display changes every week."],
  staff: {
    till: "Cashier: Good afternoon. Are you ready to pay?",
    floor: "Floor staff: Need help finding anything?",
    security: "Security: Please keep your bags with you.",
    supervisor: "Supervisor: Welcome to the mall. Enjoy your shopping.",
    "staff-room": "Staff: This area is for staff only, thank you.",
    "control-room": "Staff: This area is for staff only, thank you.",
  } as Record<string, string>,
  shopper: ["Shopper: Excuse me, pardon me.", "Shopper: The queue is moving quickly today."],
} as const;

/** One line for a click. `pick` chooses between lines, so repeated clicks do not always say the same thing. */
export function reactionFor(target: MallTarget, pick: number): string {
  const choose = (lines: readonly string[]) =>
    lines[Math.abs(pick) % lines.length] ?? lines[0] ?? "";
  switch (target.kind) {
    case "shelf":
      return choose(LINES.shelf);
    case "till":
      return choose(LINES.till);
    case "seat":
      return choose(LINES.seat);
    case "display":
      return choose(LINES.display);
    case "staff":
      return LINES.staff[target.role] ?? "Staff: Can I help you?";
    case "shopper":
      return choose(LINES.shopper);
  }
}
