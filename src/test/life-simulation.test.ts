import { describe, expect, it } from "vitest";
import { advanceGameTime, INITIAL_GAME_TIME } from "@/lib/game-time";
import {
  advanceSimulation,
  completeAction,
  createSimulationState,
  decayNeeds,
  deriveMood,
  interruptAction,
  isValidSimulationSnapshot,
  NEED_NAMES,
  normalizeNeeds,
  queueActions,
  startAction,
  startNextQueuedAction,
  statusForNeed,
  validateAction,
  type SimulationState,
} from "@/lib/life-simulation";

function player(overrides: Partial<SimulationState> = {}) {
  return createSimulationState({
    character: { id: "p1", name: "Tola", level: 3, traits: ["disciplined"] },
    gameTime: INITIAL_GAME_TIME,
    needs: { hunger: 30, energy: 70, hygiene: 50, bladder: 60, fun: 55, social: 45 },
    wallet: 1200,
    locationType: "home",
    locationId: "home-1",
    ...overrides,
  });
}

describe("life simulation needs and clock", () => {
  it("decays needs from elapsed game time and clamps all values", () => {
    const before = normalizeNeeds({
      hunger: 100,
      energy: 50,
      hygiene: 50,
      bladder: 50,
      fun: 50,
      social: 50,
    });
    const after = decayNeeds(before, 60);
    expect(after.hunger).toBeLessThan(before.hunger);
    expect(after.energy).toBeLessThan(before.energy);
    expect(
      Object.values(decayNeeds(before, 1_000_000)).every((value) => value >= 0 && value <= 100),
    ).toBe(true);
    expect(decayNeeds(before, 0)).toEqual(before);
  });

  it("advances one shared in-game clock at a configurable rate and pauses cleanly", () => {
    const start = player();
    const advanced = advanceSimulation(start, 60);
    expect(advanced.gameTime).toEqual(advanceGameTime(INITIAL_GAME_TIME, 10));
    const paused = { ...start, paused: true };
    expect(advanceSimulation(paused, 60)).toBe(paused);
    expect(advanceSimulation({ ...start, timeSpeed: 2 }, 60).gameTime).toEqual(
      advanceGameTime(INITIAL_GAME_TIME, 20),
    );
  });

  it("fires a scheduled event once when simulation time crosses its start time", () => {
    const state = player({ gameTime: { ...INITIAL_GAME_TIME, hour: 7, minute: 55 } });
    const first = advanceSimulation(state, 30);
    expect(first.pendingEvents).toContain("Morning market opens");
    const again = advanceSimulation(first, 30);
    expect(again.pendingEvents.filter((event) => event === "Morning market opens")).toHaveLength(1);
  });

  it("restores energy during sleep and hunger/hygiene/bladder/social through their actions", () => {
    const bed = startAction(
      player({ needs: { hunger: 20, energy: 15, hygiene: 45, bladder: 40, fun: 40, social: 30 } }),
      "sleep",
      "sleep-1",
      { furniture: ["bed"] },
    );
    expect(bed.error).toBeNull();
    const slept = completeAction(bed.state, "sleep-1").state;
    expect(slept.needs.energy).toBeGreaterThan(90);
    const meal = startAction(
      player({ needs: { hunger: 10, energy: 55, hygiene: 45, bladder: 40, fun: 40, social: 30 } }),
      "eat",
      "meal-1",
    );
    expect(completeAction(meal.state, "meal-1").state.needs.hunger).toBeGreaterThan(35);
    const shower = startAction(
      player({ needs: { hunger: 50, energy: 55, hygiene: 10, bladder: 40, fun: 40, social: 30 } }),
      "shower",
      "shower-1",
      { furniture: ["shower"] },
    );
    expect(completeAction(shower.state, "shower-1").state.needs.hygiene).toBeGreaterThan(50);
    const toilet = startAction(
      player({ needs: { hunger: 50, energy: 55, hygiene: 45, bladder: 5, fun: 40, social: 30 } }),
      "toilet",
      "toilet-1",
      { furniture: ["toilet"] },
    );
    expect(completeAction(toilet.state, "toilet-1").state.needs.bladder).toBeGreaterThan(60);
    const talk = startAction(
      player({ needs: { hunger: 50, energy: 55, hygiene: 45, bladder: 40, fun: 40, social: 5 } }),
      "socialize",
      "talk-1",
    );
    expect(completeAction(talk.state, "talk-1").state.needs.social).toBeGreaterThan(25);
  });

  it("validates location, furniture, level, funds, and current activity before starting", () => {
    const state = player();
    expect(validateAction(state, "shower")).toMatch(/shower/);
    expect(validateAction({ ...state, locationType: "any" }, "cook", ["stove"])).toMatch(/at home/);
    expect(
      validateAction({ ...state, character: { ...state.character, level: 0 } }, "study"),
    ).toMatch(/level 1/);
    const active = startAction(state, "study", "active-1").state;
    expect(validateAction(active, "socialize")).toMatch(/current activity/);
    expect(validateAction({ ...state, wallet: 0 }, "eat")).toBeNull();
    expect(NEED_NAMES).toHaveLength(6);
  });

  it("applies action duration exactly once, updates skill XP, mood, and action state", () => {
    const started = startAction(player(), "study", "study-1");
    const complete = completeAction(started.state, "study-1");
    expect(complete.state.gameTime).toEqual(advanceGameTime(INITIAL_GAME_TIME, 60));
    expect(complete.state.skills["learning"]).toBeGreaterThan(0);
    expect(complete.state.currentAction).toBeNull();
    expect(completeAction(complete.state, "study-1").state).toBe(complete.state);
  });

  it("reacts to critical needs with an explanation and exposes accessible meter levels", () => {
    const mood = deriveMood({
      hunger: 10,
      energy: 70,
      hygiene: 80,
      bladder: 70,
      fun: 75,
      social: 75,
    });
    expect(mood.mood).toBe("hungry");
    expect(mood.reason).toContain("Hunger");
    expect(statusForNeed("hunger", 10)).toBe("critical");
    expect(statusForNeed("hunger", 25)).toBe("warning");
    expect(statusForNeed("hunger", 90)).toBe("healthy");
  });

  it("rolls back an interrupted action, preserves time, and returns reserved funds", () => {
    const started = startAction(player({ wallet: 0 }), "study", "cancel-1");
    const interrupted = interruptAction(started.state, "cancel-1");
    expect(interrupted.currentAction).toBeNull();
    expect(interrupted.gameTime).toEqual(INITIAL_GAME_TIME);
    expect(interruptAction(interrupted, "other-id")).toBe(interrupted);
  });

  it("does not complete an activity while paused and rejects malformed saves", async () => {
    const started = startAction(player(), "study", "pause-1");
    const paused = { ...started.state, paused: true };
    expect(completeAction(paused, "pause-1").error).toMatch(/Resume/);
    expect(isValidSimulationSnapshot(paused, "p1")).toBe(true);
    expect(
      isValidSimulationSnapshot({ ...paused, gameTime: { ...paused.gameTime, hour: 48 } }, "p1"),
    ).toBe(false);
  });

  it("queues compatible actions and safely stops on a newly invalid one", () => {
    const queued = queueActions(player(), ["study", "socialize"]);
    const first = startNextQueuedAction(queued);
    expect(first.error).toBeNull();
    const completed = completeAction(first.state, first.state.currentAction!.requestId).state;
    const second = startNextQueuedAction(completed);
    expect(second.error).toBeNull();
    const stopped = startNextQueuedAction({ ...completed, paused: true });
    expect(stopped.error).toMatch(/Queue stopped/);
    expect(stopped.state.queuedActions).toEqual([]);
  });

  it("does not start queued actions while another action is active", () => {
    const active = startAction(player(), "study", "active-study").state;
    const queued = queueActions(active, ["socialize"]);
    const result = startNextQueuedAction(queued);
    expect(result.error).toMatch(/current activity/);
    expect(result.state.currentAction?.requestId).toBe("active-study");
    expect(result.state.queuedActions).toEqual(["socialize"]);
  });

  it("rejects corrupt active action saves and accepts complete active records", () => {
    const active = startAction(player(), "study", "saved-study").state;
    expect(isValidSimulationSnapshot(active, "p1")).toBe(true);
    expect(
      isValidSimulationSnapshot(
        {
          ...active,
          currentAction: { ...active.currentAction!, reservedCost: Number.NaN },
        },
        "p1",
      ),
    ).toBe(false);
    expect(
      isValidSimulationSnapshot(
        {
          ...active,
          currentAction: { ...active.currentAction!, startedAt: { ...active.gameTime, hour: 30 } },
        },
        "p1",
      ),
    ).toBe(false);
  });
});
