import { describe, expect, it } from "vitest";
import { houseErrorMessage, houseSaveFailureMessage } from "@/lib/house-error-messages";

describe("house error messages", () => {
  it("explains an inactive home without showing the raw code", () => {
    const message = houseSaveFailureMessage("NO_ACTIVE_HOUSE");
    expect(message).toContain("Pay the overdue rent");
    expect(message).not.toMatch(/NO_ACTIVE|no active house/);
  });

  it("gives a neutral line for codes it does not know", () => {
    expect(houseErrorMessage("SOMETHING_NEW")).toBe(
      "That change could not be completed. Try again.",
    );
    expect(houseErrorMessage(null)).toBe("That change could not be completed. Try again.");
  });
});
