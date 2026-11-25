import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("renders a compact, accessible switch with a correctly sized thumb", () => {
    render(<Switch aria-label="Reduce motion" />);
    const control = screen.getByRole("switch", { name: "Reduce motion" });
    expect(control).toHaveClass("h-6", "w-11", "min-h-0", "min-w-0");
    expect(control.firstElementChild).toHaveClass("h-5", "w-5");
  });
});
