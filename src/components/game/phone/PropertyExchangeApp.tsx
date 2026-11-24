import { ArrowLeftRight, BadgeCheck, Building2, Sparkles } from "lucide-react";
import { PropertyMarketPanel } from "@/components/game/PropertyMarketPanel";
import { PropertySalePanel } from "@/components/game/PropertySalePanel";
import "./property-exchange-app.css";

/** Player-to-player listings and NPC buy-back, kept separate from home discovery. */
export function PropertyExchangeApp() {
  return (
    <div className="property-exchange-app">
      <header className="property-exchange-hero">
        <div className="property-exchange-kicker">
          <Sparkles size={14} />
          OSUN PROPERTY MARKET
        </div>
        <div className="property-exchange-title-row">
          <span className="property-exchange-mark">
            <Building2 />
          </span>
          <div>
            <h2>Property Exchange</h2>
            <p>List, trade and sell the properties you own.</p>
          </div>
        </div>
        <div className="property-exchange-promise">
          <BadgeCheck size={16} />
          <span>
            Secure in-game transactions with server-verified ownership and pricing
          </span>
        </div>
      </header>

      <section
        className="property-exchange-section"
        aria-labelledby="property-exchange-market-heading"
      >
        <div className="property-exchange-section-heading">
          <span className="property-exchange-section-icon">
            <ArrowLeftRight />
          </span>
          <div>
            <h3 id="property-exchange-market-heading">Player marketplace</h3>
            <p>Browse listings or put one of your homes up for sale.</p>
          </div>
        </div>
        <PropertyMarketPanel />
      </section>

      <section
        className="property-exchange-section property-exchange-buyback"
        aria-labelledby="property-exchange-buyback-heading"
      >
        <div className="property-exchange-section-heading">
          <span className="property-exchange-section-icon">
            <Building2 />
          </span>
          <div>
            <h3 id="property-exchange-buyback-heading">Sell to town buyers</h3>
            <p>Review the available NPC buy-back offers for your properties.</p>
          </div>
        </div>
        <PropertySalePanel />
      </section>
    </div>
  );
}

export default PropertyExchangeApp;
