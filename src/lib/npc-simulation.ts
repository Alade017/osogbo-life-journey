import type { GameTime } from "@/lib/game-time";

export type NpcTrait = "warm" | "reserved" | "ambitious" | "playful" | "thoughtful" | "creative";
export type NpcDefinition = {
  id: string;
  name: string;
  role: string;
  occupation: string;
  personality: NpcTrait;
  homeSlug: string;
  workSlug: string;
  interests: string[];
  topics: string[];
  routine: {
    start: number;
    end: number;
    destination: "work" | "home" | "market" | "park";
    activity: string;
  }[];
};
export type NpcActivity = { destinationSlug: string; label: string; available: boolean };
export type Relationship = {
  friendship: number;
  romance: number;
  trust: number;
  conflict: number;
  meetings: number;
  lastInteractionDay: number | null;
  lastInteractionText: string | null;
};
export type SocialAction =
  | "greet"
  | "work"
  | "events"
  | "interests"
  | "joke"
  | "compliment"
  | "help"
  | "invite"
  | "romance"
  | "end";

export const NPC_CATALOG: NpcDefinition[] = [
  {
    id: "npc-adeola",
    name: "Adeola Akinyemi",
    role: "Market trader",
    occupation: "Sells fresh produce at Oja Oba",
    personality: "warm",
    homeSlug: "residential",
    workSlug: "oja-oba",
    interests: ["cooking", "family", "market stories"],
    topics: ["The best pepper stalls", "Sunday cooking", "A busy market morning"],
    routine: [
      { start: 7, end: 16, destination: "work", activity: "selling produce" },
      { start: 16, end: 18, destination: "market", activity: "picking up groceries" },
      { start: 18, end: 24, destination: "home", activity: "resting at home" },
      { start: 0, end: 7, destination: "home", activity: "sleeping" },
    ],
  },
  {
    id: "npc-tunde",
    name: "Tunde Bakare",
    role: "Apprentice mechanic",
    occupation: "Learning vehicle repairs",
    personality: "playful",
    homeSlug: "residential",
    workSlug: "old-garage",
    interests: ["football", "engines", "music"],
    topics: ["Weekend football", "A tricky engine repair", "New music in town"],
    routine: [
      { start: 8, end: 17, destination: "work", activity: "working on repairs" },
      { start: 17, end: 20, destination: "park", activity: "meeting friends" },
      { start: 20, end: 24, destination: "home", activity: "winding down" },
      { start: 0, end: 8, destination: "home", activity: "sleeping" },
    ],
  },
  {
    id: "npc-morenike",
    name: "Morenike Bello",
    role: "Community teacher",
    occupation: "Teaches at a local school",
    personality: "thoughtful",
    homeSlug: "residential",
    workSlug: "student-district",
    interests: ["books", "young people", "local history"],
    topics: ["A book worth reading", "School life", "Osogbo history"],
    routine: [
      { start: 7, end: 15, destination: "work", activity: "teaching a class" },
      { start: 15, end: 17, destination: "market", activity: "running errands" },
      { start: 17, end: 21, destination: "park", activity: "taking an evening walk" },
      { start: 21, end: 24, destination: "home", activity: "preparing lessons" },
      { start: 0, end: 7, destination: "home", activity: "sleeping" },
    ],
  },
  {
    id: "npc-kunle",
    name: "Kunle Adesina",
    role: "Café owner",
    occupation: "Runs a small neighbourhood café",
    personality: "ambitious",
    homeSlug: "residential",
    workSlug: "oke-fia",
    interests: ["business", "football", "hospitality"],
    topics: ["Growing a small business", "The café regulars", "A big match coming up"],
    routine: [
      { start: 6, end: 15, destination: "work", activity: "opening the café" },
      { start: 15, end: 17, destination: "market", activity: "buying supplies" },
      { start: 17, end: 19, destination: "park", activity: "catching up with friends" },
      { start: 19, end: 24, destination: "home", activity: "reviewing the day" },
      { start: 0, end: 6, destination: "home", activity: "sleeping" },
    ],
  },
  {
    id: "npc-bisola",
    name: "Bisola Ogunleye",
    role: "Local artist",
    occupation: "Creates murals and community art",
    personality: "creative",
    homeSlug: "residential",
    workSlug: "cultural-district",
    interests: ["art", "music", "culture"],
    topics: ["A new mural idea", "Osogbo's creative scene", "Favourite colours"],
    routine: [
      { start: 9, end: 14, destination: "work", activity: "working on a mural" },
      { start: 14, end: 16, destination: "market", activity: "finding art supplies" },
      { start: 16, end: 19, destination: "park", activity: "sketching outdoors" },
      { start: 19, end: 24, destination: "home", activity: "making art at home" },
      { start: 0, end: 9, destination: "home", activity: "resting" },
    ],
  },
];

export function npcActivityAt(
  npc: NpcDefinition,
  time: GameTime,
  locationBySlug: (slug: string) => string | null,
  weather: "sunny" | "cloudy" | "rainy" | "heavy-rain" = "sunny",
): NpcActivity {
  const routine = npc.routine.find((entry) => time.hour >= entry.start && time.hour < entry.end);
  const weatherFallback =
    (weather === "rainy" || weather === "heavy-rain") && routine?.destination === "park";
  const destination = weatherFallback
    ? npc.homeSlug
    : routine?.destination === "work"
      ? npc.workSlug
      : routine?.destination === "home"
        ? npc.homeSlug
        : routine?.destination === "market"
          ? "oja-oba"
          : "cultural-district";
  const destinationSlug = locationBySlug(destination) ? destination : npc.homeSlug;
  return {
    destinationSlug,
    label: weatherFallback
      ? "staying indoors during the rain"
      : (routine?.activity ?? "taking a quiet break"),
    available: time.hour >= 7 && time.hour < 22,
  };
}

export function relationshipTier(value: Relationship): string {
  if (value.conflict >= 55) return "Strained";
  if (value.friendship >= 75 && value.trust >= 60) return "Close friend";
  if (value.friendship >= 40) return "Friend";
  if (value.meetings > 0) return "Acquaintance";
  return "New face";
}

export function interactionOutcome(
  action: SocialAction,
  npc: NpcDefinition,
  value: Relationship,
): { accepted: boolean; changes: Partial<Relationship>; message: string } {
  if (action === "end") return { accepted: true, changes: {}, message: "You say goodbye for now." };
  if (
    action === "romance" &&
    (value.meetings < 4 || value.friendship < 55 || value.trust < 40 || value.conflict >= 30)
  )
    return {
      accepted: false,
      changes: { conflict: 1 },
      message: "It feels too soon for that. Keep building trust and friendship first.",
    };
  if (action === "invite" && (value.friendship < 40 || value.trust < 25))
    return {
      accepted: false,
      changes: { conflict: 1 },
      message: "You need a stronger friendship before inviting them along.",
    };
  if (value.conflict >= 70 && action !== "greet")
    return {
      accepted: false,
      changes: { conflict: 1 },
      message: `${npc.name} needs some space right now.`,
    };
  const shy = npc.personality === "reserved";
  if (shy && ["joke", "compliment", "romance"].includes(action) && value.friendship < 25)
    return {
      accepted: false,
      changes: { conflict: 1 },
      message: `${npc.name} seems uncomfortable. A simple greeting may work better.`,
    };
  const changes: Partial<Relationship> = { meetings: 1, lastInteractionText: actionLabel(action) };
  if (action === "greet") {
    changes.friendship = 2;
    changes.trust = 1;
  }
  if (action === "work") {
    changes.friendship = 3;
    changes.trust = 2;
  }
  if (action === "events") {
    changes.friendship = 3;
    changes.trust = 1;
  }
  if (action === "interests") {
    changes.friendship = npc.personality === "thoughtful" || npc.personality === "creative" ? 6 : 4;
    changes.trust = 2;
  }
  if (action === "joke") {
    changes.friendship = npc.personality === "playful" || npc.personality === "warm" ? 6 : 2;
    changes.trust = 1;
  }
  if (action === "compliment") {
    changes.friendship = 3;
    changes.trust = 2;
  }
  if (action === "help") {
    changes.friendship = 5;
    changes.trust = 7;
  }
  if (action === "invite") {
    changes.friendship = 3;
    changes.trust = 2;
  }
  if (action === "romance") {
    changes.romance = 3;
    changes.trust = 2;
  }
  return {
    accepted: true,
    changes,
    message:
      action === "interests"
        ? `You and ${npc.name} found something to talk about.`
        : `You ${actionLabel(action).toLowerCase()} with ${npc.name}.`,
  };
}

export function actionLabel(action: SocialAction) {
  return {
    greet: "Shared a greeting",
    work: "Talked about work",
    events: "Discussed local events",
    interests: "Shared interests",
    joke: "Shared a joke",
    compliment: "Offered a compliment",
    help: "Offered help",
    invite: "Made an invitation",
    romance: "Shared a romantic moment",
    end: "Said goodbye",
  }[action];
}

export function socialActionsFor(value: Relationship, available: boolean): SocialAction[] {
  if (!available) return [];
  const actions: SocialAction[] = [
    "greet",
    "work",
    "events",
    "interests",
    "joke",
    "compliment",
    "help",
  ];
  if (value.meetings >= 4 && value.friendship >= 55 && value.trust >= 40 && value.conflict < 30)
    actions.push("romance");
  if (value.friendship >= 40 && value.trust >= 25 && value.conflict < 50) actions.push("invite");
  actions.push("end");
  return actions;
}
