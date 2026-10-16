import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ChartNoAxesCombined,
  Coins,
  Landmark,
  LockKeyhole,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { formatNaira, q, rpc } from "@/lib/game";
import { investmentAmountError } from "@/lib/business-service";
import "./business-investment.css";

export function BusinessInvestmentApp({ mode }: { mode: "company" | "invest" }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("10000");
  const marketQuery = useQuery(q.businessMarket());
  const data = marketQuery.data;
  const mutation = useMutation({
    mutationFn: rpc.businessAction,
    retry: false,
    onSuccess: async () => {
      toast.success("Your game finances have been updated.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["businessInvestmentMarket"] }),
        qc.invalidateQueries({ queryKey: ["wallet"] }),
        qc.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (marketQuery.isPending) return <p className="p-5 text-sm">Loading your game finances…</p>;
  if (marketQuery.error || !data)
    return (
      <div className="p-5">
        <p role="alert">{marketQuery.error?.message ?? "Unable to load the finance market."}</p>
        <Button onClick={() => void marketQuery.refetch()}>Retry</Button>
      </div>
    );

  const activeFixed = data.myInvestments.filter((item) => !item.cancelledAt && !item.claimedAt);
  const investedTotal = activeFixed.reduce((sum, item) => sum + item.principal, 0);
  const expectedReturn = activeFixed.reduce(
    (sum, item) => sum + Math.floor((item.principal * item.yieldBps) / 10_000),
    0,
  );

  return (
    <div className="phone-finance-app business-finance-app">
      {mutation.isError && (
        <div role="alert">
          <p>{mutation.error.message}</p>
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.variables && mutation.mutate(mutation.variables)}
          >
            Retry last action
          </Button>
        </div>
      )}
      <p className="phone-finance-disclaimer">
        Virtual in-game Naira only. These features have no real-world value.
      </p>
      {mode === "invest" && (
        <section className="investment-summary" aria-label="Investment portfolio summary">
          <div>
            <WalletCards size={17} />
            <span>Active principal</span>
            <strong>{formatNaira(investedTotal)}</strong>
          </div>
          <div>
            <TrendingUp size={17} />
            <span>Expected return</span>
            <strong>{formatNaira(expectedReturn)}</strong>
          </div>
          <div>
            <Coins size={17} />
            <span>Open products</span>
            <strong>{activeFixed.length}</strong>
          </div>
        </section>
      )}
      {mode === "company" ? (
        <>
          <h2>
            <Building2 size={18} /> Your companies
          </h2>
          <div className="phone-finance-list">
            {data.myCompanies.map((company) => (
              <article className="phone-finance-card" key={company.id}>
                <div>
                  <strong>{company.name}</strong>
                  <small>
                    {company.location} · bought for {formatNaira(company.purchasePrice)}
                  </small>
                </div>
                <div className="phone-company-services">
                  {company.services.map((service) => (
                    <label key={service.id}>
                      {service.name}
                      <input
                        aria-label={`${company.name} ${service.name} price`}
                        type="number"
                        min={service.minPrice}
                        max={service.maxPrice}
                        defaultValue={company.prices[service.id] ?? service.defaultPrice}
                        id={`price-${company.id}-${service.id}`}
                      />
                    </label>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => {
                    const prices = Object.fromEntries(
                      company.services.map((service) => [
                        service.id,
                        Number(
                          (
                            document.getElementById(
                              `price-${company.id}-${service.id}`,
                            ) as HTMLInputElement | null
                          )?.value,
                        ),
                      ]),
                    );
                    mutation.mutate({ kind: "configure", id: company.id, prices });
                  }}
                >
                  Save service prices
                </Button>
                <label className="phone-finance-share-input">
                  Shares to offer (max 3,000)
                  <input
                    aria-label={`${company.name} shares to offer`}
                    type="number"
                    min={0}
                    max={3000}
                    defaultValue={company.sharesForSale}
                    id={`shares-${company.id}`}
                  />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      kind: "offer",
                      id: company.id,
                      shares: Number(
                        (document.getElementById(`shares-${company.id}`) as HTMLInputElement | null)
                          ?.value,
                      ),
                    })
                  }
                >
                  Offer shares
                </Button>
                <Button
                  size="sm"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ kind: "claimBusiness", id: company.id })}
                >
                  Collect simulated earnings
                </Button>
              </article>
            ))}
            {!data.myCompanies.length && (
              <p className="phone-finance-empty">You do not own a company yet.</p>
            )}
          </div>
          <h2>
            <Landmark size={18} /> Business opportunities
          </h2>
          <div className="phone-finance-list">
            {data.businesses.map((business) => (
              <article className="phone-finance-card" key={business.slug}>
                <strong>{business.name}</strong>
                <small>
                  {business.location} · {business.dailyCustomers} simulated daily customers
                </small>
                <p>{business.description}</p>
                <strong>{formatNaira(business.price)}</strong>
                <Button
                  size="sm"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      kind: "buy",
                      slug: business.slug,
                      requestId: crypto.randomUUID(),
                    })
                  }
                >
                  Buy company
                </Button>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <h2>
            <ChartNoAxesCombined size={18} /> Invest
          </h2>
          <label className="phone-finance-share-input">
            Investment amount in Naira
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <h3>
            <LockKeyhole size={16} /> Fixed-term products
          </h3>
          <div className="phone-finance-list">
            {data.products.map((product) => (
              <article className="phone-finance-card" key={product.slug}>
                <strong>{product.name}</strong>
                <small>
                  {product.termDays} days · {(product.yieldBps / 100).toFixed(0)}% fixed game return
                </small>
                <p>{product.description}</p>
                <small>
                  Minimum {formatNaira(product.minAmount)} · Maximum{" "}
                  {formatNaira(product.maxAmount)}
                </small>
                <Button
                  size="sm"
                  disabled={
                    mutation.isPending ||
                    !!investmentAmountError(Number(amount), product.minAmount, product.maxAmount)
                  }
                  onClick={() =>
                    mutation.mutate({
                      kind: "fixed",
                      slug: product.slug,
                      amount: Number(amount),
                      requestId: crypto.randomUUID(),
                    })
                  }
                >
                  Invest
                </Button>
              </article>
            ))}
          </div>
          <h3>
            <Coins size={16} /> Player-owned companies
          </h3>
          <div className="phone-finance-list">
            {data.companies
              .filter((company) => company.sharesForSale > 0 && !company.isOwner)
              .map((company) => (
                <article className="phone-finance-card" key={company.id}>
                  <strong>{company.name}</strong>
                  <small>
                    Owned by {company.owner} · {company.sharesForSale} shares offered at{" "}
                    {formatNaira(company.pricePerShare)} each
                  </small>
                  <label className="phone-finance-share-input">
                    Shares to buy
                    <input
                      type="number"
                      min={1}
                      max={Math.min(3000, company.sharesForSale)}
                      defaultValue={1}
                      id={`invest-shares-${company.id}`}
                    />
                  </label>
                  <Button
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        kind: "invest",
                        id: company.id,
                        requestId: crypto.randomUUID(),
                        shares: Number(
                          (
                            document.getElementById(
                              `invest-shares-${company.id}`,
                            ) as HTMLInputElement | null
                          )?.value,
                        ),
                      })
                    }
                  >
                    Buy shares
                  </Button>
                </article>
              ))}
            {!data.companies.some((company) => company.sharesForSale > 0 && !company.isOwner) && (
              <p className="phone-finance-empty">No players have offered company shares yet.</p>
            )}
          </div>
          <h3>Your investments</h3>
          {!data.myInvestments.length && !data.myCompanyInvestments.length && (
            <p className="phone-finance-empty">You do not have any investments yet.</p>
          )}
          {data.myCompanyInvestments.map((holding) => (
            <article className="phone-finance-card" key={holding.companyId}>
              <strong>{holding.name}</strong>
              <small>
                {holding.shares.toLocaleString("en-NG")} shares ·{" "}
                {(holding.shares / 100).toFixed(2)}% ownership
              </small>
            </article>
          ))}
          {data.myInvestments.map((investment) => (
            <article className="phone-finance-card" key={investment.id}>
              <strong>{investment.product}</strong>
              <small>
                {formatNaira(investment.principal)} · matures{" "}
                {new Date(investment.maturesAt).toLocaleString("en-NG", {
                  timeZone: "Africa/Lagos",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </small>
              {investment.cancelledAt ? (
                <small>Cancelled · principal returned; yield forfeited</small>
              ) : investment.claimedAt ? (
                <small>Claimed</small>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {new Date(investment.maturesAt).getTime() <= Date.now() ? (
                    <Button
                      size="sm"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ kind: "claimFixed", id: investment.id })}
                    >
                      Claim matured funds
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Cancel this investment? Your principal will be returned and the yield will be forfeited.",
                          )
                        )
                          mutation.mutate({
                            kind: "cancelFixed",
                            id: investment.id,
                            requestId: crypto.randomUUID(),
                          });
                      }}
                    >
                      Cancel investment
                    </Button>
                  )}
                </div>
              )}
              {!investment.cancelledAt && !investment.claimedAt && (
                <div
                  className="investment-progress"
                  aria-label={`Matures ${new Date(investment.maturesAt).toLocaleDateString("en-NG")}`}
                >
                  <span
                    style={{
                      width: `${Math.max(4, Math.min(100, 100 - ((new Date(investment.maturesAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000 * 30)) * 100))}%`,
                    }}
                  />
                </div>
              )}
            </article>
          ))}
        </>
      )}
    </div>
  );
}
