// Client-side data access for OSOGBO LIFE.
// Reads go through RLS-protected tables (players only ever see their own rows).
// Every state change goes through server-validated database functions (RPCs);
// the browser has no write access to characters, wallets, missions, etc.
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { normalizeCityLocation } from "@/lib/location-service";
import { progressionFromExperience, XP_PER_LEVEL } from "@/lib/progression-service";

export type Character = Database["public"]["Tables"]["characters"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Activity = Database["public"]["Tables"]["activities"]["Row"];
export type PlayerSkill = Database["public"]["Tables"]["player_skills"]["Row"];
export type Location = Database["public"]["Tables"]["locations"]["Row"];
export type MapLocation = Pick<
  Location,
  | "id"
  | "name"
  | "slug"
  | "type"
  | "description"
  | "latitude"
  | "longitude"
  | "icon"
  | "image_url"
  | "is_active"
  | "interaction_radius_m"
  | "level_required"
  | "metadata"
>;
export type MapLocationBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};
export type GamePlace = Database["public"]["Tables"]["game_places"]["Row"];
export type GameBillboard = Database["public"]["Tables"]["game_billboards"]["Row"];
export type Advertisement = Database["public"]["Tables"]["advertisements"]["Row"];

export { XP_PER_LEVEL };
export const ENERGY_REGEN_SECONDS = 120;

export function formatNaira(n: number | bigint | null | undefined) {
  return "₦" + Number(n ?? 0).toLocaleString("en-NG");
}

export { careerShiftPay } from "@/lib/economy-service";

export function xpProgress(xp: number) {
  const progression = progressionFromExperience(xp);
  return {
    into: progression.experienceIntoLevel,
    needed: progression.experienceRequired,
    pct: progression.progressPercent,
    toNextLevel: progression.experienceToNextLevel,
    level: progression.level,
  };
}

function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export const q = {
  character: () =>
    queryOptions({
      queryKey: ["character"],
      retry: false,
      queryFn: async () => unwrap(await supabase.from("characters").select("*").maybeSingle()),
    }),
  homeSave: () =>
    queryOptions({
      queryKey: ["homeSave"],
      retry: false,
      queryFn: async () => unwrap(await supabase.rpc("my_home_save")) as Json,
    }),
  npcs: () =>
    queryOptions({
      queryKey: ["npcs"],
      staleTime: 5 * 60_000,
      queryFn: async () => unwrap(await supabase.from("npc_definitions").select("*").order("name")),
    }),
  npcRelationships: () =>
    queryOptions({
      queryKey: ["npcRelationships"],
      queryFn: async () => unwrap(await supabase.from("character_npc_relationships").select("*")),
    }),
  npcEvents: () =>
    queryOptions({
      queryKey: ["npcEvents"],
      queryFn: async () =>
        unwrap(
          await supabase
            .from("npc_interaction_events")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(40),
        ),
    }),
  profile: () =>
    queryOptions({
      queryKey: ["profile"],
      queryFn: async () => unwrap(await supabase.from("profiles").select("*").maybeSingle()),
    }),
  wallet: () =>
    queryOptions({
      queryKey: ["wallet"],
      queryFn: async () => unwrap(await supabase.from("wallets").select("*").maybeSingle()),
    }),
  rentStatus: () =>
    queryOptions({
      queryKey: ["rentStatus"],
      queryFn: async () => unwrap(await supabase.rpc("my_property_rent_status")),
    }),
  propertyListings: () =>
    queryOptions({
      queryKey: ["propertyListings"],
      queryFn: async () => unwrap(await supabase.rpc("my_game_property_listings")),
    }),
  transactions: () =>
    queryOptions({
      queryKey: ["transactions"],
      queryFn: async () =>
        unwrap(
          await supabase
            .from("transactions")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(30),
        ),
    }),
  jobs: () =>
    queryOptions({
      queryKey: ["jobs"],
      staleTime: 5 * 60_000,
      retry: false,
      queryFn: async () => unwrap(await supabase.from("jobs").select("*").order("sort_order")),
    }),
  activities: () =>
    queryOptions({
      queryKey: ["activities"],
      staleTime: 5 * 60_000,
      retry: false,
      queryFn: async () =>
        unwrap(
          await supabase.from("activities").select("*").eq("is_available", true).order("name"),
        ),
    }),
  places: () =>
    queryOptions({
      queryKey: ["places"],
      staleTime: 5 * 60_000,
      queryFn: async () =>
        unwrap(await supabase.from("game_places").select("*").order("sort_order")),
    }),
  billboards: () =>
    queryOptions({
      queryKey: ["billboards"],
      staleTime: 60_000,
      queryFn: async () =>
        unwrap(
          await supabase.from("game_billboards").select("*").eq("status", "active").order("name"),
        ),
    }),
  advertisements: () =>
    queryOptions({
      queryKey: ["advertisements"],
      staleTime: 60_000,
      queryFn: async () =>
        unwrap(
          await supabase
            .from("advertisements")
            .select("*")
            .eq("status", "active")
            .order("starts_at", { ascending: false }),
        ),
    }),
  educationCourses: () =>
    queryOptions({
      queryKey: ["educationCourses"],
      staleTime: 5 * 60_000,
      queryFn: async () =>
        unwrap(await supabase.from("education_courses").select("*").order("sort_order")),
    }),
  myCourses: () =>
    queryOptions({
      queryKey: ["myCourses"],
      queryFn: async () => unwrap(await supabase.from("player_courses").select("*")),
    }),
  myJobs: () =>
    queryOptions({
      queryKey: ["myJobs"],
      queryFn: async () => unwrap(await supabase.from("character_jobs").select("*")),
    }),
  playerSkills: () =>
    queryOptions({
      queryKey: ["playerSkills"],
      queryFn: async () => unwrap(await supabase.from("player_skills").select("*")),
    }),
  locations: () =>
    queryOptions({
      queryKey: ["locations"],
      staleTime: 5 * 60_000,
      queryFn: async () => unwrap(await supabase.from("locations").select("*").order("sort_order")),
    }),
  mapLocations: (bounds?: MapLocationBounds) =>
    queryOptions({
      queryKey: ["mapLocations", bounds ?? null],
      staleTime: 60_000,
      retry: false,
      queryFn: async () => {
        const pageSize = 500;
        const allLocations: MapLocation[] = [];
        for (let from = 0; ; from += pageSize) {
          let request = supabase
            .from("locations")
            .select(
              "id,name,slug,type,description,latitude,longitude,icon,image_url,is_active,interaction_radius_m,level_required,metadata",
            )
            .eq("is_active", true);
          if (bounds) {
            request = request
              .gte("latitude", bounds.south)
              .lte("latitude", bounds.north)
              .gte("longitude", bounds.west)
              .lte("longitude", bounds.east);
          }
          const page = unwrap(await request.order("name").range(from, from + pageSize - 1)) ?? [];
          allLocations.push(...page);
          if (page.length < pageSize) break;
        }
        return allLocations.map(normalizeCityLocation);
      },
    }),
  locationById: (id: string | null) =>
    queryOptions({
      queryKey: ["mapLocation", id],
      enabled: !!id,
      staleTime: 60_000,
      retry: false,
      queryFn: async () => {
        if (!id) return null;
        const location = unwrap(
          await supabase
            .from("locations")
            .select(
              "id,name,slug,type,description,latitude,longitude,icon,image_url,is_active,interaction_radius_m,level_required,metadata",
            )
            .eq("id", id)
            .eq("is_active", true)
            .maybeSingle(),
        );
        return location ? normalizeCityLocation(location) : null;
      },
    }),
  searchMapLocations: (search: string) =>
    queryOptions({
      queryKey: ["mapLocationSearch", search],
      enabled: search.length >= 3,
      staleTime: 30_000,
      retry: false,
      queryFn: async () => {
        const locations = unwrap(
          await supabase
            .from("locations")
            .select(
              "id,name,slug,type,description,latitude,longitude,icon,image_url,is_active,interaction_radius_m,level_required,metadata",
            )
            .eq("is_active", true)
            .not("latitude", "is", null)
            .not("longitude", "is", null)
            .ilike("name", `%${search}%`)
            .order("name")
            .limit(10),
        );
        return (locations ?? []).map(normalizeCityLocation);
      },
    }),
  visits: () =>
    queryOptions({
      queryKey: ["visits"],
      queryFn: async () => unwrap(await supabase.from("location_visits").select("*")),
    }),
  inventory: () =>
    queryOptions({
      queryKey: ["inventory"],
      queryFn: async () =>
        unwrap(
          await supabase
            .from("player_inventory")
            .select("*, item:inventory_items(*)")
            .order("acquired_at"),
        ),
    }),
  shops: () =>
    queryOptions({
      queryKey: ["shops"],
      staleTime: 60_000,
      queryFn: async () => unwrap(await supabase.from("shops").select("*").eq("is_open", true)),
    }),
  shopItems: () =>
    queryOptions({
      queryKey: ["shopItems"],
      staleTime: 60_000,
      queryFn: async () =>
        unwrap(
          await supabase
            .from("shop_items")
            .select("*, item:inventory_items(*), shop:shops(*)")
            .eq("is_available", true),
        ),
    }),
  equipment: () =>
    queryOptions({
      queryKey: ["equipment"],
      queryFn: async () =>
        unwrap(
          await supabase
            .from("player_equipment")
            .select("*, item:inventory_items(*)")
            .order("slot"),
        ),
    }),
  missions: () =>
    queryOptions({
      queryKey: ["missions"],
      queryFn: async () =>
        unwrap(await supabase.from("player_missions").select("*, mission:missions(*)")),
    }),
  notifications: () =>
    queryOptions({
      queryKey: ["notifications"],
      queryFn: async () =>
        unwrap(
          await supabase
            .from("notifications")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50),
        ),
    }),
};

/** Wraps a server-validated game action; refreshes all player data after it runs. */
export function useGameAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  opts?: { onSuccess?: (r: TResult) => void; onError?: (error: Error) => void },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => opts?.onSuccess?.(r),
    onError: (e: Error) => {
      opts?.onError?.(e);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries(),
  });
}

export const rpc = {
  savePlayerWorldPosition: async (args: {
    worldX: number;
    worldY: number;
    buildingSlug: string | null;
    expectedRevision: number;
    requestId: string;
  }) =>
    unwrap(
      await supabase.rpc("save_player_world_position", {
        p_world_x: args.worldX,
        p_world_y: args.worldY,
        p_building_slug: args.buildingSlug,
        p_expected_revision: args.expectedRevision,
        p_request_id: args.requestId,
      }),
    ) as Json,
  travelToCityLocation: async (args: {
    locationId: string;
    mode: string;
    worldX: number;
    worldY: number;
    expectedRevision: number;
    requestId: string;
  }) =>
    unwrap(
      await supabase.rpc("travel_to_city_location", {
        p_location_id: args.locationId,
        p_mode: args.mode,
        p_world_x: args.worldX,
        p_world_y: args.worldY,
        p_expected_revision: args.expectedRevision,
        p_request_id: args.requestId,
      }),
    ) as Json,
  saveMyHome: async (payload: Json, expectedRevision: number) =>
    unwrap(
      await supabase.rpc("save_my_home", {
        p_payload: payload,
        p_expected_revision: expectedRevision,
      }),
    ) as Json,
  interactWithNpc: async (args: { npcId: string; action: string; requestId: string }) =>
    unwrap(
      await supabase.rpc("interact_with_npc", {
        p_npc_id: args.npcId,
        p_action: args.action,
        p_request_id: args.requestId,
      }),
    ) as unknown as {
      event_id: string;
      accepted: boolean;
      message: string;
      friendship?: number;
      romance?: number;
      trust?: number;
      conflict?: number;
      meetings?: number;
      duplicate: boolean;
    },
  refreshEnergy: async () => unwrap(await supabase.rpc("refresh_my_energy")),
  selectJob: async (jobId: string) => unwrap(await supabase.rpc("select_job", { p_job_id: jobId })),
  completeEducationCourse: async (courseSlug: string) =>
    unwrap(
      await supabase.rpc("complete_education_course", { p_course_slug: courseSlug }),
    ) as unknown as {
      course: string;
      tuition: number;
      energy_spent: number;
      intelligence_gain: number;
      career_gain: number;
    },
  performJob: async (args: { requestId: string }) =>
    unwrap(await supabase.rpc("perform_job", { p_request_id: args.requestId })) as unknown as {
      earned: number;
      xp: number;
      energy_spent: number;
      hunger_gained: number;
      thirst_gained: number;
      duration_minutes: number;
      game_time: { minute: number; hour: number; day: number; weekday: number };
      stress_gained: number;
      level: number;
    },
  promoteCurrentJob: async () => unwrap(await supabase.rpc("promote_current_job")) as Json,
  processPropertyRent: async () => unwrap(await supabase.rpc("process_my_property_rent")) as Json,
  acquireProperty: async (args: { propertyId: string; tenure: "owned" | "rented" }) =>
    unwrap(
      await supabase.rpc("acquire_game_property", {
        p_property_id: args.propertyId,
        p_tenure: args.tenure,
      }),
    ) as Json,
  travelToLocation: async ({ locationId, mode }: { locationId: string; mode: string }) =>
    unwrap(
      await supabase.rpc("travel_to_location", { p_location_id: locationId, p_mode: mode }),
    ) as unknown as {
      location: string;
      mode: string;
      fare: number;
      travel_minutes: number;
      first_visit: boolean;
      weather?: string;
      traffic?: string;
      game_time?: { minute: number; hour: number; day: number; weekday: number };
    },
  savePlayerMapPosition: async (position: {
    latitude: number;
    longitude: number;
    movementState: "idle" | "walking";
  }) =>
    unwrap(
      await supabase.rpc("save_player_map_position", {
        p_latitude: position.latitude,
        p_longitude: position.longitude,
        p_movement_state: position.movementState,
      }),
    ),
  eatAtPlace: async (placeId: string) =>
    unwrap(await supabase.rpc("eat_at_place", { p_place_id: placeId })) as unknown as {
      venue: string;
      cost: number;
      hunger_restored: number;
      happiness_gained: number;
    },
  useInventoryItem: async (inventoryId: string) =>
    unwrap(await supabase.rpc("use_inventory_item", { p_inventory_id: inventoryId })),
  discardInventoryItem: async (inventoryId: string, quantity = 1) =>
    unwrap(
      await supabase.rpc("discard_inventory_item", {
        p_inventory_id: inventoryId,
        p_quantity: quantity,
      }),
    ),
  equipInventoryItem: async (inventoryId: string, slot: string) =>
    unwrap(
      await supabase.rpc("equip_inventory_item", { p_inventory_id: inventoryId, p_slot: slot }),
    ),
  unequipItem: async (slot: string) => unwrap(await supabase.rpc("unequip_item", { p_slot: slot })),
  depositCash: async (amount: number) =>
    unwrap(await supabase.rpc("deposit_cash", { p_amount: amount })),
  withdrawCash: async (amount: number) =>
    unwrap(await supabase.rpc("withdraw_cash", { p_amount: amount })),
  purchaseShopItem: async (args: { shopItemId: string; quantity: number; requestId: string }) =>
    unwrap(
      await supabase.rpc("purchase_shop_item", {
        p_shop_item_id: args.shopItemId,
        p_quantity: args.quantity,
        p_request_id: args.requestId,
      }),
    ),
  sellInventoryItem: async (args: { shopId: string; inventoryId: string; quantity: number }) =>
    unwrap(
      await supabase.rpc("sell_inventory_item", {
        p_shop_id: args.shopId,
        p_inventory_id: args.inventoryId,
        p_quantity: args.quantity,
      }),
    ),
  visitLocation: async (id: string) =>
    unwrap(await supabase.rpc("visit_location", { p_location_id: id })) as unknown as {
      first_visit: boolean;
    },
  claimMission: async (id: string) =>
    unwrap(await supabase.rpc("claim_mission", { p_player_mission_id: id })) as unknown as {
      money: number;
      xp: number;
    },
  markRead: async (id?: string) =>
    unwrap(await supabase.rpc("mark_notifications_read", id ? { p_id: id } : {})),
};
