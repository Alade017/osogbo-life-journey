import mapData from "@/data/osogbo-map.json";
import { MAP_LANDMARK_LOCATION_SLUG } from "@/components/map/map-location-links";
import type { Advertisement, GameBillboard, Location } from "@/lib/game";
import type { Database } from "@/integrations/supabase/types";

export type BillboardCampaign = Advertisement;
export type PlayerBillboardCampaign = Database["public"]["Tables"]["player_advertisements"]["Row"];

export type CurrentMapBillboard = {
  landmarkId: string;
  count: number;
  billboard: GameBillboard;
  advertisement: BillboardCampaign;
};

export function isCurrentAdvertisement(advertisement: BillboardCampaign, now: number) {
  const startsAt = Date.parse(advertisement.starts_at);
  const endsAt = advertisement.ends_at
    ? Date.parse(advertisement.ends_at)
    : Number.POSITIVE_INFINITY;
  return advertisement.status === "active" && startsAt <= now && endsAt > now;
}

export function playerCampaignAsAdvertisement(
  campaign: PlayerBillboardCampaign,
): BillboardCampaign {
  return {
    id: campaign.id,
    slug: `player-${campaign.id}`,
    billboard_id: campaign.billboard_id,
    advertiser_name: campaign.advertiser_name,
    title: campaign.title,
    description: campaign.description,
    creative_image_url: null,
    creative_theme: campaign.creative_theme,
    call_to_action: null,
    destination_action: "none",
    destination_url: null,
    starts_at: campaign.starts_at,
    ends_at: campaign.ends_at,
    status: campaign.status,
    created_at: campaign.created_at,
    updated_at: campaign.created_at,
  };
}

export function getCurrentMapBillboards(
  billboards: GameBillboard[],
  advertisements: BillboardCampaign[],
  playerAdvertisements: PlayerBillboardCampaign[],
  locations: Pick<Location, "id" | "slug">[],
  now: number,
): CurrentMapBillboard[] {
  const locationBySlug = new Map(locations.map((location) => [location.slug, location.id]));
  const landmarkByLocationId = new Map<string, string>();
  for (const district of mapData.districts) {
    for (const landmark of district.landmarks) {
      const slug = MAP_LANDMARK_LOCATION_SLUG[landmark.id];
      const locationId = slug ? locationBySlug.get(slug) : undefined;
      if (locationId && !landmarkByLocationId.has(locationId)) {
        landmarkByLocationId.set(locationId, landmark.id);
      }
    }
  }

  const activeCampaigns = [
    ...advertisements,
    ...playerAdvertisements.map(playerCampaignAsAdvertisement),
  ].filter((advertisement) => isCurrentAdvertisement(advertisement, now));
  const boardById = new Map(
    billboards
      .filter((billboard) => billboard.status === "active")
      .map((billboard) => [billboard.id, billboard]),
  );
  const campaignsByLandmark = new Map<
    string,
    { billboard: GameBillboard; advertisement: BillboardCampaign }[]
  >();

  for (const advertisement of activeCampaigns) {
    const billboard = boardById.get(advertisement.billboard_id);
    const landmarkId = billboard ? landmarkByLocationId.get(billboard.location_id) : undefined;
    if (!billboard || !landmarkId) continue;
    const campaigns = campaignsByLandmark.get(landmarkId) ?? [];
    campaigns.push({ billboard, advertisement });
    campaignsByLandmark.set(landmarkId, campaigns);
  }

  return [...campaignsByLandmark.entries()].flatMap(([landmarkId, campaigns]) => {
    if (!campaigns.length) return [];
    const index = Math.floor(now / 10_000) % campaigns.length;
    const selected = campaigns[index];
    return selected ? [{ landmarkId, count: campaigns.length, ...selected }] : [];
  });
}
