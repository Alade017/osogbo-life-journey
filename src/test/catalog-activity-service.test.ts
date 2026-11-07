import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isExpectedActivityRejection,
  parseCatalogActivityResult,
  performCatalogActivity,
} from "@/lib/catalog-activity-service";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const snapshot = {
  revision: 4,
  needs: { hunger: 82, energy: 70, hygiene: 75, bladder: 65, fun: 55, social: 48 },
  game_time: { minute: 15, hour: 9, day: 2, weekday: 1 },
  paused: false,
  speed: 1 as const,
  action: null,
  request_id: null,
  sleep_elapsed_seconds: 0,
  skills: {},
  queued_actions: [],
};
const result = {
  snapshot,
  activity: {
    id: "activity-completion-id",
    slug: "rest",
    name: "Rest",
    category: "rest",
    duration_minutes: 30,
    cooldown_minutes: 0,
    xp_reward: 4,
    energy_delta: 25,
    hunger_delta: 3,
    thirst_delta: 2,
    configured_rewards: { energy: 25 },
    completed_at: "2026-11-07T10:00:00.000Z",
    cooldown_ends_at: null,
  },
  duplicate: false,
};

beforeEach(() => vi.clearAllMocks());

describe("catalog activity service", () => {
  it("validates an authoritative completion and simulation snapshot", () => {
    expect(parseCatalogActivityResult(result)).toEqual(result);
    expect(parseCatalogActivityResult({ ...result, duplicate: true }).duplicate).toBe(true);
  });

  it("rejects incomplete or malformed activity results", () => {
    expect(() => parseCatalogActivityResult(null)).toThrow(/invalid activity completion/i);
    expect(() =>
      parseCatalogActivityResult({
        ...result,
        activity: { ...result.activity, xp_reward: "4" },
      }),
    ).toThrow(/incomplete activity completion/i);
    expect(() =>
      parseCatalogActivityResult({
        ...result,
        snapshot: { ...snapshot, needs: { ...snapshot.needs, energy: 101 } },
      }),
    ).toThrow(/invalid simulation snapshot/i);
  });

  it("sends only the session, revision, catalogue slug and idempotency key", async () => {
    rpc.mockResolvedValue({ data: result, error: null });
    const args = {
      session: "11111111-1111-4111-8111-111111111111",
      revision: 4,
      activitySlug: "rest",
      requestId: "22222222-2222-4222-8222-222222222222",
    };
    expect(await performCatalogActivity(args)).toEqual(result);
    expect(rpc).toHaveBeenCalledWith("perform_catalog_activity", {
      p_session: args.session,
      p_revision: args.revision,
      p_activity_slug: args.activitySlug,
      p_request_id: args.requestId,
    });
  });


  it("distinguishes expected activity-rule rejections from session failures", () => {
    expect(isExpectedActivityRejection("This activity is cooling down. Try again in 30 seconds.")).toBe(true);
    expect(isExpectedActivityRejection("Travel to the activity location first")).toBe(true);
    expect(isExpectedActivityRejection("Requires Level 5.")).toBe(true);
    expect(isExpectedActivityRejection("Resume your personal simulation first")).toBe(true);
    expect(isExpectedActivityRejection("Simulation changed on another device. Reconnect before continuing.")).toBe(false);
    expect(isExpectedActivityRejection("Failed to fetch")).toBe(false);
  });

  it("preserves server-side rejection without fabricating a completion", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "This activity is cooling down." } });
    await expect(
      performCatalogActivity({
        session: "11111111-1111-4111-8111-111111111111",
        revision: 4,
        activitySlug: "rest",
        requestId: "22222222-2222-4222-8222-222222222222",
      }),
    ).rejects.toThrow(/cooling down/i);
  });
});
