import { advanceGameTime, type GameTime } from "@/lib/game-time";

export const NEED_NAMES = ["hunger", "energy", "hygiene", "bladder", "fun", "social"] as const;
export type NeedName = (typeof NEED_NAMES)[number];
export type Needs = Record<NeedName, number>;
export type CharacterTrait =
  "ambitious" | "sociable" | "creative" | "disciplined" | "frugal" | "studious" | "easygoing";
export type MoodName =
  | "happy"
  | "tired"
  | "hungry"
  | "stressed"
  | "confident"
  | "bored"
  | "socially fulfilled"
  | "embarrassed";
export type LifeActionId =
  | "eat"
  | "cook"
  | "shower"
  | "toilet"
  | "sleep"
  | "watch_tv"
  | "study"
  | "exercise"
  | "socialize"
  | "travel";
export type ActivityAnimation =
  | "eating"
  | "cooking"
  | "showering"
  | "using_toilet"
  | "sleeping"
  | "watching"
  | "studying"
  | "exercising"
  | "socializing"
  | "walking";

export type LifeAction = {
  id: LifeActionId;
  name: string;
  durationMinutes: number;
  requiredLocation: "any" | "home" | "workplace" | "school";
  requiredFurniture?: string;
  minimumLevel?: number;
  cost: number;
  reward: number;
  needs: Partial<Record<NeedName, number>>;
  skill?: string;
  skillXp: number;
  experienceReward?: number;
  animation: ActivityAnimation;
  precondition?: (state: SimulationState) => string | null;
  outcome: string;
};

export const NEED_RULES: Record<
  NeedName,
  { decayPerMinute: number; warning: number; critical: number; label: string; icon: string }
> = {
  hunger: { decayPerMinute: 0.035, warning: 35, critical: 15, label: "Hunger", icon: "utensils" },
  energy: { decayPerMinute: 0.025, warning: 35, critical: 15, label: "Energy", icon: "zap" },
  hygiene: { decayPerMinute: 0.018, warning: 30, critical: 12, label: "Hygiene", icon: "sparkles" },
  bladder: { decayPerMinute: 0.03, warning: 30, critical: 12, label: "Bladder", icon: "droplets" },
  fun: { decayPerMinute: 0.02, warning: 35, critical: 15, label: "Fun", icon: "smile" },
  social: { decayPerMinute: 0.012, warning: 35, critical: 15, label: "Social", icon: "users" },
};

const atHome = (state: SimulationState) =>
  state.locationType === "home" ? null : "You need to be at home for this action.";
const ACTION_LIST: LifeAction[] = [
  {
    id: "eat",
    name: "Eat a meal",
    durationMinutes: 20,
    requiredLocation: "any",
    cost: 0,
    reward: 0,
    needs: { hunger: 35, fun: 3 },
    skillXp: 0,
    animation: "eating",
    outcome: "You enjoyed a meal.",
  },
  {
    id: "cook",
    name: "Cook a meal",
    durationMinutes: 35,
    requiredLocation: "home",
    requiredFurniture: "stove",
    cost: 0,
    reward: 0,
    needs: { hunger: 25, fun: 5 },
    skill: "cooking",
    skillXp: 8,
    animation: "cooking",
    outcome: "You prepared a home-cooked meal.",
  },
  {
    id: "shower",
    name: "Take a shower",
    durationMinutes: 15,
    requiredLocation: "home",
    requiredFurniture: "shower",
    cost: 0,
    reward: 0,
    needs: { hygiene: 45, fun: 2 },
    skillXp: 0,
    animation: "showering",
    outcome: "You feel fresh and clean.",
  },
  {
    id: "toilet",
    name: "Use the toilet",
    durationMinutes: 5,
    requiredLocation: "home",
    requiredFurniture: "toilet",
    cost: 0,
    reward: 0,
    needs: { bladder: 65 },
    skillXp: 0,
    animation: "using_toilet",
    outcome: "You feel more comfortable.",
  },
  {
    id: "sleep",
    name: "Sleep",
    durationMinutes: 480,
    requiredLocation: "home",
    requiredFurniture: "bed",
    needs: { energy: 80 },
    cost: 0,
    reward: 0,
    skillXp: 0,
    animation: "sleeping",
    outcome: "You woke up rested.",
  },
  {
    id: "watch_tv",
    name: "Watch television",
    durationMinutes: 45,
    requiredLocation: "home",
    requiredFurniture: "television",
    cost: 0,
    reward: 0,
    needs: { fun: 32 },
    skillXp: 0,
    animation: "watching",
    outcome: "You had some time to unwind.",
  },
  {
    id: "study",
    name: "Study",
    durationMinutes: 60,
    requiredLocation: "any",
    minimumLevel: 1,
    cost: 0,
    reward: 0,
    needs: { energy: -8, fun: -4 },
    skill: "learning",
    skillXp: 12,
    animation: "studying",
    outcome: "You learned something useful.",
  },
  {
    id: "exercise",
    name: "Exercise",
    durationMinutes: 35,
    requiredLocation: "any",
    minimumLevel: 1,
    cost: 0,
    reward: 0,
    needs: { energy: -15, fun: 6, hygiene: -8 },
    skill: "fitness",
    skillXp: 10,
    animation: "exercising",
    outcome: "You completed a workout.",
  },
  {
    id: "socialize",
    name: "Socialize",
    durationMinutes: 30,
    requiredLocation: "any",
    cost: 0,
    reward: 0,
    needs: { social: 28, fun: 10 },
    skill: "charisma",
    skillXp: 5,
    animation: "socializing",
    outcome: "You had a good conversation.",
  },
  {
    id: "travel",
    name: "Travel",
    durationMinutes: 25,
    requiredLocation: "any",
    cost: 0,
    reward: 0,
    needs: { energy: -4, hunger: -2, bladder: -3 },
    skillXp: 0,
    animation: "walking",
    outcome: "You arrived at your destination.",
  },
];
export const ACTION_CATALOG: Readonly<Record<LifeActionId, LifeAction>> = Object.freeze(
  Object.fromEntries(ACTION_LIST.map((action) => [action.id, action])) as Record<
    LifeActionId,
    LifeAction
  >,
);

export type MoodEffect = {
  mood: MoodName;
  reason: string;
  skillModifier: number;
  expiresAtMinute: number | null;
};
export type ActiveAction = {
  actionId: LifeActionId;
  requestId: string;
  startedAt: GameTime;
  animation: ActivityAnimation;
  reservedCost: number;
  targetLocationId?: string;
};
export type SimulationState = {
  character: { id: string; name: string; level: number; traits: CharacterTrait[] };
  needs: Needs;
  currentAction: ActiveAction | null;
  locationId: string | null;
  locationType: LifeAction["requiredLocation"];
  gameTime: GameTime;
  wallet: number;
  skills: Record<string, number>;
  experience: number;
  mood: MoodEffect;
  travelState: "idle" | "traveling" | "working";
  goals: string[];
  queuedActions: LifeActionId[];
  paused: boolean;
  timeSpeed: 0.5 | 1 | 2;
  clockRemainder: number;
  processedRequestIds: string[];
  pendingEvents: string[];
  firedEventKeys: string[];
  lastUpdatedAt: number;
  serverSnapshot: {
    updatedAt: string;
    gameTime: GameTime;
    energy: number;
    hunger: number;
    happiness: number;
    social: number;
    wallet: number;
    experience: number;
    level: number;
    locationId: string | null;
  };
};

export type NeedsContext = {
  sleeping?: boolean;
  socializing?: boolean;
  atHome?: boolean;
  traits?: readonly CharacterTrait[];
};

export const SCHEDULED_EVENTS: {
  id: string;
  label: string;
  minuteOfDay: number;
  weekday?: number;
}[] = [
  { id: "morning_market", label: "Morning market opens", minuteOfDay: 8 * 60 },
  { id: "evening_social", label: "Evening social hour", minuteOfDay: 18 * 60, weekday: 4 },
] as const;

function clamp(value: number) {
  return Math.round(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) * 10) / 10;
}
function totalMinutes(time: GameTime) {
  return time.day * 1440 + time.hour * 60 + time.minute;
}

function advanceClockState(state: SimulationState, minutes: number) {
  const gameTime = advanceGameTime(state.gameTime, minutes);
  const start = (state.gameTime.day - 1) * 1440 + state.gameTime.hour * 60 + state.gameTime.minute;
  const end = start + minutes;
  const pendingEvents = [...state.pendingEvents];
  const firedEventKeys = [...state.firedEventKeys];
  const firstDay = Math.floor(start / 1440);
  const lastDay = Math.floor(end / 1440);
  for (let day = firstDay; day <= lastDay; day++) {
    for (const event of SCHEDULED_EVENTS) {
      const at = day * 1440 + event.minuteOfDay;
      const weekday = (state.gameTime.weekday + day - firstDay) % 7;
      const key = `${day + 1}:${event.id}`;
      if (
        at > start &&
        at <= end &&
        (event.weekday === undefined || event.weekday === weekday) &&
        !firedEventKeys.includes(key)
      ) {
        firedEventKeys.push(key);
        pendingEvents.push(event.label);
      }
    }
  }
  return {
    gameTime,
    pendingEvents: pendingEvents.slice(-20),
    firedEventKeys: firedEventKeys.slice(-200),
  };
}

export function normalizeNeeds(values: Partial<Needs>): Needs {
  return Object.fromEntries(NEED_NAMES.map((name) => [name, clamp(values[name] ?? 75)])) as Needs;
}

export function decayNeeds(
  needs: Needs,
  elapsedMinutes: number,
  context: NeedsContext = {},
): Needs {
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) return { ...needs };
  const result = { ...needs };
  for (const name of NEED_NAMES) {
    const rule = NEED_RULES[name];
    let rate = rule.decayPerMinute;
    if (name === "energy" && context.sleeping) rate = -0.18;
    if (name === "social" && context.socializing) rate *= 0.35;
    if (name === "hygiene" && context.atHome && context.traits?.includes("disciplined"))
      rate *= 0.9;
    if (name === "fun" && context.traits?.includes("easygoing")) rate *= 0.8;
    if (name === "social" && context.traits?.includes("sociable")) rate *= 0.9;
    result[name] = clamp(result[name] - rate * elapsedMinutes);
  }
  return result;
}

export function deriveMood(needs: Needs, previous?: MoodEffect, nowMinute = 0): MoodEffect {
  const lowest = NEED_NAMES.reduce(
    (current, name) => (needs[name] < needs[current] ? name : current),
    NEED_NAMES[0],
  );
  const criticalCount = NEED_NAMES.filter(
    (name) => needs[name] <= NEED_RULES[name].critical,
  ).length;
  if (criticalCount > 1)
    return {
      mood: "stressed",
      reason: "Several needs are critically low.",
      skillModifier: -2,
      expiresAtMinute: null,
    };
  if (needs[lowest] <= NEED_RULES[lowest].critical)
    return {
      mood:
        lowest === "hunger"
          ? "hungry"
          : lowest === "energy"
            ? "tired"
            : lowest === "fun"
              ? "bored"
              : lowest === "hygiene" || lowest === "bladder"
                ? "embarrassed"
                : "stressed",
      reason: `${NEED_RULES[lowest].label} is critically low.`,
      skillModifier: -1,
      expiresAtMinute: null,
    };
  if (needs.social >= 80)
    return {
      mood: "socially fulfilled",
      reason: "You have spent time with people.",
      skillModifier: 1,
      expiresAtMinute: nowMinute + 120,
    };
  if (needs.fun >= 80 && needs.energy >= 60)
    return {
      mood: "happy",
      reason: "Your needs are in a good place.",
      skillModifier: 0,
      expiresAtMinute: null,
    };
  if (previous?.expiresAtMinute !== null && previous && previous.expiresAtMinute > nowMinute)
    return previous;
  return {
    mood: "confident",
    reason: "Ready to take on the day.",
    skillModifier: 0,
    expiresAtMinute: null,
  };
}

export function createSimulationState(
  input: Partial<SimulationState> & Pick<SimulationState, "character" | "gameTime">,
): SimulationState {
  const needs = normalizeNeeds(input.needs ?? {});
  const currentMinute = totalMinutes(input.gameTime);
  const state: SimulationState = {
    currentAction: null,
    locationId: null,
    locationType: "any",
    wallet: Math.max(0, input.wallet ?? 0),
    skills: input.skills ?? {},
    experience: Math.max(0, input.experience ?? 0),
    mood: input.mood ?? deriveMood(needs, undefined, currentMinute),
    travelState: "idle",
    goals: [],
    queuedActions: [],
    paused: false,
    timeSpeed: 1,
    clockRemainder: 0,
    processedRequestIds: [],
    pendingEvents: input.pendingEvents ?? [],
    firedEventKeys: input.firedEventKeys ?? [],
    lastUpdatedAt: input.lastUpdatedAt ?? Date.now(),
    serverSnapshot: input.serverSnapshot ?? {
      updatedAt: "",
      gameTime: input.gameTime,
      energy: needs.energy,
      hunger: 100 - needs.hunger,
      happiness: needs.fun,
      social: needs.social,
      wallet: Math.max(0, input.wallet ?? 0),
      experience: Math.max(0, input.experience ?? 0),
      level: input.character.level,
      locationId: input.locationId ?? null,
    },
    ...input,
    character: {
      id: input.character.id,
      name: input.character.name,
      level: input.character.level,
      traits: input.character.traits ?? [],
    },
    needs,
    gameTime: input.gameTime,
  };
  return state;
}

export function advanceSimulation(
  state: SimulationState,
  elapsedRealSeconds: number,
): SimulationState {
  if (
    state.paused ||
    state.currentAction ||
    !Number.isFinite(elapsedRealSeconds) ||
    elapsedRealSeconds <= 0
  )
    return state;
  const minuteAccumulator = state.clockRemainder + (elapsedRealSeconds * state.timeSpeed) / 6; // 10 game minutes per real minute at x1.
  const elapsedMinutes = Math.floor(minuteAccumulator);
  if (elapsedMinutes <= 0)
    return { ...state, clockRemainder: minuteAccumulator, lastUpdatedAt: Date.now() };
  const clock = advanceClockState(state, elapsedMinutes);
  const gameTime = clock.gameTime;
  const needs = decayNeeds(state.needs, elapsedMinutes, {
    traits: state.character.traits,
    atHome: state.locationType === "home",
  });
  return {
    ...state,
    gameTime,
    pendingEvents: clock.pendingEvents,
    firedEventKeys: clock.firedEventKeys,
    needs,
    clockRemainder: minuteAccumulator - elapsedMinutes,
    mood: deriveMood(needs, state.mood, totalMinutes(gameTime)),
    lastUpdatedAt: Date.now(),
  };
}

export function validateAction(
  state: SimulationState,
  actionId: LifeActionId,
  furniture: readonly string[] = [],
  targetLocationId?: string,
): string | null {
  const action = ACTION_CATALOG[actionId];
  if (!action) return "That action is unavailable.";
  if (state.currentAction) return "Finish or cancel the current activity first.";
  if (state.travelState !== "idle" && actionId !== "travel")
    return "Wait until your current trip or shift is finished.";
  if (state.paused) return "Resume the simulation before starting an action.";
  if (action.requiredLocation !== "any" && state.locationType !== action.requiredLocation)
    return `You need to be at ${action.requiredLocation} for this action.`;
  if (action.requiredFurniture && !furniture.includes(action.requiredFurniture))
    return `You need access to a ${action.requiredFurniture}.`;
  if (action.minimumLevel && state.character.level < action.minimumLevel)
    return `This action requires level ${action.minimumLevel}.`;
  if (actionId === "travel" && (!targetLocationId || targetLocationId === state.locationId))
    return "Choose a different destination.";
  const cost = state.character.traits.includes("frugal")
    ? Math.floor(action.cost * 0.9)
    : action.cost;
  if (state.wallet < cost) return `You need ₦${cost.toLocaleString()} for this action.`;
  return action.precondition?.(state) ?? null;
}

export function startAction(
  state: SimulationState,
  actionId: LifeActionId,
  requestId: string,
  options: { furniture?: readonly string[]; targetLocationId?: string } = {},
): { state: SimulationState; error: string | null } {
  if (state.processedRequestIds.includes(requestId) || state.currentAction?.requestId === requestId)
    return { state, error: null };
  const error = validateAction(state, actionId, options.furniture, options.targetLocationId);
  if (error) return { state, error };
  const action = ACTION_CATALOG[actionId];
  const reservedCost = state.character.traits.includes("frugal")
    ? Math.floor(action.cost * 0.9)
    : action.cost;
  return {
    error: null,
    state: {
      ...state,
      wallet: state.wallet - reservedCost,
      currentAction: {
        actionId,
        requestId,
        startedAt: state.gameTime,
        animation: action.animation,
        reservedCost,
        ...(options.targetLocationId ? { targetLocationId: options.targetLocationId } : {}),
      },
      travelState: actionId === "travel" ? "traveling" : state.travelState,
      lastUpdatedAt: Date.now(),
    },
  };
}

export function completeAction(
  state: SimulationState,
  requestId: string,
): { state: SimulationState; error: string | null } {
  const active = state.currentAction;
  if (!active)
    return {
      state,
      error: state.processedRequestIds.includes(requestId)
        ? null
        : "There is no active action to complete.",
    };
  if (active.requestId !== requestId)
    return { state, error: "This completion does not match the active action." };
  if (state.processedRequestIds.includes(requestId)) return { state, error: null };
  if (state.paused) return { state, error: "Resume the simulation before completing this action." };
  const action = ACTION_CATALOG[active.actionId];
  const clock = advanceClockState(state, action.durationMinutes);
  const gameTime = clock.gameTime;
  const needs = decayNeeds(state.needs, action.durationMinutes, {
    sleeping: actionIdIsSleep(active.actionId),
    socializing: active.actionId === "socialize",
    atHome: state.locationType === "home",
    traits: state.character.traits,
  });
  for (const name of NEED_NAMES)
    if (action.needs[name]) needs[name] = clamp(needs[name] + action.needs[name]!);
  const traitSkillBonus =
    state.character.traits.includes("ambitious") || state.character.traits.includes("studious")
      ? 1
      : 0;
  const skillGain = action.skill
    ? Math.max(0, action.skillXp + traitSkillBonus + state.mood.skillModifier)
    : 0;
  if (active.actionId === "socialize" && state.character.traits.includes("sociable"))
    needs.social = clamp(needs.social + 5);
  if (
    (active.actionId === "cook" || active.actionId === "watch_tv") &&
    state.character.traits.includes("creative")
  )
    needs.fun = clamp(needs.fun + 4);
  const skills = action.skill
    ? { ...state.skills, [action.skill]: (state.skills[action.skill] ?? 0) + skillGain }
    : state.skills;
  const remainingQueue = [...state.queuedActions];
  if (remainingQueue[0] === active.actionId) remainingQueue.shift();
  const next: SimulationState = {
    ...state,
    gameTime,
    pendingEvents: clock.pendingEvents,
    firedEventKeys: clock.firedEventKeys,
    needs,
    wallet: state.wallet + action.reward,
    experience: state.experience + (action.experienceReward ?? 0),
    skills,
    currentAction: null,
    locationId:
      active.actionId === "travel"
        ? (active.targetLocationId ?? state.locationId)
        : state.locationId,
    locationType: active.actionId === "travel" ? "any" : state.locationType,
    travelState: "idle",
    queuedActions: remainingQueue,
    processedRequestIds: [...state.processedRequestIds, requestId].slice(-100),
    lastUpdatedAt: Date.now(),
  };
  next.mood = deriveMood(needs, state.mood, totalMinutes(gameTime));
  return { state: next, error: null };
}

function actionIdIsSleep(actionId: LifeActionId) {
  return actionId === "sleep";
}

export function isValidSimulationSnapshot(
  value: unknown,
  characterId?: string,
): value is SimulationState {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<SimulationState>;
  if (
    !snapshot.character ||
    typeof snapshot.character.id !== "string" ||
    (characterId && snapshot.character.id !== characterId)
  )
    return false;
  if (
    !snapshot.gameTime ||
    !Number.isInteger(snapshot.gameTime.minute) ||
    snapshot.gameTime.minute < 0 ||
    snapshot.gameTime.minute > 59 ||
    !Number.isInteger(snapshot.gameTime.hour) ||
    snapshot.gameTime.hour < 0 ||
    snapshot.gameTime.hour > 23 ||
    !Number.isInteger(snapshot.gameTime.day) ||
    snapshot.gameTime.day < 1 ||
    !Number.isInteger(snapshot.gameTime.weekday) ||
    snapshot.gameTime.weekday < 0 ||
    snapshot.gameTime.weekday > 6
  )
    return false;
  if (
    !snapshot.needs ||
    !NEED_NAMES.every(
      (name) =>
        Number.isFinite(snapshot.needs?.[name]) &&
        snapshot.needs![name] >= 0 &&
        snapshot.needs![name] <= 100,
    )
  )
    return false;
  if (
    !Number.isFinite(snapshot.wallet) ||
    snapshot.wallet! < 0 ||
    !Number.isFinite(snapshot.experience) ||
    snapshot.experience! < 0
  )
    return false;
  if (
    !(snapshot.timeSpeed === 0.5 || snapshot.timeSpeed === 1 || snapshot.timeSpeed === 2) ||
    typeof snapshot.paused !== "boolean"
  )
    return false;
  if (
    !Number.isFinite(snapshot.clockRemainder) ||
    snapshot.clockRemainder! < 0 ||
    snapshot.clockRemainder! >= 1 ||
    !Number.isFinite(snapshot.lastUpdatedAt) ||
    !snapshot.skills ||
    typeof snapshot.skills !== "object" ||
    Array.isArray(snapshot.skills) ||
    !Array.isArray(snapshot.character.traits) ||
    !Array.isArray(snapshot.processedRequestIds) ||
    !Array.isArray(snapshot.pendingEvents) ||
    !Array.isArray(snapshot.firedEventKeys) ||
    !snapshot.serverSnapshot ||
    typeof snapshot.serverSnapshot.updatedAt !== "string" ||
    !snapshot.serverSnapshot.gameTime
  )
    return false;
  if (
    !snapshot.character.name ||
    !Number.isInteger(snapshot.character.level) ||
    snapshot.character.level < 1 ||
    !Array.isArray(snapshot.goals) ||
    !snapshot.goals.every((goal) => typeof goal === "string") ||
    !["any", "home", "workplace", "school"].includes(snapshot.locationType ?? "") ||
    !["idle", "traveling", "working"].includes(snapshot.travelState ?? "")
  )
    return false;
  if (
    !Array.isArray(snapshot.queuedActions) ||
    snapshot.queuedActions.some((action) => !(action in ACTION_CATALOG))
  )
    return false;
  if (snapshot.currentAction) {
    const active = snapshot.currentAction;
    if (
      !(active.actionId in ACTION_CATALOG) ||
      typeof active.requestId !== "string" ||
      active.requestId.length === 0 ||
      !Number.isFinite(active.reservedCost) ||
      active.reservedCost < 0 ||
      !active.startedAt ||
      !Number.isInteger(active.startedAt.minute) ||
      active.startedAt.minute < 0 ||
      active.startedAt.minute > 59 ||
      !Number.isInteger(active.startedAt.hour) ||
      active.startedAt.hour < 0 ||
      active.startedAt.hour > 23 ||
      !Number.isInteger(active.startedAt.day) ||
      active.startedAt.day < 1 ||
      !Number.isInteger(active.startedAt.weekday) ||
      active.startedAt.weekday < 0 ||
      active.startedAt.weekday > 6 ||
      typeof active.animation !== "string"
    )
      return false;
  }
  return true;
}

/** Restore only valid local simulation state newer than the cloud snapshot.
 * Account-owned money, XP, location, and unfinished activities always come from cloud state.
 */
export function restoreLocalSimulationSnapshot(
  current: SimulationState,
  candidate: unknown,
  savedAt: number,
): SimulationState {
  const cloudUpdatedAt = Date.parse(current.serverSnapshot.updatedAt);
  if (
    !isValidSimulationSnapshot(candidate, current.character.id) ||
    !Number.isFinite(savedAt) ||
    !Number.isFinite(cloudUpdatedAt) ||
    savedAt <= cloudUpdatedAt
  )
    return current;
  const saved = candidate;
  return {
    ...current,
    ...saved,
    character: current.character,
    wallet: current.wallet,
    experience: current.experience,
    locationId: current.locationId,
    serverSnapshot: current.serverSnapshot,
    currentAction: null,
    travelState: "idle",
    queuedActions: saved.currentAction
      ? saved.queuedActions.filter((id) => id !== saved.currentAction?.actionId)
      : saved.queuedActions,
    lastUpdatedAt: Math.max(Date.now(), current.lastUpdatedAt + 1),
  };
}

export function interruptAction(state: SimulationState, requestId?: string): SimulationState {
  if (!state.currentAction || (requestId && state.currentAction.requestId !== requestId))
    return state;
  const action = ACTION_CATALOG[state.currentAction.actionId];
  return {
    ...state,
    wallet: state.wallet + state.currentAction.reservedCost,
    currentAction: null,
    travelState: "idle",
    queuedActions: state.queuedActions.filter((id) => id !== action.id),
    lastUpdatedAt: Date.now(),
  };
}

export function queueActions(
  state: SimulationState,
  actionIds: readonly LifeActionId[],
): SimulationState {
  const valid = actionIds.filter((id) => !!ACTION_CATALOG[id]);
  return { ...state, queuedActions: [...state.queuedActions, ...valid].slice(0, 10) };
}

export function startNextQueuedAction(
  state: SimulationState,
  options: { furniture?: readonly string[] } = {},
): { state: SimulationState; error: string | null } {
  if (state.currentAction)
    return { state, error: "Finish or cancel the current activity before starting the queue." };
  const actionId = state.queuedActions[0];
  if (!actionId) return { state, error: null };
  const started = startAction(state, actionId, `queue-${Date.now()}-${actionId}`, options);
  if (started.error)
    return { state: { ...state, queuedActions: [] }, error: `Queue stopped: ${started.error}` };
  return started;
}

export function statusForNeed(name: NeedName, value: number): "healthy" | "warning" | "critical" {
  const rules = NEED_RULES[name];
  return value <= rules.critical ? "critical" : value <= rules.warning ? "warning" : "healthy";
}
