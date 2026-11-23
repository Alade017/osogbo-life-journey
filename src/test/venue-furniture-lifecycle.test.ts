import { describe, expect, it } from "vitest";

import {
  registerFurniture,
  reportFurnitureResult,
  unregisterFurniture,
  getFurnitureResults,
  type FurnitureRegistry,
} from "@/lib/venue-furniture-lifecycle";

describe("venue furniture lifecycle", () => {
  const key = '["table-a","table"]';
  const tokenA = Symbol("instance-a");
  const tokenB = Symbol("instance-b");

  function emptyRegistry(): FurnitureRegistry {
    return new Map();
  }

  function registered(): FurnitureRegistry {
    return registerFurniture(emptyRegistry(), key, {
      token: tokenA,
    });
  }

  it("registers a pending furniture instance", () => {
    const registry = registered();

    expect(registry.get(key)).toEqual({
      token: tokenA,
    });
  });

  it("records successful readiness", () => {
    const registry = reportFurnitureResult(registered(), key, tokenA, "ready");

    expect(registry.get(key)?.result).toBe("ready");
  });

  it("records furniture failure", () => {
    const registry = reportFurnitureResult(registered(), key, tokenA, "failed");

    expect(registry.get(key)?.result).toBe("failed");
  });

  it("ignores duplicate registrations", () => {
    const registry = registered();

    expect(
      registerFurniture(registry, key, {
        token: tokenA,
      }),
    ).toBe(registry);
  });

  it("ignores duplicate readiness updates", () => {
    const registry = reportFurnitureResult(registered(), key, tokenA, "ready");

    expect(reportFurnitureResult(registry, key, tokenA, "ready")).toBe(registry);
  });

  it("rejects outdated instance callbacks", () => {
    const registry = registerFurniture(registered(), key, { token: tokenB });

    expect(reportFurnitureResult(registry, key, tokenA, "ready")).toBe(registry);
  });

  it("removes the registered instance", () => {
    const registry = unregisterFurniture(registered(), key, tokenA);

    expect(registry.has(key)).toBe(false);
  });

  it("rejects outdated cleanup callbacks", () => {
    const registry = registerFurniture(registered(), key, { token: tokenB });

    expect(unregisterFurniture(registry, key, tokenA)).toBe(registry);
  });

  it("does not inherit results from replaced instances", () => {
    const ready = reportFurnitureResult(registered(), key, tokenA, "ready");

    const replacement = registerFurniture(ready, key, { token: tokenB });

    expect(replacement.get(key)).toEqual({
      token: tokenB,
    });
  });

  it("converts registry entries into readiness results", () => {
    const registry = reportFurnitureResult(registered(), key, tokenA, "failed");

    expect(getFurnitureResults(registry)).toEqual({
      [key]: "failed",
    });
  });
});
