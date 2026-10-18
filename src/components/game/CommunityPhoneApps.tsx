import { useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Bike,
  CalendarDays,
  ChevronRight,
  Newspaper,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";

export type CommunityPhoneApp =
  "Calendar" | "Food Delivery" | "Okada Rides" | "Contribution" | "Leaderboard" | "Town News";

const agenda = [
  { time: "09:00", title: "Market fresh-stock drop", place: "Oja-ọba Market" },
  { time: "14:00", title: "Community football practice", place: "Freedom Park" },
  { time: "18:30", title: "Neighbourhood meeting", place: "Oke-Fia Hall" },
];
const meals = [
  { name: "Amala & ewedu", shop: "Iya Mufu Kitchen", price: 1800, eta: "22–30 min" },
  { name: "Jollof rice bowl", shop: "Adebayo Bites", price: 2200, eta: "25–35 min" },
  { name: "Suya wrap", shop: "Sabo Grill", price: 1500, eta: "18–25 min" },
];
const riders = ["Oja-ọba Market", "Freedom Park", "Oke-Fia Bus Stop", "Osun Mall"];
const ranks = [
  ["1", "Ayo Adekunle", "4,820"],
  ["2", "Tomi Ojo", "4,540"],
  ["3", "Sola Bamidele", "4,180"],
  ["4", "Kemi Alabi", "3,960"],
] as const;
const stories = [
  {
    tag: "Community",
    title: "Park clean-up this Saturday",
    body: "Bring gloves and meet at Freedom Park by 8:00.",
  },
  {
    tag: "Market",
    title: "New fabric stalls open at Oja-ọba",
    body: "Local makers are showing new Ankara and adire pieces.",
  },
  {
    tag: "Sports",
    title: "Five-a-side sign-up is open",
    body: "Create a team or join a neighbourhood side for Sunday.",
  },
];

function AppCard({ children }: { children: ReactNode }) {
  return <div className="phone-local-card">{children}</div>;
}

export function CommunityPhoneApps({ app }: { app: CommunityPhoneApp }) {
  const [basket, setBasket] = useState<string[]>([]);
  const [destination, setDestination] = useState(riders[0]);
  const [rideRequested, setRideRequested] = useState(false);
  const [contribution, setContribution] = useState(500);
  const [contributed, setContributed] = useState(false);
  const [reactionCount, setReactionCount] = useState(12);
  const foodTotal = useMemo(
    () =>
      meals.filter((meal) => basket.includes(meal.name)).reduce((sum, meal) => sum + meal.price, 0),
    [basket],
  );

  if (app === "Calendar")
    return (
      <div className="phone-local-app" aria-label="Town calendar">
        <header>
          <CalendarDays aria-hidden="true" />
          <span>
            <strong>Today in Osogbo</strong>
            <small>Tuesday · 3 local events</small>
          </span>
        </header>
        <div className="phone-local-list">
          {agenda.map((event) => (
            <AppCard key={event.title}>
              <time>{event.time}</time>
              <div>
                <strong>{event.title}</strong>
                <small>{event.place}</small>
              </div>
              <ChevronRight aria-hidden="true" />
            </AppCard>
          ))}
        </div>
        <button
          type="button"
          className="phone-local-action"
          onClick={() => window.alert("Reminder saved for this browser session.")}
        >
          <Bell aria-hidden="true" /> Add a reminder
        </button>
      </div>
    );

  if (app === "Food Delivery")
    return (
      <div className="phone-local-app" aria-label="Food delivery">
        <header>
          <UtensilsCrossed aria-hidden="true" />
          <span>
            <strong>Food delivery</strong>
            <small>Local kitchens · mock ordering only</small>
          </span>
        </header>
        <div className="phone-local-list">
          {meals.map((meal) => {
            const chosen = basket.includes(meal.name);
            return (
              <AppCard key={meal.name}>
                <div>
                  <strong>{meal.name}</strong>
                  <small>
                    {meal.shop} · {meal.eta}
                  </small>
                  <b>₦{meal.price.toLocaleString("en-NG")}</b>
                </div>
                <button
                  type="button"
                  aria-pressed={chosen}
                  onClick={() =>
                    setBasket((items) =>
                      chosen ? items.filter((item) => item !== meal.name) : [...items, meal.name],
                    )
                  }
                >
                  {chosen ? "Added" : "Add"}
                </button>
              </AppCard>
            );
          })}
        </div>
        <footer>
          <span>
            {basket.length
              ? `${basket.length} item${basket.length === 1 ? "" : "s"}`
              : "Your basket is empty"}
          </span>
          <button
            type="button"
            disabled={!basket.length}
            onClick={() => window.alert("Your mock order is being prepared.")}
          >
            Order · ₦{foodTotal.toLocaleString("en-NG")}
          </button>
        </footer>
      </div>
    );

  if (app === "Okada Rides")
    return (
      <div className="phone-local-app" aria-label="Okada rides">
        <header>
          <Bike aria-hidden="true" />
          <span>
            <strong>Okada rides</strong>
            <small>Quick local trips</small>
          </span>
        </header>
        <label className="phone-local-field">
          Destination
          <select value={destination} onChange={(event) => setDestination(event.target.value)}>
            {riders.map((place) => (
              <option key={place}>{place}</option>
            ))}
          </select>
        </label>
        <AppCard>
          <div>
            <strong>{rideRequested ? "Rider is on the way" : "Pickup: your current area"}</strong>
            <small>
              {rideRequested
                ? "Blue helmet · arriving in 4 minutes"
                : `${destination} · about 8 minutes`}
            </small>
          </div>
          <b>₦650</b>
        </AppCard>
        <button
          type="button"
          className="phone-local-action"
          onClick={() => setRideRequested((value) => !value)}
        >
          {rideRequested ? "Cancel ride" : "Request a ride"}
        </button>
      </div>
    );

  if (app === "Contribution")
    return (
      <div className="phone-local-app" aria-label="Community contribution">
        <header>
          <span>
            <strong>Oke-Fia community fund</strong>
            <small>Mock group contribution</small>
          </span>
          <b>68%</b>
        </header>
        <AppCard>
          <div>
            <strong>Streetlight repairs</strong>
            <small>₦68,000 of ₦100,000 pledged</small>
            <progress value="68" max="100">
              68%
            </progress>
          </div>
        </AppCard>
        <label className="phone-local-field">
          Contribution amount
          <input
            type="number"
            min="100"
            step="100"
            value={contribution}
            onChange={(event) => setContribution(Number(event.target.value))}
          />
        </label>
        <button type="button" className="phone-local-action" onClick={() => setContributed(true)}>
          {contributed
            ? "Contribution noted"
            : `Contribute ₦${contribution.toLocaleString("en-NG")}`}
        </button>
        <small className="phone-local-note">
          This is a local preview; no money or game balance changes.
        </small>
      </div>
    );

  if (app === "Leaderboard")
    return (
      <div className="phone-local-app" aria-label="Town leaderboard">
        <header>
          <Trophy aria-hidden="true" />
          <span>
            <strong>Town leaderboard</strong>
            <small>This week · community activity</small>
          </span>
        </header>
        <div className="phone-local-tabs">
          <button type="button" aria-pressed="true">
            Community
          </button>
          <button type="button">Work</button>
          <button type="button">Homes</button>
        </div>
        <ol className="phone-local-ranks">
          {ranks.map(([rank, name, score]) => (
            <li key={rank}>
              <b>{rank}</b>
              <span>
                <strong>{name}</strong>
                <small>{score} points</small>
              </span>
              <Trophy aria-hidden="true" />
            </li>
          ))}
        </ol>
      </div>
    );

  return (
    <div className="phone-local-app" aria-label="Town news feed">
      <header>
        <Newspaper aria-hidden="true" />
        <span>
          <strong>Town news</strong>
          <small>Local updates from around Osogbo</small>
        </span>
      </header>
      <div className="phone-local-list">
        {stories.map((story, index) => (
          <AppCard key={story.title}>
            <div>
              <small>{story.tag}</small>
              <strong>{story.title}</strong>
              <p>{story.body}</p>
            </div>
            <button
              type="button"
              onClick={() => index === 0 && setReactionCount((count) => count + 1)}
            >
              ♥ {index === 0 ? reactionCount : 8 + index}
            </button>
          </AppCard>
        ))}
      </div>
      <button
        type="button"
        className="phone-local-action"
        onClick={() => window.alert("Post composer is available in this local preview.")}
      >
        Share a town update
      </button>
    </div>
  );
}
