import { describe, expect, it, vi } from "vitest";
import { createPreloadableLoader } from "@/lib/preloadable-loader";

describe("createPreloadableLoader", () => {
  it("does not load until requested", () => {
    const load = vi.fn().mockResolvedValue("scene");
    createPreloadableLoader(load);
    expect(load).not.toHaveBeenCalled();
  });

  it("shares concurrent requests", async () => {
    const load = vi.fn().mockResolvedValue("scene");
    const preload = createPreloadableLoader(load);
    const first = preload();
    const second = preload();
    expect(first).toBe(second);
    expect(await first).toBe("scene");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("retains successful results", async () => {
    const load = vi.fn().mockResolvedValue("scene");
    const preload = createPreloadableLoader(load);
    await preload();
    await preload();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("allows another attempt after failure", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("Loading failed"))
      .mockResolvedValueOnce("scene");
    const preload = createPreloadableLoader(load);
    await expect(preload()).rejects.toThrow("Loading failed");
    await expect(preload()).resolves.toBe("scene");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
