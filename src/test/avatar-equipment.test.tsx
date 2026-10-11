import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/game/Avatar";

describe("Avatar equipment visuals", () => {
  it("renders visible slot accents only for equipped slots", () => {
    const { container } = render(
      <Avatar appearance={{}} equipment={[{ slot: "accessory" }, { slot: "head" }]} />,
    );
    expect(container.querySelector('[data-equipment-slot="accessory"]')).toBeInTheDocument();
    expect(container.querySelector('[data-equipment-slot="head"]')).toBeInTheDocument();
    expect(container.querySelector('[data-equipment-slot="top"]')).not.toBeInTheDocument();
  });
});
