import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { PhoneContentPreview } from "@/components/game/PhoneContentPreview";

it("renders a usable in-phone content preview", () => {
  render(<PhoneContentPreview app="Inventory" />);
  expect(screen.getByRole("region", { name: "Inventory preview" })).toBeInTheDocument();
  expect(screen.getByText("Your carried items")).toBeInTheDocument();
  expect(screen.getByText("Useful items")).toBeInTheDocument();
});
