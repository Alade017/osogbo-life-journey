import { createFileRoute, Link } from "@tanstack/react-router";
import { BusinessInvestmentApp } from "@/components/game/BusinessInvestmentApp";
import { PageHeader } from "@/components/game/ui";
import { Button } from "@/components/ui/button";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/_game/businesses")({
  head: () =>
    pageMeta("Businesses and investments", "Manage your simulated companies and investments."),
  validateSearch: (search: Record<string, unknown>): { mode: "company" | "invest" } => ({
    mode: search["mode"] === "invest" ? "invest" : "company",
  }),
  component: BusinessesPage,
});

function BusinessesPage() {
  const { mode } = Route.useSearch();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Build your working life"
        subtitle="Own a business or put your simulated savings to work."
      />
      <nav aria-label="Business and investment sections" className="flex gap-2">
        <Button asChild variant={mode === "company" ? "default" : "outline"}>
          <Link
            to="/businesses"
            search={{ mode: "company" }}
            aria-current={mode === "company" ? "page" : undefined}
          >
            Companies
          </Link>
        </Button>
        <Button asChild variant={mode === "invest" ? "default" : "outline"}>
          <Link
            to="/businesses"
            search={{ mode: "invest" }}
            aria-current={mode === "invest" ? "page" : undefined}
          >
            Investments
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/wallet">Wallet</Link>
        </Button>
      </nav>
      <section className="rounded-2xl" style={{ background: "var(--color-surface-dark)" }}>
        <BusinessInvestmentApp mode={mode} />
      </section>
    </div>
  );
}
