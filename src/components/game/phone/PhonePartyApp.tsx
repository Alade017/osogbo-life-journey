import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PartyPopper, Music, Wine, Calendar, Sparkles, Flame, Check } from "lucide-react";
import { toast } from "sonner";
import { formatNaira, q } from "@/lib/game";

const CLUBS = [
  { id: "quilox", name: "Club Quilox Osogbo", vibe: "High Energy Afrobeats", crowd: "Packed", entryFee: 2000 },
  { id: "euphoria", name: "Euphoria Night Lounge", vibe: "Amapiano & Cocktails", crowd: "Lively", entryFee: 1500 },
  { id: "the-hive", name: "The Hive Rooftop", vibe: "Chill R&B & Highlife", crowd: "Moderate", entryFee: 1000 },
  { id: "riverside", name: "Riverside Chill Garden", vibe: "Palm Wine & Live Band", crowd: "Relaxed", entryFee: 500 },
];

const DANCE_MOVES = [
  { id: "gbese", name: "Gbese!", energy: 12, fun: 25, desc: "High leg jump move that ignites the crowd" },
  { id: "zanku", name: "Zanku Step", energy: 10, fun: 20, desc: "Rhythmic kicks and arm swings" },
  { id: "poco", name: "Poco Dance", energy: 15, fun: 30, desc: "Lightning fast footwork to upbeat drums" },
  { id: "shaku", name: "Shaku Shaku", energy: 8, fun: 15, desc: "Classic smooth groove shoulder sway" },
];

const DRINKS = [
  { id: "palm-wine", name: "Fresh Osun Palm Wine", price: 600, funGain: 15, energyGain: 5 },
  { id: "radler", name: "Chilled Star Radler", price: 800, funGain: 20, energyGain: 10 },
  { id: "chapman", name: "Special Osogbo Chapman", price: 1200, funGain: 25, energyGain: 15 },
  { id: "energy", name: "Fearless Energy Drink", price: 500, funGain: 10, energyGain: 30 },
  { id: "champagne", name: "Belaire Luxe Champagne", price: 15000, funGain: 80, energyGain: 20 },
];

const VENUES = [
  { id: "osun-hall", name: "Osun Royal Hall", capacity: 250, fee: 35000 },
  { id: "riverview", name: "Riverview Event Pavilion", capacity: 150, fee: 20000 },
  { id: "crown", name: "Crown Garden Events", capacity: 100, fee: 12000 },
];

export function PhonePartyApp() {
  const [tab, setTab] = useState<"clubs" | "drinks" | "host">("clubs");
  const { data: wallet } = useQuery(q.wallet());
  const [activeClub, setActiveClub] = useState(CLUBS[0]);
  const [partyMood, setPartyMood] = useState(65);
  const [lastMove, setLastMove] = useState<string | null>(null);

  // Host event form
  const [eventTitle, setEventTitle] = useState("Saturday Osogbo Groove");
  const [selectedVenue, setSelectedVenue] = useState(VENUES[0]?.id ?? "osun-hall");
  const [ticketPrice, setTicketPrice] = useState("1000");

  const handleDance = (move: (typeof DANCE_MOVES)[number]) => {
    setLastMove(move.name);
    setPartyMood((prev) => Math.min(100, prev + 8));
    toast.success(`You performed ${move.name}! Party mood increased! 🎉`);
  };

  const handleBuyDrink = (drink: (typeof DRINKS)[number]) => {
    if ((wallet?.balance ?? 0) < drink.price) {
      toast.error(`Not enough cash! You need ${formatNaira(drink.price)}.`);
      return;
    }
    toast.success(`Bought ${drink.name}! +${drink.funGain} Fun, +${drink.energyGain} Energy.`);
    setPartyMood((prev) => Math.min(100, prev + 5));
  };

  const handleHostEvent = () => {
    const venue = VENUES.find((v) => v.id === selectedVenue);
    if (!venue) return;
    if ((wallet?.balance ?? 0) < venue.fee) {
      toast.error(`Insufficient funds. Venue requires ${formatNaira(venue.fee)}.`);
      return;
    }
    toast.success(`Event "${eventTitle}" booked at ${venue.name}! Invites dispatched to Osogbo residents.`);
  };

  return (
    <div className="phone-sub-app" role="region" aria-label="Party Life">
      <div className="phone-sub-header">
        <div className="phone-segmented-tabs">
          <button
            type="button"
            className={tab === "clubs" ? "is-active" : ""}
            onClick={() => setTab("clubs")}
          >
            <Music className="h-4 w-4" aria-hidden="true" />
            <span>Clubs & Dance</span>
          </button>
          <button
            type="button"
            className={tab === "drinks" ? "is-active" : ""}
            onClick={() => setTab("drinks")}
          >
            <Wine className="h-4 w-4" aria-hidden="true" />
            <span>Drinks Bar</span>
          </button>
          <button
            type="button"
            className={tab === "host" ? "is-active" : ""}
            onClick={() => setTab("host")}
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span>Host Event</span>
          </button>
        </div>
      </div>

      <div className="phone-sub-content">
        {tab === "clubs" ? (
          <div className="space-y-4 p-3">
            {/* Live Party Mood Meter */}
            <div className="phone-card p-3 bg-gradient-to-r from-purple-950/40 to-pink-950/40 border-purple-500/30">
              <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                <span className="flex items-center gap-1.5 text-pink-400">
                  <Flame className="h-4 w-4" /> Live Party Mood
                </span>
                <span className="text-white">{partyMood}% Hot</span>
              </div>
              <div className="w-full bg-background/60 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-pink-500 to-amber-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${partyMood}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Dancing and buying drinks lifts the venue vibes and unlocks crowd rewards.
              </p>
            </div>

            {/* Club Selector */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2 px-1">
                Select Osogbo Venue
              </label>
              <div className="space-y-2">
                {CLUBS.map((club) => (
                  <button
                    type="button"
                    key={club.id}
                    onClick={() => setActiveClub(club)}
                    className={`w-full text-left phone-card p-3 transition-all ${
                      activeClub?.id === club.id ? "ring-2 ring-primary border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-sm font-bold">{club.name}</strong>
                      <span className="text-xs font-bold text-primary">{formatNaira(club.entryFee)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span>{club.vibe}</span>
                      <span className="font-semibold text-emerald-600">{club.crowd}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Dance Floor Moves */}
            <div className="phone-card p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-500" /> Dance Floor Moves
                </h4>
                {lastMove && <span className="text-xs text-pink-500 font-bold">Done: {lastMove}</span>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {DANCE_MOVES.map((move) => (
                  <button
                    type="button"
                    key={move.id}
                    onClick={() => handleDance(move)}
                    className="p-2.5 rounded-xl border border-border bg-card hover:bg-accent text-left transition-all space-y-1"
                  >
                    <span className="font-bold text-xs block text-foreground">{move.name}</span>
                    <span className="text-[10px] text-muted-foreground block leading-tight">{move.desc}</span>
                    <span className="text-[10px] text-pink-600 dark:text-pink-400 font-bold block pt-0.5">
                      +{move.fun} Fun · -{move.energy} Energy
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : tab === "drinks" ? (
          <div className="space-y-3 p-3">
            <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
              <span>Club Bar Menu: {activeClub?.name ?? "Lounge"}</span>
              <span>Cash: <strong className="text-foreground">{formatNaira(wallet?.balance)}</strong></span>
            </div>

            <div className="space-y-2">
              {DRINKS.map((drink) => (
                <div key={drink.id} className="phone-card flex items-center justify-between p-3 gap-3">
                  <div className="min-w-0">
                    <strong className="text-sm font-bold block">{drink.name}</strong>
                    <span className="text-xs text-muted-foreground">
                      +{drink.funGain} Fun · +{drink.energyGain} Energy
                    </span>
                    <span className="text-xs font-bold text-primary block mt-0.5">
                      {formatNaira(drink.price)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBuyDrink(drink)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex-none"
                  >
                    Order Drink
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-3">
            <div className="phone-card p-3 space-y-3">
              <div className="border-b border-border/40 pb-2">
                <h4 className="font-bold text-sm">Host a Community Event</h4>
                <p className="text-xs text-muted-foreground">
                  Book a venue, invite guests, and earn ticket proceeds.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Event Name</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Choose Venue</label>
                <div className="space-y-1.5">
                  {VENUES.map((venue) => (
                    <button
                      type="button"
                      key={venue.id}
                      onClick={() => setSelectedVenue(venue.id)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                        selectedVenue === venue.id
                          ? "bg-primary/10 border-primary font-bold"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="flex justify-between">
                        <span>{venue.name}</span>
                        <span className="font-bold">{formatNaira(venue.fee)}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Capacity: {venue.capacity} guests</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Ticket Entry Fee (₦)</label>
                <input
                  type="number"
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleHostEvent}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 mt-2"
              >
                Publish & Host Event
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default PhonePartyApp;
