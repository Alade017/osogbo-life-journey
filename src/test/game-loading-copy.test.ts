import { describe, expect, it } from "vitest";
import { gateLoadingCopy } from "@/lib/game-loading-copy";

describe("gateLoadingCopy", () => {
  it.each([
    ["/party", "Opening the party"],
    ["/market", "Opening the market"],
    ["/social", "Opening your social life"],
    ["/house", "Opening your home"],
    ["/home", "Opening your home"],
    ["/map", "Loading the map"],
  ])("names the page for %s", (pathname, title) => {
    expect(gateLoadingCopy(pathname, false).title).toBe(title);
  });

  it("names a friend's home only while visiting one", () => {
    expect(gateLoadingCopy("/home", true).title).toBe("Visiting the home");
    expect(gateLoadingCopy("/home", false).title).toBe("Opening your home");
  });

  it("keeps the generic copy for pages without their own", () => {
    expect(gateLoadingCopy("/wallet", false)).toEqual({
      title: "Loading your game",
      detail: "Preparing your world…",
    });
  });
});
