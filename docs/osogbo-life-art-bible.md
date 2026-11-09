# OSOGBO LIFE Art Bible

Version 1 · 2 November 2026 · Direction approved; production-art review pending

This is the art-direction document requested and approved by the owner. It translates the master map brief into production rules. It is not evidence that current assets meet the rules, or approval to produce an entire asset library. Review the in-engine foundation reference before expanding production.

## 1. Visual identity

A believable contemporary Yoruba/Nigerian town, seen through a fixed, elevated 2.5D perspective. Buildings, streets and everyday objects carry the identity; interface labels explain gameplay rather than compensating for indistinguishable buildings.

Target: semi-realistic, deliberately simplified environmental detail with believable material variation and proportions. Keep major forms readable on a 375px screen. Use original modular environments, not satellite imagery, map screenshots or a single painted city background. Avoid thick black outlines, oversized toy roofs, plastic surfaces, extreme saturation, photographic cutouts and unrelated asset-pack styles.

The active playable neighborhood uses the existing React Three Fiber / Three.js scene and reusable procedural world components. Its current geometry remains a development foundation, not proof that the final semi-realistic quality bar has been met. The existing avatar is a separate art system; test environment changes with that avatar before proposing any character-art conversion. Do not introduce SVG map renderers or SVG fallbacks.

## 2. Perspective and measurement

Preserve the existing playable projection as the initial reference, rather than imposing a new 30-degree isometric camera:

```text
screenX = originX + (sceneX - sceneY) × 0.45
screenY = originY + (sceneX + sceneY) × 0.22 - visualElevation
```

`sceneX` and `sceneY` are the existing unprojected neighborhood coordinates. They are not database movement coordinates. The current adapter is 160 scene units per persisted movement unit. Do not change saved positions, room coordinates or collision scale to fit new artwork.

Initial production guide:

| Element                  | Rule                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Ground module            | Existing 80 × 80 scene-unit cell; projects to a 72 × 35.2 screen-unit diamond at zoom 1                                   |
| Player                   | Keep current 48 × 60 sprite-frame contract and foot anchor; use the rendered avatar as the scale reference                |
| Doors                    | Approximately 1.15–1.3 times the visible player height; all doorways admit the existing collision body                    |
| Ground-floor wall        | Approximately 1.5–1.8 player heights; test readable windows and signage at normal gameplay zoom                           |
| Small building prototype | Start with the existing 114 × 62 scene-unit footprint; larger houses compose modules rather than scaling a door or person |
| Roads                    | Preserve authored widths for the pilot: main roads 80/84, streets 58/62, access lane 44 scene units                       |
| Sidewalks                | Preserve the existing 16-unit main-road / 12-unit local-road baseline; validate passage using the actual player body      |
| Render anchor            | Ground contact / front foot anchor, recorded separately from image dimensions and roof height                             |
| Collisions               | Ground footprint only; roof overhangs and shadows do not create invisible walls                                           |

The town overview currently has a separate 44 × 24 diamond projection in a 1200 × 800 view. Treat it as a schematic zoomed-out view, with the same identities and material families. Do not reuse its tile coordinates directly as neighborhood movement positions.

These are proposed production proportions, not authorization to rescale existing gameplay. Approve the pilot with people, doors, a tree, a road and a compound together before locking final export sizes.

## 3. Material and colour guide

These are environment-art swatches, not replacements for React design tokens. Existing UI tokens remain unchanged.

| Material           | Base reference | Variation and finish                                                             |
| ------------------ | -------------- | -------------------------------------------------------------------------------- |
| Asphalt            | `#666D68`      | Fine grain, restrained patching, slightly worn edges; no glossy black road plane |
| Concrete paving    | `#BEB8A8`      | Warm aggregate, quiet joints, locally repaired sections                          |
| Drainage concrete  | `#8D8D7D`      | Darker channel interiors; cover slabs at crossings and entrances                 |
| Laterite soil      | `#A46845`      | Dry reddish earth, irregular edges, low-frequency colour variation               |
| Compound plaster   | `#D2C4A7`      | Off-white, sand and weathered cream; concentrated wear near the base             |
| Painted shop walls | `#ADBDAD`      | Muted sage, faded blue or warm cream; colour supports business identity          |
| Corrugated roofing | `#8F5140`      | Red-brown, weathered slate or muted blue; consistent rib spacing                 |
| Metalwork          | `#414B46`      | Painted gates, burglar bars and poles; small controlled highlights               |
| Glass              | `#829D99`      | Low contrast reflections and dark interiors; no mirror-blue facades              |
| Vegetation         | `#4E6B43`      | Olive midtones, deeper green shade, sunlit yellow-green accents                  |
| Signage accent     | `#D4AE5C`      | Limited use for identity and wayfinding; not a blanket building tint             |

Use broad colour masses first, medium-scale material patterns second, small wear last. Grime and vegetation should not hide entrances, hazards or readable boundaries. Maintain texture density across assets; a tree must not have photographic leaf detail beside a flat, outlined house.

## 4. Nigerian architectural vocabulary

Residential buildings should use low-rise masonry forms, rendered walls, corrugated or long-span metal roofs, shaded entrances and usable compounds. Include details such as water storage, laundry, veranda seating, window bars, gates, refuse storage and potted plants where appropriate. Vary materials and upkeep without portraying a whole district as uniformly distressed.

Housing progression is communicated through space, finish, privacy and landscaping:

| Housing family                    | Exterior language                                                             |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Shared / single room              | Multi-door courtyard block, modest shared frontage, practical service space   |
| Room and parlour / self-contained | Small apartment block or compact compound, distinct accessible entry          |
| Family flat / bungalow            | Wider frontage, shaded porch, private compound, water and utility details     |
| Duplex                            | Coherent two-storey mass, matching window rhythm, roof and stair logic        |
| Premium estate                    | Wider setbacks, maintained walls, landscaping and consistent street furniture |

Art variants must map to actual housing data; no new tier, ownership or rent rule is implied. Do not display a particular facade as the player's property without a confirmed existing property/home mapping.

Commercial areas use practical shopfronts, awnings, restrained painted signs, stall displays and service access. Preserve Cedar Bank, Meridian Bank and Osun Mall as distinct existing destinations. Distinguish the banks through signage and frontage treatment; distinguish the mall through scale, multiple shopfronts and forecourt circulation. Do not substitute new fictional businesses for existing backend targets.

Use supplied/approved branding only. Avoid copied logos, bank trade dress or sacred imagery used as filler. Cultural references should arise from architecture, ordinary domestic objects, market organization and planting. Review any specific cultural/religious motif separately.

## 5. District identities

| District family     | Composition                                             | Signature details                                                    |
| ------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| Residential         | Smaller connected lanes, compounds and quieter setbacks | Gates, laundry, water containers, porch seating, shade trees         |
| Market / commercial | Dense but navigable shop rows and covered stalls        | Awnings, goods displays, service alleys, bins and delivery space     |
| Business / career   | Clear frontages and readable approaches                 | Bank signs, accessible entrances, orderly forecourts, office windows |
| Shopping / leisure  | Larger public circulation and gathering spaces          | Mall entrances, benches, planted edges and parking markings          |
| Recreation          | Open space bounded by shade and paths                   | Benches, community seating, play/sport areas and lighting            |
| Public services     | Legible arrival points and practical infrastructure     | Clinic/civic signs, covered waiting, utility and waste facilities    |

These are visual families, not a replacement district registry. Preserve current district IDs, location slugs and backend permissions. Within a family, vary rooflines, frontage lengths and prop combinations without rotating assets into incompatible perspectives.

## 6. Roads, compounds and ground

Author straight segments, corners, T-junctions and four-way junctions from one compatible road kit. Maintain width, curb height, surface colour and marking alignment across joins. Sidewalk continuity matters more than decorative density.

Provide concrete drainage and deliberate bridges/cover slabs at gates and crossings. Separate compounds from the public route with walls, gates, fences or changes in ground finish. Keep pedestrian corridors, shop entrances and residential access lanes free of blocking props.

Do not repeat identical stains or shrubs on every tile. Use a small shared set of variations with deterministic placement. Inspect seams at gameplay zoom, minimum/maximum zoom and camera edges; texture padding must prevent bright gaps.

## 7. Lighting, shadows and time

Use one soft daylight direction from the upper-left of the screen, with cast shadows toward the lower-right. Record elevation and ground-contact shadows separately. Roof, wall and vegetation shading must agree. Avoid baked shadows crossing several neighboring tiles or making modular joins visible.

Begin with a neutral daylight reference. Evening adds restrained warmth; night reduces ambient light while preserving walkable-route and entrance contrast. Streetlights and windows use small, warm pools of light. They must not turn entire districts into oversaturated glow.

Future time-of-day changes must read the existing shared world clock. Do not create a second simulated clock or change venue schedules to match an art effect. Cache transitions and avoid rebuilding scenery each tick.

## 8. Depth and visibility

Sort people, buildings and props using the same projected ground-contact convention. A tall tree's canopy must not determine its physical footprint. Split unusually wide buildings, foreground walls or canopy layers only when a tested overlap case requires it.

The reference scene must show the player behind and in front of a tree, on both visible sides of a building, entering a doorway, and moving alongside a fence. No roof should pop in front of an unrelated distant actor. Labels should use deliberate overlays and controlled density rather than arbitrary world-depth offsets.

## 9. Asset production and delivery

Create modular ground, road, building, vegetation and prop kits. Each runtime asset record needs a stable asset ID, atlas/frame, projection version, image size, ground anchor, footprint, shadow origin, optional occlusion layers and compatible orientations. Buildings additionally need authored entrance markers and accessible approach points. Interactions bind to existing location/property identifiers in world data, not painted text.

Proposed delivery convention: `public/assets/world/<family>/` for reviewed runtime images/atlases and adjacent JSON manifests; source artwork stays outside runtime bundles unless deliberately required. Store asset metadata alongside the existing neighborhood model. Choose final paths in the approved foundation milestone, not a parallel asset-loading framework.

Use PNG or reviewed lossless WebP with clean alpha, transparent padding and atlas-edge extrusion. Start with 1024px atlas pages and allow up to 2048px only when device profiling supports them. Compression size is not decoded texture memory: an uncompressed RGBA 1024px page is about 4 MiB and a 2048px page about 16 MiB. Do not load an entire future city to show one neighborhood.

Keep neutral material detail in reusable textures; use explicit sign layers for names and other text. Every third-party asset needs a recorded source, licence and modification notes. Generated assets require a reviewed source/reference, consistent perspective/material treatment, and the same footprint/anchor validation as hand-authored assets. No mass generation before reference approval.

## 10. First visual approval scene

Use the existing Olaiya neighborhood as the pilot. Frame one connected crossing with a sidewalk and drainage, a residential compound/gate, a practical shopfront, a tree, streetlight and bench. Include the actual player avatar. Show one readable entrance and the route from spawn to it. Do not add new businesses or production district coordinates solely for this scene.

Required review captures: normal daytime play view at 375px and desktop width; minimum/maximum zoom; player in front of/behind the tree and building; entrance interaction; the same scene at night when time-of-day support is approved. A beauty image alone cannot approve collision, navigation or performance.

## 10A. Owner-supplied visual reference library

The 31-image reference set supplied on 9 November 2026 is catalogued in [Reference image library review](./reference-image-library-review.md). It covers room cutaways, bedroom and living-room furniture, kitchens, appliances, packaging, retail displays, vehicles, dense low-rise urban environments, service interiors, gym equipment, clothing, footwear and construction props.

Treat this as an inspiration library only. It is a mixed-style set, not a coherent production pack and not evidence of redistribution or derivative-work rights. The Art Bible remains the style authority. Re-author models with original geometry, local context, approved materials, the existing camera/projection, catalogue art keys and gameplay footprints. Record source and licence before any close adaptation or production use.

The first practical slice is a catalogue-backed starter-room furnishing composition using the existing R3F house renderer and existing furniture fallbacks. Do not replace the house renderer, introduce SVG, hardcode inventory or ownership, change database schemas, or alter movement and interaction authority. Validate the scene beside the current avatar at desktop and 375px before expanding to appliances, retail props or vehicles.

## 11. Approval checklist

- [x] Owner accepts this direction and the pilot composition.
- [ ] Pilot architecture, projection and player scale are consistent.
- [ ] Materials read as asphalt, concrete, metal, plaster, roofing and vegetation.
- [ ] Roads, paving, drainage and gate crossings join without visible seams.
- [ ] At least one household and one commercial frontage feel locally recognizable.
- [ ] Entrances are visible, reachable and linked to real gameplay targets.
- [ ] Collision footprints and art anchors agree; depth scenarios pass.
- [ ] Player and signage remain readable at 375px without excessive labels.
- [ ] No unexplained mixed styles, copied map imagery or missing asset licences.
- [ ] Actual device results meet the agreed performance targets before district expansion.

Current status: direction approved; the foundation reference uses the existing modular procedural artwork. Production-art quality and asset-library expansion remain separate review gates. No asset library is included in this document.
