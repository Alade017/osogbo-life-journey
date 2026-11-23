import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/_authenticated/_game/bank.$slug";
const state = vi.hoisted(() => ({ location: "bank", mutate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ slug: "meridian-bank" }),
  }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    isLoading: false,
    isError: false,
    data:
      queryKey[0] === "character"
        ? { id: "player", current_location_id: state.location, name: "Player" }
        : queryKey[0] === "locations"
          ? [
              {
                id: "bank",
                slug: "meridian-bank",
                type: "bank",
                name: "Meridian Bank",
                is_active: true,
              },
            ]
          : queryKey[0] === "wallet"
            ? { balance: 1000 }
            : null,
  }),
}));
vi.mock("@/lib/game", () => {
  const query = (key: string) => () => ({ queryKey: [key] });
  return {
    q: {
      character: query("character"),
      locations: query("locations"),
      profile: query("profile"),
      bankAccount: query("bankAccount"),
      wallet: query("wallet"),
    },
    rpc: { openBankAccount: vi.fn(), depositCash: vi.fn(), withdrawCash: vi.fn() },
    useGameAction: () => ({ mutate: state.mutate, isPending: false }),
    formatNaira: (n: number) => `₦${n}`,
  };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => {
      const channel = {
        on: () => channel,
        subscribe: () => channel,
        presenceState: () => ({}),
        track: async () => {},
      };
      return channel;
    },
    removeChannel: async () => {},
  },
}));
vi.mock("@/components/3d/BankLobbyScene", () => ({
  BankLobbyScene: ({ onInteract }: { onInteract: (place: string) => void }) => (
    <div data-testid="bank-world">
      <button onClick={() => onInteract("teller")}>Select teller in world</button>
      <button onClick={() => onInteract("atm")}>Select ATM in world</button>
    </div>
  ),
}));
beforeEach(() => {
  state.location = "bank";
  state.mutate.mockClear();
});
afterEach(cleanup);
it("keeps the lobby visible while teller/ATM actions open and close real service controls", () => {
  const Page = Route.options.component!;
  render(<Page />);
  expect(screen.getByTestId("bank-world").closest(".bank-world")).not.toBeNull();
  expect(screen.queryByRole("heading", { name: "Your bank account" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Select teller in world" }));
  expect(screen.getByRole("heading", { name: "Teller counter" })).toBeVisible();
  expect(screen.getByTestId("bank-world")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Close services" }));
  expect(screen.queryByRole("heading", { name: "Teller counter" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Select ATM in world" }));
  expect(screen.getByRole("heading", { name: "ATM services" })).toBeVisible();
  expect(state.mutate).not.toHaveBeenCalled();
});
it("never renders the lobby or its world actions before confirmed arrival", () => {
  state.location = "elsewhere";
  const Page = Route.options.component!;
  render(<Page />);
  expect(screen.queryByTestId("bank-world")).toBeNull();
  expect(screen.getByRole("heading", { name: "Travel to enter the branch" })).toBeVisible();
  expect(state.mutate).not.toHaveBeenCalled();
});
