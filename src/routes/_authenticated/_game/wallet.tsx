import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Info, Landmark } from "lucide-react";
import { toast } from "sonner";
import { q, rpc, formatNaira, useGameAction } from "@/lib/game";
import { amountError, moneySummary, transactionTitle } from "@/lib/economy-service";
import { pageMeta } from "@/lib/seo";
import { EmptyState, LoadingState, PageHeader } from "@/components/game/ui";

export const Route = createFileRoute("/_authenticated/_game/wallet")({
  head: () => pageMeta("Wallet", "Manage your in-game cash and bank balance."),
  component: WalletPage,
});

function WalletPage() {
  const [amount, setAmount] = useState("");
  const { data: wallet, isLoading } = useQuery(q.wallet());
  const { data: txs } = useQuery(q.transactions());
  const { data: character } = useQuery(q.character());
  const { data: places } = useQuery(q.places());
  const { data: locations } = useQuery(q.locations());
  const currentLocation = locations?.find(
    (location) => location.id === character?.current_location_id,
  );
  const bankAvailable =
    places?.some(
      (place) =>
        place.location_id === currentLocation?.id && ["bank", "atm"].includes(place.category),
    ) ?? false;
  const funds = moneySummary(wallet?.balance, wallet?.bank_balance);
  const deposit = useGameAction(rpc.depositCash, {
    onSuccess: () => toast.success("Cash deposited into your bank."),
  });
  const withdraw = useGameAction(rpc.withdrawCash, {
    onSuccess: () => toast.success("Cash withdrawn from your bank."),
  });
  const numericAmount = Number(amount);
  const transferError = amount ? amountError(numericAmount) : "Enter an amount to continue.";

  function submitTransfer(action: typeof deposit | typeof withdraw, available: number) {
    const error = amountError(numericAmount, available);
    if (error) return;
    action.mutate(numericAmount, { onSuccess: () => setAmount("") });
  }

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="YOUR FINANCES" title="Bank & wallet" />
      <div className="game-panel flex items-start gap-2 bg-sun p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>All balances are virtual in-game currency. They have no real-world value.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="game-panel bg-primary p-5 text-primary-foreground">
          <p className="text-sm font-semibold">Cash</p>
          <p className="font-display text-3xl font-bold">{formatNaira(funds.cash)}</p>
        </div>
        <div className="game-panel p-5">
          <p className="text-sm font-semibold text-muted-foreground">Bank balance</p>
          <p className="font-display text-3xl font-bold">{formatNaira(funds.bank)}</p>
        </div>
        <div className="game-panel p-5">
          <p className="text-sm font-semibold text-muted-foreground">Total funds</p>
          <p className="font-display text-3xl font-bold">{formatNaira(funds.total)}</p>
        </div>
      </div>

      <section className="game-panel space-y-4 p-5" aria-labelledby="bank-services-heading">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <h2 id="bank-services-heading" className="font-display text-xl font-bold">
            Bank services
          </h2>
        </div>
        {bankAvailable ? (
          <>
            <label className="block text-sm font-semibold" htmlFor="transfer-amount">
              Transfer amount
            </label>
            <input
              id="transfer-amount"
              className="w-full rounded-lg border-2 border-edge bg-background px-3 py-2"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Enter whole Naira amount"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-lg border-2 border-edge bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50"
                disabled={
                  !!transferError || !!amountError(numericAmount, funds.cash) || deposit.isPending
                }
                onClick={() => submitTransfer(deposit, funds.cash)}
              >
                Deposit cash
              </button>
              <button
                type="button"
                className="rounded-lg border-2 border-edge bg-secondary px-4 py-2 font-bold disabled:opacity-50"
                disabled={
                  !!transferError || !!amountError(numericAmount, funds.bank) || withdraw.isPending
                }
                onClick={() => submitTransfer(withdraw, funds.bank)}
              >
                Withdraw cash
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Each transfer takes 3 minutes in game.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Visit a bank or ATM to transfer between cash and your bank balance.{" "}
            {currentLocation && (
              <Link className="font-semibold text-primary underline" to="/map">
                Open city map
              </Link>
            )}
          </p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="game-panel p-5">
          <p className="text-sm font-semibold text-muted-foreground">Lifetime income</p>
          <p className="font-display text-2xl font-bold text-primary">
            {formatNaira(wallet?.total_income)}
          </p>
        </div>
        <div className="game-panel p-5">
          <p className="text-sm font-semibold text-muted-foreground">Lifetime expenses</p>
          <p className="font-display text-2xl font-bold text-clay">
            {formatNaira(wallet?.total_expenses)}
          </p>
        </div>
      </div>

      <section aria-labelledby="transactions-heading">
        <h2 id="transactions-heading" className="mb-3 text-2xl font-bold">
          Recent transactions
        </h2>
        {!txs?.length ? (
          <EmptyState
            title="No transactions"
            body="Earn or spend money in the city to see activity here."
          />
        ) : (
          <ul className="game-panel divide-y-2 divide-edge/10 p-0">
            {txs.map((transaction) => {
              const income = transaction.kind === "income";
              return (
                <li key={transaction.id} className="flex items-center gap-3 p-4">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 border-edge ${income ? "bg-leaf" : "bg-clay text-clay-foreground"}`}
                  >
                    {income ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {transactionTitle(
                        transaction.transaction_type,
                        transaction.description,
                        transaction.category,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.description} · {transaction.account} ·{" "}
                      {new Date(transaction.created_at).toLocaleString("en-NG")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-display font-bold ${income ? "text-primary" : "text-clay"}`}
                    >
                      {income ? "+" : "−"}
                      {formatNaira(Math.abs(Number(transaction.amount)))}
                    </p>
                    {transaction.balance_after !== null && (
                      <p className="text-xs text-muted-foreground">
                        Balance {formatNaira(transaction.balance_after)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
