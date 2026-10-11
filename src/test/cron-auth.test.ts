import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

afterEach(() => vi.unstubAllEnvs());
describe("independent scheduled endpoint authentication", () => {
  it("rejects requests when the server secret is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await authenticateCronRequest(new Request("http://localhost/api/cron")))?.status).toBe(
      500,
    );
  });
  it("accepts current and rotated secrets and rejects an invalid token", async () => {
    vi.stubEnv("CRON_SECRET", "current-secret");
    vi.stubEnv("CRON_SECRET_PREVIOUS", "previous-secret");
    const request = (token: string) =>
      new Request("http://localhost/api/cron", { headers: { authorization: `Bearer ${token}` } });
    expect(await authenticateCronRequest(request("current-secret"))).toBeNull();
    expect(await authenticateCronRequest(request("previous-secret"))).toBeNull();
    expect((await authenticateCronRequest(request("wrong-secret")))?.status).toBe(401);
  });
});
