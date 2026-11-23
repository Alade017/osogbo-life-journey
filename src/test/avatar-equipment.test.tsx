import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/game/Avatar";

describe("Avatar equipment visuals", () => {
  it("renders visible slot accents only for equipped slots", () => {
    const { container } = render(
      <Avatar
        appearance={{}}
        equipment={[{ slot: "accessory" }, { slot: "head", item: { slug: "cap" } }]}
      />,
    );
    expect(container.querySelector('[data-equipment-slot="accessory"]')).toBeInTheDocument();
    expect(container.querySelector('[data-equipment-slot="head"]')).toBeInTheDocument();
    expect(container.querySelector('[data-equipment-slot="top"]')).not.toBeInTheDocument();
  });

  it.each([null, "unknown-hat"])("does not invent headwear for an unsupported item: %s", (slug) => {
    const { container } = render(
      <Avatar appearance={{}} equipment={[{ slot: "head", item: { slug } }]} />,
    );
    expect(container.querySelector('[data-equipment-slot="head"]')).not.toBeInTheDocument();
  });
});
