import { describe, expect, it } from "vitest";
import { propertySaleErrorMessage } from "@/lib/property-sale";

describe("property sale error messages", () => {
  it("explains a rented home refusal in plain words", () => {
    const message = propertySaleErrorMessage(new Error("RENTED_HOME_CANNOT_BE_SOLD"));
    expect(message).toContain("Move out");
    expect(message).not.toContain("RENTED_HOME");
  });

  it("asks for overdue rent to be paid first", () => {
    expect(propertySaleErrorMessage(new Error("PAY_OVERDUE_RENT_FIRST"))).toContain("overdue rent");
  });

  it("gives neutral copy for unknown errors", () => {
    expect(propertySaleErrorMessage(new Error("WHATEVER"))).toBe(
      "That sale could not be completed. Try again.",
    );
  });
});
