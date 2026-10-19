import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark, ArrowDownLeft, ArrowUpRight, Wallet, History, Check, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
import { amountError } from "@/lib/economy-service";

export function PhoneBankApp() {
  const [tab, setTab] = useState<"overview" | "deposit" | "withdraw" | "history">("overview");
  const [amount, setAmount] = useState("");
  const { data: wallet, isLoading } = useQuery(q.wallet());
  const { data: txs } = useQuery(q.transactions());

  const deposit = useGameAction(rpc.depositCash, {
    onSuccess: () => {
      toast.success("Cash successfully deposited to your Osun Bank account.");
      setAmount("");
      setTab("overview");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Deposit failed"),
  });

  const withdraw = useGameAction(rpc.withdrawCash, {
    onSuccess: () => {
      toast.success("Cash successfully withdrawn to your wallet.");
      setAmount("");
      setTab("overview");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Withdrawal failed"),
  });

  const numAmount = Number(amount);
  const cashBalance = wallet?.balance ?? 0;
  const bankBalance = wallet?.bank_balance ?? 0;
  const totalNetWorth = cashBalance + bankBalance;

  const handleDeposit = () => {
    const err = amountError(numAmount, cashBalance);
    if (err) {
      toast.error(err);
      return;
    }
    deposit.mutate(numAmount);
  };

  const handleWithdraw = () => {
    const err = amountError(numAmount, bankBalance);
    if (err) {
      toast.error(err);
      return;
    }
    withdraw.mutate(numAmount);
  };

  return (
    <div className="phone-sub-app" role="region" aria-label="Bank and Finances">
      <div className="phone-sub-header">
        <div className="phone-segmented-tabs">
          <button
            type="button"
            className={tab === "overview" ? "is-active" : ""}
            onClick={() => setTab("overview")}
          >
            <Landmark className="h-4 w-4" aria-hidden="true" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            className={tab === "deposit" ? "is-active" : ""}
            onClick={() => {
              setAmount("");
              setTab("deposit");
            }}
          >
            <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
            <span>Deposit</span>
          </button>
          <button
            type="button"
            className={tab === "withdraw" ? "is-active" : ""}
            onClick={() => {
              setAmount("");
              setTab("withdraw");
            }}
          >
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            <span>Withdraw</span>
          </button>
          <button
            type="button"
            className={tab === "history" ? "is-active" : ""}
            onClick={() => setTab("history")}
          >
            <History className="h-4 w-4" aria-hidden="true" />
            <span>History</span>
          </button>
        </div>
      </div>

      <div className="phone-sub-content">
        {tab === "overview" ? (
          <div className="space-y-4 p-3">
            {/* Wealth Summary Card */}
            <div className="phone-card p-4 bg-gradient-to-br from-blue-900/40 to-slate-900/60 border-blue-500/30 text-white space-y-3">
              <div className="flex items-center justify-between text-xs opacity-80">
                <span>First Bank of Osun</span>
                <span className="font-semibold uppercase tracking-wider">Account Active</span>
              </div>
              <div>
                <span className="text-xs text-blue-200">Total Net Worth</span>
                <h3 className="text-2xl font-black">{formatNaira(totalNetWorth)}</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                <div>
                  <span className="opacity-70 block text-[11px]">Bank Savings</span>
                  <strong className="text-sm font-bold text-emerald-400">{formatNaira(bankBalance)}</strong>
                </div>
                <div>
                  <span className="opacity-70 block text-[11px]">Pocket Cash</span>
                  <strong className="text-sm font-bold text-amber-300">{formatNaira(cashBalance)}</strong>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTab("deposit")}
                className="p-3 rounded-xl border border-border bg-card hover:bg-accent text-left transition-all space-y-1"
              >
                <span className="flex items-center gap-1.5 font-bold text-xs text-primary">
                  <ArrowDownLeft className="h-4 w-4" /> Deposit Cash
                </span>
                <p className="text-[11px] text-muted-foreground">Save cash safely in your bank account</p>
              </button>

              <button
                type="button"
                onClick={() => setTab("withdraw")}
                className="p-3 rounded-xl border border-border bg-card hover:bg-accent text-left transition-all space-y-1"
              >
                <span className="flex items-center gap-1.5 font-bold text-xs text-primary">
                  <ArrowUpRight className="h-4 w-4" /> Withdraw Cash
                </span>
                <p className="text-[11px] text-muted-foreground">Get pocket money for market shopping</p>
              </button>
            </div>

            {/* Recent Mini Statement */}
            <div className="phone-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Recent Transactions</h4>
                <button
                  type="button"
                  onClick={() => setTab("history")}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  View All
                </button>
              </div>

              {txs && txs.length > 0 ? (
                <div className="space-y-2">
                  {txs.slice(0, 4).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                      <div>
                        <span className="font-semibold block truncate max-w-[180px]">{tx.description || tx.type}</span>
                        <small className="text-[10px] text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                        </small>
                      </div>
                      <span className={`font-bold ${tx.amount > 0 ? "text-emerald-600" : "text-foreground"}`}>
                        {tx.amount > 0 ? `+${formatNaira(tx.amount)}` : formatNaira(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2 text-center">No transactions recorded yet.</p>
              )}
            </div>
          </div>
        ) : tab === "deposit" ? (
          <div className="space-y-4 p-3">
            <div className="phone-card p-3 space-y-3">
              <div>
                <h4 className="font-bold text-sm">Deposit Cash to Bank</h4>
                <p className="text-xs text-muted-foreground">
                  Pocket Cash Available: <strong className="text-foreground">{formatNaira(cashBalance)}</strong>
                </p>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Amount (₦)</label>
                <input
                  type="number"
                  min={1}
                  max={cashBalance}
                  value={amount}
                  placeholder="e.g. 5000"
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-base font-bold px-3 py-2 rounded-lg border border-border bg-background outline-none"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {[1000, 5000, 20000].map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    disabled={cashBalance < preset}
                    onClick={() => setAmount(String(preset))}
                    className="py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold disabled:opacity-40"
                  >
                    +₦{preset.toLocaleString()}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={cashBalance <= 0}
                  onClick={() => setAmount(String(cashBalance))}
                  className="py-1.5 rounded-lg border border-primary bg-primary/10 text-primary text-xs font-bold disabled:opacity-40"
                >
                  All Cash
                </button>
              </div>

              <button
                type="button"
                disabled={numAmount <= 0 || numAmount > cashBalance || deposit.isPending}
                onClick={handleDeposit}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all mt-2"
              >
                {deposit.isPending ? "Depositing..." : `Deposit ${amount ? formatNaira(numAmount) : "Funds"}`}
              </button>
            </div>
          </div>
        ) : tab === "withdraw" ? (
          <div className="space-y-4 p-3">
            <div className="phone-card p-3 space-y-3">
              <div>
                <h4 className="font-bold text-sm">Withdraw Cash to Pocket</h4>
                <p className="text-xs text-muted-foreground">
                  Bank Savings Available: <strong className="text-foreground">{formatNaira(bankBalance)}</strong>
                </p>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Amount (₦)</label>
                <input
                  type="number"
                  min={1}
                  max={bankBalance}
                  value={amount}
                  placeholder="e.g. 2000"
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-base font-bold px-3 py-2 rounded-lg border border-border bg-background outline-none"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {[1000, 5000, 20000].map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    disabled={bankBalance < preset}
                    onClick={() => setAmount(String(preset))}
                    className="py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold disabled:opacity-40"
                  >
                    +₦{preset.toLocaleString()}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={bankBalance <= 0}
                  onClick={() => setAmount(String(bankBalance))}
                  className="py-1.5 rounded-lg border border-primary bg-primary/10 text-primary text-xs font-bold disabled:opacity-40"
                >
                  All Savings
                </button>
              </div>

              <button
                type="button"
                disabled={numAmount <= 0 || numAmount > bankBalance || withdraw.isPending}
                onClick={handleWithdraw}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all mt-2"
              >
                {withdraw.isPending ? "Withdrawing..." : `Withdraw ${amount ? formatNaira(numAmount) : "Funds"}`}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Account Transaction History
            </h4>
            {txs && txs.length > 0 ? (
              <div className="space-y-2">
                {txs.map((tx) => (
                  <div key={tx.id} className="phone-card flex items-center justify-between p-3 gap-3">
                    <div className="min-w-0">
                      <strong className="text-xs font-bold block truncate">{tx.description || tx.type}</strong>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString("en-NG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold flex-none ${
                        tx.amount > 0 ? "text-emerald-600" : "text-foreground"
                      }`}
                    >
                      {tx.amount > 0 ? `+${formatNaira(tx.amount)}` : formatNaira(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="phone-empty-state">
                <History className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">No transaction records found.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export default PhoneBankApp;
