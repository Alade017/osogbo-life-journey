import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { isGameTime, parseSimulationSnapshot } from "@/lib/simulation-service";

const snapshot = {
  revision: 1,
  needs: { hunger: 80, energy: 70, hygiene: 90, bladder: 60, fun: 75, social: 65 },
  game_time: { minute: 0, hour: 8, day: 1, weekday: 0 },
  paused: false,
  speed: 1,
  action: null,
  request_id: null,
  skills: {},
  queued_actions: [],
};
describe("simulation response validation", () => {
  it("accepts a confirmed server snapshot", () =>
    expect(parseSimulationSnapshot(snapshot)).toEqual(snapshot));
  it("rejects invalid clocks and out-of-range needs", () => {
    expect(isGameTime({ ...snapshot.game_time, hour: 24 })).toBe(false);
    expect(() =>
      parseSimulationSnapshot({ ...snapshot, needs: { ...snapshot.needs, energy: 101 } }),
    ).toThrow();
    expect(() => parseSimulationSnapshot({ ...snapshot, revision: -1 })).toThrow();
  });
  it("rejects unknown actions, mismatched requests, and invalid skill values", () => {
    expect(() =>
      parseSimulationSnapshot({ ...snapshot, action: "cheat", request_id: "r1" }),
    ).toThrow();
    expect(() => parseSimulationSnapshot({ ...snapshot, action: "sleep" })).toThrow();
    expect(() => parseSimulationSnapshot({ ...snapshot, skills: { fitness: -10 } })).toThrow();
  });
});
