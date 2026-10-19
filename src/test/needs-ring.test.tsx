import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NeedsRing } from "@/components/game/NeedsRing";

vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => ({
    simulation: {
      needs: { hunger: 20, energy: 78, hygiene: 82, bladder: 60, fun: 70, social: 10 },
    },
  }),
}));

describe("needs ring", () => {
  it("wraps the avatar and summarises every need for assistive tech", () => {
    render(
      <NeedsRing>
        <span>Avatar</span>
      </NeedsRing>,
    );
    const group = screen.getByRole("group", { name: /^Needs: / });
    expect(group).toHaveTextContent("Avatar");
    expect(group).toHaveAttribute("aria-label", expect.stringContaining("Hunger 20 percent"));
    expect(group.querySelectorAll(".needs-ring-fill")).toHaveLength(6);
  });

  it("colours each arc by its need status", () => {
    const { container } = render(
      <NeedsRing>
        <span>Avatar</span>
      </NeedsRing>,
    );
    const statuses = Array.from(container.querySelectorAll(".needs-ring-fill")).map(
      (arc) =>
        arc
          .getAttribute("class")
          ?.split(" ")
          .find((c) => c.startsWith("is-")) ?? "",
    );
    expect(statuses).toEqual([
      "is-warning",
      "is-healthy",
      "is-healthy",
      "is-healthy",
      "is-healthy",
      "is-critical",
    ]);
  });
});
