import { describe, expect, it } from "vitest";
import { marketStallErrorMessage } from "@/lib/market-stall-service";

describe("market stall error messages", () => {
  it("explains an existing rental without assuming it is a home", () => {
    const message = marketStallErrorMessage(new Error("ALREADY_RENTING"));
    expect(message).toBe(
      "You already have an active rental. Manage your existing lease before renting a stall.",
    );
    expect(message).not.toContain("ALREADY_RENTING");
    expect(message).not.toMatch(/home|end that rental/i);
  });

  it("finds the code inside a longer server message", () => {
    expect(marketStallErrorMessage(new Error("ERROR: INSUFFICIENT_FUNDS (wallet)"))).toContain(
      "enough cash",
    );
  });

  it("gives neutral copy for codes it does not know", () => {
    expect(marketStallErrorMessage(new Error("SOMETHING_NEW"))).toBe(
      "That change could not be completed. Try again.",
    );
    expect(marketStallErrorMessage(undefined)).toBe(
      "That change could not be completed. Try again.",
    );
  });
});
