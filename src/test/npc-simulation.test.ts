import { describe, expect, it } from "vitest";
import { INITIAL_GAME_TIME } from "@/lib/game-time";
import {
  interactionOutcome,
  NPC_CATALOG,
  npcActivityAt,
  relationshipTier,
  socialActionsFor,
  type Relationship,
} from "@/lib/npc-simulation";

const newRelationship: Relationship = {
  friendship: 0,
  romance: 0,
  trust: 0,
  conflict: 0,
  meetings: 0,
  lastInteractionDay: null,
  lastInteractionText: null,
};

describe("NPC routine and social simulation", () => {
  it("follows distinct work schedules and selects a home fallback when a venue is unavailable", () => {
    const lookup = (slug: string) => (slug === "residential" || slug === "oja-oba" ? slug : null);
    const adeola = NPC_CATALOG.find((npc) => npc.id === "npc-adeola")!;
    const atWork = npcActivityAt(adeola, { ...INITIAL_GAME_TIME, hour: 9 }, lookup);
    const atNight = npcActivityAt(adeola, { ...INITIAL_GAME_TIME, hour: 2 }, lookup);
    expect(atWork).toMatchObject({
      destinationSlug: "oja-oba",
      label: "selling produce",
      available: true,
    });
    expect(atNight).toMatchObject({
      destinationSlug: "residential",
      label: "sleeping",
      available: false,
    });
    expect(NPC_CATALOG.find((npc) => npc.id === "npc-tunde")?.routine[0]!.start).toBe(8);
  });

  it("changes relationship dimensions according to conversation and personality", () => {
    const adeola = NPC_CATALOG.find((npc) => npc.id === "npc-adeola")!;
    const greeting = interactionOutcome("greet", adeola, newRelationship);
    expect(greeting.accepted).toBe(true);
    expect(greeting.changes).toMatchObject({ friendship: 2, trust: 1, meetings: 1 });
    const help = interactionOutcome("help", adeola, { ...newRelationship, friendship: 10 });
    expect(help.changes).toMatchObject({ friendship: 5, trust: 7 });
  });

  it("keeps romance unavailable until repeat meetings, friendship, and trust qualify", () => {
    const adeola = NPC_CATALOG.find((npc) => npc.id === "npc-adeola")!;
    expect(socialActionsFor(newRelationship, true)).not.toContain("romance");
    expect(interactionOutcome("romance", adeola, newRelationship).accepted).toBe(false);
    const ready = { ...newRelationship, meetings: 4, friendship: 55, trust: 40 };
    expect(socialActionsFor(ready, true)).toContain("romance");
    expect(interactionOutcome("romance", adeola, ready).changes).toMatchObject({
      romance: 3,
      trust: 2,
    });
  });

  it("unlocks event invitations for friends and supports a returning encounter", () => {
    const adeola = NPC_CATALOG.find((npc) => npc.id === "npc-adeola")!;
    const firstMeeting = interactionOutcome("greet", adeola, newRelationship);
    expect(firstMeeting.accepted).toBe(true);
    const returningFriend = { ...newRelationship, meetings: 2, friendship: 42, trust: 26 };
    expect(socialActionsFor(returningFriend, true)).toContain("invite");
    expect(interactionOutcome("invite", adeola, returningFriend).accepted).toBe(true);
    expect(socialActionsFor({ ...newRelationship, friendship: 39, trust: 40 }, true)).not.toContain(
      "invite",
    );
  });

  it("rejects a socially uncomfortable interaction without awarding progress", () => {
    const bisola = {
      ...NPC_CATALOG.find((npc) => npc.id === "npc-bisola")!,
      personality: "reserved" as const,
    };
    const outcome = interactionOutcome("compliment", bisola, newRelationship);
    expect(outcome.accepted).toBe(false);
    expect(outcome.changes).toEqual({ conflict: 1 });
    expect(relationshipTier({ ...newRelationship, conflict: 60 })).toBe("Strained");
  });

  it("unlocks friendship labels at clear thresholds and does not expose unavailable actions", () => {
    expect(relationshipTier({ ...newRelationship, meetings: 1 })).toBe("Acquaintance");
    expect(relationshipTier({ ...newRelationship, friendship: 75, trust: 60 })).toBe(
      "Close friend",
    );
    expect(socialActionsFor(newRelationship, false)).toEqual([]);
  });
});
