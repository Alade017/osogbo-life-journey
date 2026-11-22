import { describe, expect, it } from "vitest";
import { marketStallErrorMessage } from "@/lib/market-stall-service";

describe("market stall error messages", () => {
  it("explains a stall rent blocked by an active home rental", () => {
    const message = marketStallErrorMessage(new Error("ALREADY_RENTING"));
    expect(message).toBe("You already rent a home. End that rental before you rent a stall.");
    expect(message).not.toContain("ALREADY_RENTING");
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
