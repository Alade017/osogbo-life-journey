import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CommunityPhoneApps } from "@/components/game/CommunityPhoneApps";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

it("adds food items to the local basket", () => {
  renderWithQuery(<CommunityPhoneApps app="Food Delivery" />);
  fireEvent.click(screen.getAllByRole("button", { name: "Add" })[0]!);
  expect(screen.getByText("1 item")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Order/ })).toBeEnabled();
});

it("shows the local okada ride state", () => {
  renderWithQuery(<CommunityPhoneApps app="Okada Rides" />);
  fireEvent.click(screen.getByRole("button", { name: "Request a ride" }));
  expect(screen.getByText("Rider is on the way")).toBeInTheDocument();
});

it("does not connect community contribution to an account balance", () => {
  renderWithQuery(<CommunityPhoneApps app="Contribution" />);
  fireEvent.click(screen.getByRole("button", { name: /Contribute/ }));
  expect(screen.getByText("Contribution noted")).toBeInTheDocument();
  expect(screen.getByText(/no money or game balance changes/i)).toBeInTheDocument();
});

it("reacts to the featured town news item locally", () => {
  renderWithQuery(<CommunityPhoneApps app="Town News" />);
  fireEvent.click(screen.getByRole("button", { name: "♥ 12" }));
  expect(screen.getByRole("button", { name: "♥ 0" })).toBeInTheDocument();
});
