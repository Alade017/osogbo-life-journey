import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CircleUserRound,
  House,
  MapPinned,
  Package,
  Settings,
  ShoppingBag,
  Target,
  WalletCards,
} from "lucide-react";

export type PhoneContentPreviewApp =
  | "Home"
  | "Find homes"
  | "Bank"
  | "Market"
  | "Education"
  | "Map"
  | "People"
  | "Inventory"
  | "Profile"
  | "Businesses"
  | "Missions"
  | "Notifications"
  | "Settings";

const previews: Record<
  PhoneContentPreviewApp,
  { icon: typeof House; title: string; subtitle: string; rows: string[] }
> = {
  Home: {
    icon: House,
    title: "Home",
    subtitle: "Your life at a glance",
    rows: ["Needs and daily routine", "Your latest activity", "Quick city access"],
  },
  "Find homes": {
    icon: Building2,
    title: "Find homes",
    subtitle: "Browse available places",
    rows: ["Rooms near Oke-Fia", "Family flats at Aregbe", "Saved property searches"],
  },
  Bank: {
    icon: WalletCards,
    title: "Bank",
    subtitle: "Game wallet and recent activity",
    rows: ["Wallet overview", "Recent transactions", "Savings and investment tools"],
  },
  Market: {
    icon: ShoppingBag,
    title: "Market",
    subtitle: "Shop for useful items",
    rows: ["Food and essentials", "Furniture and home items", "Daily market offers"],
  },
  Education: {
    icon: BriefcaseBusiness,
    title: "Education",
    subtitle: "Courses and career skills",
    rows: ["Course catalogue", "Skill progress", "Campus information"],
  },
  Map: {
    icon: MapPinned,
    title: "City map",
    subtitle: "Explore Osogbo",
    rows: ["Nearby places", "Travel options", "District highlights"],
  },
  People: {
    icon: CircleUserRound,
    title: "People",
    subtitle: "Meet the town",
    rows: ["Players nearby", "Friends and messages", "Community activity"],
  },
  Inventory: {
    icon: Package,
    title: "Inventory",
    subtitle: "Your carried items",
    rows: ["Useful items", "Home furnishings", "Equipment and rewards"],
  },
  Profile: {
    icon: CircleUserRound,
    title: "Profile",
    subtitle: "Your character journey",
    rows: ["Skills and milestones", "Appearance", "Account details"],
  },
  Businesses: {
    icon: Building2,
    title: "Businesses",
    subtitle: "Companies and investments",
    rows: ["Business opportunities", "Your companies", "Investment overview"],
  },
  Missions: {
    icon: Target,
    title: "Missions",
    subtitle: "Goals for today",
    rows: ["Active missions", "Rewards ready to claim", "Completed milestones"],
  },
  Notifications: {
    icon: Bell,
    title: "Notifications",
    subtitle: "Town updates",
    rows: ["Unread updates", "Mission reminders", "Social activity"],
  },
  Settings: {
    icon: Settings,
    title: "Settings",
    subtitle: "Game preferences",
    rows: ["Sound and music", "Reduced motion", "Account and privacy"],
  },
};

export function PhoneContentPreview({ app }: { app: PhoneContentPreviewApp }) {
  const data = previews[app];
  const Icon = data.icon;
  return (
    <section className="phone-local-app phone-content-preview" aria-label={`${data.title} preview`}>
      <header>
        <Icon aria-hidden="true" />
        <span>
          <strong>{data.title}</strong>
          <small>{data.subtitle}</small>
        </span>
      </header>
      <p className="phone-local-note">
        Open the full game page from the navigation when you need to make changes.
      </p>
      <div className="phone-local-list">
        {data.rows.map((row) => (
          <div className="phone-local-card" key={row}>
            <div>
              <strong>{row}</strong>
              <small>Available in the full game view</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
