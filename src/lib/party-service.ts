// Party life data access. Reads use RLS-protected views of party tables; every
// change goes through a server-validated RPC that takes a request id for idempotency.
import { supabase } from "@/integrations/supabase/client";

export type PartyVenue = {
  location_id: string;
  venue_kind: "club" | "event_center";
  name: string;
  slug: string;
  map_x: number | null;
  map_y: number | null;
  opening_hour: number | null;
  closing_hour: number | null;
};

export type PartyDrink = {
  slug: string;
  name: string;
  price: number;
  club_price: number;
  mood_effect: number;
  icon: string;
};

export type PartyClubActivity = {
  slug: string;
  name: string;
  kind: "game" | "stage_show";
  description: string;
  price: number;
  mood_effect: number;
};

export type PartyMood = { character_id: string; score: number };

export type ClubVisit = {
  id: string;
  location_id: string;
  started_at: string;
  expires_at: string;
};

export type PartyRequirement = {
  id: string;
  event_id: string;
  kind: "drink" | "guest";
  item_or_role: string;
  quantity: number;
  fulfilled_count: number;
};

export type PartyEvent = {
  id: string;
  host_character_id: string;
  location_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

export type HostRequirementInput = {
  kind: "drink" | "guest";
  item_or_role: string;
  quantity: number;
};

export const newPartyRequestId = () => crypto.randomUUID();

// The generated Supabase types do not yet include the party tables or RPCs,
// so these reads are typed locally and checked by the database RLS policies.
function unwrap<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const db = supabase as unknown as {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function listPartyVenues(): Promise<PartyVenue[]> {
  const res = await db
    .from("party_venues")
    .select("location_id,venue_kind,opening_hour,closing_hour,locations(name,slug,map_x,map_y)")
    .eq("is_active", true);
  const rows = unwrap<
    Array<{
      location_id: string;
      venue_kind: PartyVenue["venue_kind"];
      opening_hour: number | null;
      closing_hour: number | null;
      locations: {
        name: string;
        slug: string;
        map_x: number | null;
        map_y: number | null;
      } | null;
    }>
  >(res);
  return rows
    .filter((row) => row.locations)
    .map((row) => ({
      location_id: row.location_id,
      venue_kind: row.venue_kind,
      opening_hour: row.opening_hour,
      closing_hour: row.closing_hour,
      name: row.locations!.name,
      slug: row.locations!.slug,
      map_x: row.locations!.map_x,
      map_y: row.locations!.map_y,
    }));
}

export async function listPartyDrinks(): Promise<PartyDrink[]> {
  return unwrap<PartyDrink[]>(
    await db
      .from("party_drinks")
      .select("slug,name,price,club_price,mood_effect,icon")
      .eq("is_active", true)
      .order("price"),
  );
}

export async function listPartyClubActivities(): Promise<PartyClubActivity[]> {
  return unwrap<PartyClubActivity[]>(
    await db
      .from("party_club_activities")
      .select("slug,name,kind,description,price,mood_effect")
      .eq("is_active", true)
      .order("price"),
  );
}

export async function getPartyMood(characterId: string): Promise<PartyMood | null> {
  const rows = unwrap<PartyMood[]>(
    await db.from("party_mood").select("character_id,score").eq("character_id", characterId),
  );
  return rows[0] ?? null;
}

export async function getActiveClubVisit(characterId: string): Promise<ClubVisit | null> {
  const rows = unwrap<ClubVisit[]>(
    await db
      .from("club_visits")
      .select("id,location_id,started_at,expires_at")
      .eq("character_id", characterId)
      .is("ended_at", null),
  );
  return rows[0] ?? null;
}

export async function getDanceCooldown(characterId: string): Promise<string | null> {
  const rows = unwrap<Array<{ last_dance_at: string }>>(
    await db.from("party_dance_cooldowns").select("last_dance_at").eq("character_id", characterId),
  );
  return rows[0]?.last_dance_at ?? null;
}

export async function listPartyEvents(): Promise<
  Array<PartyEvent & { requirements: PartyRequirement[] }>
> {
  const events = unwrap<PartyEvent[]>(
    await db
      .from("party_events")
      .select("id,host_character_id,location_id,title,starts_at,ends_at,status")
      .order("starts_at"),
  );
  if (events.length === 0) return [];
  const requirements = unwrap<PartyRequirement[]>(
    await db
      .from("party_event_requirements")
      .select("id,event_id,kind,item_or_role,quantity,fulfilled_count")
      .in(
        "event_id",
        events.map((event) => event.id),
      ),
  );
  return events.map((event) => ({
    ...event,
    requirements: requirements.filter((req) => req.event_id === event.id),
  }));
}

export const partyRpc = {
  enterClub: async (args: { requestId: string; characterId: string }) =>
    unwrap(await db.rpc("enter_club_for_character", { p_request_id: args.requestId, p_expected_character_id: args.characterId })),
  leaveClub: async (args: { requestId: string; characterId: string }) =>
    unwrap(await db.rpc("leave_club_for_character", { p_request_id: args.requestId, p_expected_character_id: args.characterId })),
  joinClubActivity: async (args: { activitySlug: string; requestId: string; characterId: string }) =>
    unwrap(
      await db.rpc("join_club_activity_for_character", {
        p_activity_slug: args.activitySlug,
        p_request_id: args.requestId,
        p_expected_character_id: args.characterId,
      }),
    ),
  buyDrink: async (args: { drinkSlug: string; requestId: string; characterId: string }) =>
    unwrap(
      await db.rpc("buy_drink_for_character", { p_drink_slug: args.drinkSlug, p_request_id: args.requestId, p_expected_character_id: args.characterId }),
    ),
  danceWithNpc: async (args: {
    npcSlug: string;
    requestId: string;
    characterId: string;
  }) =>
    unwrap(
      await db.rpc("dance_with_npc_for_character", {
        p_npc_slug: args.npcSlug,
        p_request_id: args.requestId,
        p_expected_character_id: args.characterId,
      }),
    ),
  danceWithPlayer: async (args: { targetCharacterId: string; requestId: string; characterId: string }) =>
    unwrap(
      await db.rpc("dance_with_player_for_character", {
        p_target_character_id: args.targetCharacterId,
        p_request_id: args.requestId,
        p_expected_character_id: args.characterId,
      }),
    ),
  hostEvent: async (args: {
    locationId: string;
    title: string;
    startsAt: string;
    requirements: HostRequirementInput[];
    requestId: string;
    characterId: string;
  }) =>
    unwrap(
      await db.rpc("host_party_event_for_character", {
        p_location_id: args.locationId,
        p_title: args.title,
        p_starts_at: args.startsAt,
        p_requirements: args.requirements,
        p_request_id: args.requestId,
        p_expected_character_id: args.characterId,
      }),
    ),
  respondToEvent: async (args: { requirementId: string; requestId: string; characterId: string }) =>
    unwrap(
      await db.rpc("respond_to_event_for_character", {
        p_requirement_id: args.requirementId,
        p_request_id: args.requestId,
        p_expected_character_id: args.characterId,
      }),
    ),
};
