import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_WINDOW_MS,
  reportMallZone,
} from "@/lib/osun-mall-presence";

describe("reportMallZone", () => {
  beforeEach(() => rpc.mockReset());

  it("sends the zone to the server", async () => {
    rpc.mockResolvedValue({ error: null });
    await reportMallZone("street");
    expect(rpc).toHaveBeenCalledWith("set_osun_mall_presence", { p_zone: "street" });
  });

  it("surfaces server errors", async () => {
    rpc.mockResolvedValue({ error: new Error("Unknown place in the Osun Mall") });
    await expect(reportMallZone("mall")).rejects.toThrow("Unknown place in the Osun Mall");
  });

  it("reports often enough to stay inside the server's window", () => {
    expect(PRESENCE_HEARTBEAT_MS).toBeLessThan(PRESENCE_WINDOW_MS / 2);
  });
});
