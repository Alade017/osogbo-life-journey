# Clothing and prop models (static, not yet fitted)

Compressed with gltf-transform: meshopt geometry, WebP textures capped at 1024 px, no simplification.
These are static meshes with no skeleton. They are not wired into the game yet. Each needs scaling,
recentring and fitting to the adult rig (bindGarment, option A) before use.

| File | Source | Measured size (x, y, z) | Units | Status |
| --- | --- | --- | --- | --- |
| hoodie.glb | 22e277bd-hoodie | 1.28 × 0.80 × 0.44 m, y 0.96–1.76 | metres | Needs recentring to the torso |
| hoodie-small.glb | 3f31790a-hoodie_1 | 0.23 × 0.39 × 0.12 m | metres | Probably a detail or patch, not a full hoodie; check |
| jnco-jeans.glb | 4326a042-jnco baggy jeans | 0.52 × 1.09 × 0.29 m | metres | Needs fitting to the legs |
| female-outfit.glb | c0e2f19a-famale_clothes_1 | 178 × 309 × 123 cm, y offset ~3.2 m | centimetres | Needs scale and recentring (about 1/100) |
| citizen-clothes.glb | 9d502484-citizen_clothes | 193 × 287 × 57 units, origin near y 0.9 | unclear | Confirm units |
| casual-clothes.glb | b23386fe-casual_clothes | 424 × 738 × 391 units, y offset ~878 | millimetres | Needs scale (about 1/1000) and recentring |
| clothes-rack.glb | a2111576-clothes | 338 × 108 × 44 units, about 9 meshes | unclear | Contains several items; split by mesh name before use |
| dress.glb | rar dress.obj (OBJ, converted with obj2gltf) | 4.66 × 8.42 × 3.76 units, y offset ~6 | unclear | Needs large scale-down and recentring |

Props, not wired (town dressing only if asked): ../props/sushi-truck.glb (5.1 × 7.3 × 8.0 m) and ../props/truck.glb (2.7 × 2.9 × 5.3 m).

Not converted: the zip's Civ.fbx (needs FBX to GLB). Not included: the trainer and fitness character, which are character models, not clothing.
