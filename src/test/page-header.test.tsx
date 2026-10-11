import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/game/ui";

describe("shared game page heading", () => {
  it("keeps a clear section label, title, description, and optional action together", () => {
    render(
      <PageHeader
        eyebrow="YOUR FINANCES"
        title="Bank & wallet"
        subtitle="Review your in-game money."
        right={<button type="button">History</button>}
      />,
    );

    expect(screen.getByText("YOUR FINANCES")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bank & wallet" })).toBeInTheDocument();
    expect(screen.getByText("Review your in-game money.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
  });
});
