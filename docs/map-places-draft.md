# Draft: new places for the OSOGBO LIFE map

Status: DRAFT for review. Nothing here is in the live database yet.

## Proposed new places

| # | Place | Suggested district | Category | Min age | Notes |
|---|-------|--------------------|----------|---------|-------|
| 1 | Osun-Osogbo Sacred Grove | Open fields | Culture and nature | 0 | Sacred site on the edge of town. Verify the real-world details before use. |
| 2 | Osun Festival grounds | Open fields | Event venue | 0 | Seasonal event location. |
| 3 | Art and craft gallery | Garden quarter | Culture | 0 | Art and craft hub, modelled on existing gallery spaces. |
| 4 | Central mosque | Civic quarter | Worship | 0 | Worship place. |
| 5 | Central church | Civic quarter | Worship | 0 | Worship place. |
| 6 | Pharmacy | Learning quarter | Health | 0 | Basic health need. |
| 7 | Hospital | Learning quarter | Health | 0 | Basic health need. |
| 8 | Fuel station | Transit quarter | Services | 0 | Useful for okada and car owners. |
| 9 | Okada stand | Transit quarter | Transport | 0 | Fixed pickup point for ride requests. |
| 10 | Hair salon and tailor | Market quarter | Appearance | 0 | Supports the outfit system. |
| 11 | Cinema or event hall | Commerce quarter | Entertainment | 0 | Party life and town events. |
| 12 | Post office and internet cafe | Commerce quarter | Services | 0 | Messaging and job applications. |

## What the live database needs for each place

Each place is a `locations` row plus a `map_landmarks` row. Before insertion, fill these for each place:
- slug, name, tagline, description, district_type
- map_x, map_y, canvas_x, canvas_y, map_coordinate_mode, interaction_radius_m
- color, icon, map_category, type
- travel_fare, travel_minutes, level_required, sort_order
- neighbor_slugs, job_contract_slugs, entry_loops, planned_features, metadata

## Plan for the map

1. Review this list and remove or rename places.
2. Confirm each suggested district.
3. Pick map positions for each place.
4. Insert the rows in the live database in one batch, then check them on the map.

Real-world names (the Sacred Grove, the festival) come from general knowledge and must be verified before they go live.
