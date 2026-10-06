import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Info } from "lucide-react";
import { q, formatNaira } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { EmptyState, LoadingBricks, PageHeader } from "@/components/game/ui";

export const Route = createFileRoute("/_authenticated/_game/wallet")({
  head: () => pageMeta("Wallet", "Your in-game Naira balance and transaction history."),
  component: WalletPage,
});

function WalletPage() {
  const { data: wallet, isLoading } = useQuery(q.wallet());
  const { data: txs } = useQuery(q.transactions());
  if (isLoading) return <LoadingBricks />;

  return (
    <div className="space-y-5">
      <PageHeader title="Wallet" />
      <div className="brick flex items-start gap-2 bg-sun p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>All money in OSOGBO LIFE is <strong>virtual in-game currency</strong>. It has no real-world value and cannot be withdrawn or exchanged for real Naira.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="brick bg-primary p-5 text-primary-foreground sm:col-span-1">
          <p className="text-sm font-semibold">Balance</p>
          <p className="font-display text-4xl font-bold">{formatNaira(wallet?.balance)}</p>
        </div>
        <div className="brick p-5"><p className="text-sm font-semibold text-muted-foreground">Total income</p><p className="font-display text-2xl font-bold text-primary">{formatNaira(wallet?.total_income)}</p></div>
        <div className="brick p-5"><p className="text-sm font-semibold text-muted-foreground">Total expenses</p><p className="font-display text-2xl font-bold text-clay">{formatNaira(wallet?.total_expenses)}</p><p className="text-xs text-muted-foreground">Spending (rent, food, shops) arrives in a later phase.</p></div>
      </div>
      <div>
        <h2 className="mb-3 text-2xl font-bold">Recent transactions</h2>
        {!txs?.length ? (
          <EmptyState title="No transactions" body="Work a shift to see income here." />
        ) : (
          <ul className="brick divide-y-2 divide-edge/10 p-0">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-4">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 border-edge ${t.kind === "income" ? "bg-leaf" : "bg-clay text-clay-foreground"}`}>
                  {t.kind === "income" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("en-NG")}</p>
                </div>
                <span className={`font-display font-bold ${t.kind === "income" ? "text-primary" : "text-clay"}`}>
                  {t.kind === "income" ? "+" : "−"}{formatNaira(Math.abs(Number(t.amount)))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
