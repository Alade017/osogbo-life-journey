import { createElement, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  useMutation,
} from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  atBank: true,
  bankAccountExists: true,
  deposit: vi.fn(),
  withdraw: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) =>
    createElement("a", { ...props, href: to }, children),
}));

vi.mock("@/lib/game", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  const options = (key: string[], queryFn: () => Promise<unknown>) => ({
    queryKey: key,
    queryFn,
    staleTime: 60_000,
    retry: false,
  });
  return {
    formatNaira: (amount: number) => `₦${amount.toLocaleString("en-NG")}`,
    q: {
      wallet: () => options(["wallet"], async () => ({ balance: 5000, bank_balance: 4000 })),
      transactions: () => options(["transactions"], async () => []),
      character: () =>
        options(["character"], async () => ({
          current_location_id: mocks.atBank ? "bank-location" : "street-location",
        })),
      bankAccount: () =>
        options(["bankAccount"], async () =>
          mocks.bankAccountExists
            ? {
                id: "bank-account",
                account_number: "1000000001",
                branch_location_id: "bank-location",
                branch_name: "Cedar Bank",
                opened_at: "2026-11-05T00:00:00.000Z",
              }
            : null,
        ),
      places: () =>
        options(["places"], async () =>
          mocks.atBank ? [{ location_id: "bank-location", category: "bank" }] : [],
        ),
      locations: () =>
        options(["locations"], async () => [
          { id: "bank-location", type: "bank", slug: "cedar-bank" },
          { id: "street-location", type: "district", slug: "street" },
        ]),
    },
    rpc: { depositCash: mocks.deposit, withdrawCash: mocks.withdraw },
    useGameAction: (
      mutationFn: (args: number) => Promise<unknown>,
      callbacks?: {
        onSuccess?: (result: unknown) => void;
        onError?: (error: Error) => void;
      },
    ) =>
      useMutation({
        mutationFn,
        ...(callbacks?.onSuccess ? { onSuccess: callbacks.onSuccess } : {}),
        ...(callbacks?.onError ? { onError: callbacks.onError } : {}),
      }),
  };
});

import { PhoneBankApp } from "@/components/game/phone/PhoneBankApp";

function renderBankApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  queryClient.setQueryData(["wallet"], { balance: 5000, bank_balance: 4000 });
  queryClient.setQueryData(["transactions"], []);
  queryClient.setQueryData(["character"], {
    current_location_id: mocks.atBank ? "bank-location" : "street-location",
  });
  queryClient.setQueryData(
    ["bankAccount"],
    mocks.bankAccountExists
      ? {
          id: "bank-account",
          account_number: "1000000001",
          branch_location_id: "bank-location",
          branch_name: "Cedar Bank",
          opened_at: "2026-11-05T00:00:00.000Z",
        }
      : null,
  );
  queryClient.setQueryData(["places"], []);
  queryClient.setQueryData(
    ["locations"],
    [
      { id: "bank-location", type: "bank", slug: "cedar-bank" },
      { id: "street-location", type: "district", slug: "street" },
    ],
  );
  if (mocks.atBank) {
    queryClient.setQueryData(["places"], [{ location_id: "bank-location", category: "bank" }]);
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <PhoneBankApp />
    </QueryClientProvider>,
  );
}

describe("PhoneBankApp network and transfer states", () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    mocks.atBank = true;
    mocks.bankAccountExists = true;
    mocks.deposit.mockReset().mockResolvedValue(undefined);
    mocks.withdraw.mockReset().mockResolvedValue(undefined);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "connection");
    onlineManager.setOnline(true);
  });

  it("shows a low-network warning when browser connectivity reports a 2G connection", async () => {
    const connection = new EventTarget() as EventTarget & { effectiveType: string };
    connection.effectiveType = "2g";
    Object.defineProperty(navigator, "connection", { configurable: true, value: connection });
    renderBankApp();

    expect(await screen.findByText(/Low network detected/)).toBeInTheDocument();
    expect(screen.getByText("₦5,000")).toBeInTheDocument();
  });

  it("disables transfers offline while retaining cached account information", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderBankApp();

    expect(await screen.findByText(/Offline\. Cached account data remains visible/)).toBeVisible();
    await screen.findByText("₦5,000");
    fireEvent.click(screen.getByRole("button", { name: /^Deposit$/ }));

    expect(screen.getByRole("button", { name: /Deposit Funds/ })).toBeDisabled();
    expect(mocks.deposit).not.toHaveBeenCalled();
  });

  it("requires the character to be at a bank or ATM before transferring", async () => {
    mocks.atBank = false;
    renderBankApp();

    expect(await screen.findByText(/You need to be at a bank or ATM/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Deposit$/ }));
    expect(screen.getByRole("button", { name: /Deposit Funds/ })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Find a bank on the map" })).toHaveAttribute(
      "href",
      "/map",
    );
  });

  it("requires an account opened with a teller before transferring", async () => {
    mocks.bankAccountExists = false;
    renderBankApp();

    expect(await screen.findByText(/Open a bank account with a teller/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Deposit$/ }));
    expect(screen.getByRole("button", { name: /Deposit Funds/ })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Meet a teller" })).toHaveAttribute(
      "href",
      "/bank/$slug",
    );
    expect(mocks.deposit).not.toHaveBeenCalled();
  });

  it("reports a transfer as confirmed only after the server call succeeds", async () => {
    renderBankApp();
    await screen.findByText("₦5,000");
    fireEvent.click(screen.getByRole("button", { name: /^Deposit$/ }));
    fireEvent.change(await screen.findByPlaceholderText("e.g. 5000"), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Deposit ₦500/ }));

    expect(await screen.findByText("Deposit confirmed by the game server.")).toBeInTheDocument();
    expect(mocks.deposit).toHaveBeenCalledTimes(1);
    expect(mocks.deposit.mock.calls[0]?.[0]).toBe(500);
  });

  it("requires an account refresh after a failed transfer without automatically retrying it", async () => {
    mocks.deposit.mockRejectedValueOnce(new Error("Connection interrupted"));
    renderBankApp();
    await screen.findByText("₦5,000");
    fireEvent.click(screen.getByRole("button", { name: /^Deposit$/ }));
    fireEvent.change(await screen.findByPlaceholderText("e.g. 5000"), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Deposit ₦500/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Refresh your account and transaction history",
    );
    expect(mocks.deposit).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh account and transaction history" }),
    );
    expect(
      await screen.findByText(/Account and history refreshed\. Review the latest transaction/),
    ).toBeInTheDocument();
    expect(mocks.deposit).toHaveBeenCalledTimes(1);
  });
});
