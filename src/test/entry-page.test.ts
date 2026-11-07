import { describe, expect, it } from "vitest";
import { entryAction } from "@/lib/entry-action";

describe("entry page action", () => {
  it("offers a saved player the way back into their life", () => {
    expect(entryAction("signed-in", true)).toEqual({ kind: "continue", to: "/home" });
  });

  it("offers a new signed-in player sign up at character creation", () => {
    expect(entryAction("signed-in", false)).toEqual({ kind: "sign-up", to: "/create-character" });
  });

  it("offers a visitor sign up at account creation", () => {
    expect(entryAction("signed-out", false)).toEqual({ kind: "sign-up", to: "/signup" });
  });
});
