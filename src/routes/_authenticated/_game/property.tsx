import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/game";
import { loadOwnedHouses } from "@/lib/property-assets";
import { pageMeta } from "@/lib/seo";
import "@/components/map/map-ui.css";
import "@/components/game/housing/property-market.css";

export const Route = createFileRoute("/_authenticated/_game/property")({
  head: () => pageMeta("My Property", "Your houses, stalls, businesses and shares."),
  component: PropertyPage,
});

export function PropertyPage() {
  const client = useQueryClient();
  const characterQuery = useQuery(q.character());
  const character = characterQuery.data;
  const houses = useQuery({
    queryKey: ["ownedHouses", character?.id],
    enabled: !!character?.id,
    queryFn: () => loadOwnedHouses(character!.id),
  });
  const stalls = useQuery({
    queryKey: ["ownedStalls", character?.id],
    enabled: !!character?.id,
    queryFn: async () => {
      type Stall = { id: string; name: string; goods: string; is_open: boolean };
      const stallDb = supabase as unknown as {
        from: (table: "player_stalls") => {
          select: (columns: string) => {
            eq: (
              field: string,
              value: string,
            ) => Promise<{
              data: Stall[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
      const { data, error } = await stallDb
        .from("player_stalls")
        .select("id,name,goods,is_open")
        .eq("character_id", character!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
  const business = useQuery(q.businessMarket());
  const selectHome = useMutation({
    mutationFn: async (id: string) => {
      const call = supabase.rpc as unknown as (
        name: string,
        args: { p_player_property_id: string },
      ) => Promise<{ error: { message: string } | null }>;
      const { error } = await call("set_active_property_home", { p_player_property_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["ownedHouses"] }),
        client.invalidateQueries({ queryKey: ["canonicalHousingHome"] }),
        client.invalidateQueries({ queryKey: ["authoritativeHouseState"] }),
      ]);
      toast.success("Your active Home was saved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const pending =
    characterQuery.isPending ||
    business.isPending ||
    (Boolean(character?.id) && (houses.isPending || stalls.isPending));
  const error = characterQuery.error ?? houses.error ?? stalls.error ?? business.error;
  const homeRows = (houses.data ?? []).filter(
    (row) => row.tenure === "owned" && row.game_properties?.house_type_id,
  );
  const companyRows = business.data?.myCompanies ?? [];
  const shareRows = business.data?.myCompanyInvestments ?? [];
  const empty =
    homeRows.length + (stalls.data?.length ?? 0) + companyRows.length + shareRows.length === 0;
  return (
    <main className="property-market-page">
      <header className="property-market-hero map-sheet">
        <p className="map-sheet-eyebrow">YOUR ASSETS</p>
        <h1>Property</h1>
        <p>Your saved houses, stalls, businesses and shares.</p>
        <nav aria-label="Housing navigation">
          <Link to="/house">Home</Link>
          <Link to="/rentals">Rent homes</Link>
          <Link to="/properties">Find Homes</Link>
        </nav>
      </header>
      {error ? (
        <div className="property-market-message" role="alert">
          <p>{error.message}</p>
          <button
            className="map-primary-button"
            onClick={() => {
              void characterQuery.refetch();
              if (character?.id) {
                void houses.refetch();
                void stalls.refetch();
              }
              void business.refetch();
            }}
          >
            Try again
          </button>
        </div>
      ) : pending ? (
        <p className="property-market-message" role="status">
          Loading your assets…
        </p>
      ) : empty ? (
        <div className="property-market-message">
          <p>You do not own any assets yet.</p>
          <Link className="map-primary-button" to="/properties">
            Find Homes
          </Link>
        </div>
      ) : (
        <>
          {homeRows.length > 0 && (
            <section className="property-market-district">
              <h2>Houses</h2>
              <div className="property-market-grid">
                {homeRows.map((row) => (
                  <article className="property-market-card map-sheet" key={row.id}>
                    {row.game_properties?.image_url && (
                      <img
                        src={row.game_properties.image_url}
                        alt={row.game_properties.name}
                        loading="lazy"
                      />
                    )}
                    <div className="property-market-card-body">
                      <h3>{row.game_properties?.name}</h3>
                      <p>
                        {row.game_properties?.metadata?.district ?? "Residential District"} · Owned
                      </p>
                      <div className="property-market-actions">
                        {row.is_home ? (
                          <Link className="map-primary-button" to="/house">
                            Open Home
                          </Link>
                        ) : (
                          <button
                            className="map-primary-button"
                            disabled={selectHome.isPending}
                            onClick={() => selectHome.mutate(row.id)}
                          >
                            {selectHome.isPending && selectHome.variables === row.id
                              ? "Saving…"
                              : "Set as Home"}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {(stalls.data?.length ?? 0) > 0 && (
            <section className="property-market-district">
              <h2>Stalls</h2>
              <div className="property-market-grid">
                {stalls.data?.map((stall) => (
                  <article className="property-market-card map-sheet" key={stall.id}>
                    <div className="property-market-card-body">
                      <h3>{stall.name}</h3>
                      <p>{stall.goods}</p>
                      <small>{stall.is_open ? "Open" : "Closed"}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {companyRows.length > 0 && (
            <section className="property-market-district">
              <h2>Businesses</h2>
              <div className="property-market-grid">
                {companyRows.map((company) => (
                  <article className="property-market-card map-sheet" key={company.id}>
                    <div className="property-market-card-body">
                      <h3>{company.name}</h3>
                      <p>{company.location}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {shareRows.length > 0 && (
            <section className="property-market-district">
              <h2>Shares</h2>
              <div className="property-market-grid">
                {shareRows.map((holding) => (
                  <article className="property-market-card map-sheet" key={holding.companyId}>
                    <div className="property-market-card-body">
                      <h3>{holding.name}</h3>
                      <p>{holding.shares} shares</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
