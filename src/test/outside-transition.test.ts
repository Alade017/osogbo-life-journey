import { describe, expect, it } from "vitest";
import { beginTransition, completeTransitionStep, endTransition } from "@/lib/outside-transition";

describe("outside transition steps", () => {
  it("only advances after a real step completes and never passes its total", () => {
    beginTransition("leaving", "Walking to the door", 2);
    completeTransitionStep("Opening the door");
    completeTransitionStep("Ready");
    completeTransitionStep("Extra");
    endTransition();
  });
});
