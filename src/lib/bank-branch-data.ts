import type { AvatarAnimationState } from "@/components/game/Avatar";
import type { Appearance } from "@/game/avatar-appearance";

export const BANK_BRANCH_STAFF = {
  "cedar-bank": [
    {
      id: "cedar-teller-one",
      name: "Teller Ayo",
      role: "Customer service",
      position: [-2.4, 0.06, -2.35],
      appearance: { outfit: 2, bottoms: 1, headwear: 1 },
      animation: "work",
    },
    {
      id: "cedar-teller-two",
      name: "Teller Bisi",
      role: "Account services",
      position: [1.2, 0.06, -2.35],
      appearance: { outfit: 3, bottoms: 2 },
      animation: "talk",
    },
    {
      id: "cedar-guide",
      name: "Mr. Tunde",
      role: "Queue guide",
      position: [4.5, 0.06, 0.3],
      appearance: { outfit: 1, bottoms: 1, headwear: 1 },
      animation: "idle",
    },
  ],
  "meridian-bank": [
    {
      id: "meridian-teller-one",
      name: "Teller Kunle",
      role: "Customer service",
      position: [-2.4, 0.06, -2.35],
      appearance: { outfit: 1, bottoms: 2, headwear: 1 },
      animation: "work",
    },
    {
      id: "meridian-teller-two",
      name: "Teller Yetunde",
      role: "Account services",
      position: [1.2, 0.06, -2.35],
      appearance: { outfit: 4, bottoms: 1 },
      animation: "talk",
    },
    {
      id: "meridian-guide",
      name: "Mrs. Fola",
      role: "Queue guide",
      position: [4.5, 0.06, 0.3],
      appearance: { outfit: 3, bottoms: 2, headwear: 1 },
      animation: "idle",
    },
  ],
} as const satisfies Record<
  string,
  Array<{
    id: string;
    name: string;
    role: string;
    position: [number, number, number];
    appearance: Appearance;
    animation: AvatarAnimationState;
  }>
>;

export type BankSlug = keyof typeof BANK_BRANCH_STAFF;

export function isBankSlug(value: string): value is BankSlug {
  return Object.hasOwn(BANK_BRANCH_STAFF, value);
}
