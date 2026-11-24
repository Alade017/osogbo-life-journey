"""Residential neighbourhood environments for Osun Life.

Single source of truth for two hand-built areas:
  * atiku  -> Greenbank Estates (mid-income flats and bungalows; spec Tier 2)
  * oke-fia -> Hillview Quarter (GRA executive duplexes; spec Tier 3)

Each area is authored in real metres, then:
  1. the GLB environment is exported to public/models/environments/neighborhoods/
  2. the collision obstacles, roads and objects are printed as TypeScript so the game's
     footprints match the model exactly (src/game/neighborhood-model.ts).

Coordinate contract with the game (R3FNeighborhoodSurface.point):
  street x = centre_x + m_x * STREET_PER_METRE      (game unit: 1 m = 1/0.0375 = 26.667 street units)
  street y = centre_y + m_z * STREET_PER_METRE
  glTF x = m_x, glTF z = m_z. Blender Y is set to -m_z because the glTF exporter maps Blender Y to -Z.

Run:  <blender-python> scripts/blender/neighborhood_environments.py [out_dir] [--ts]
Works in a headless bpy (>= 3.6) and inside a live Blender Python console.
"""
import math
import os
import sys

import bpy

STREET_PER_METRE = 1 / 0.0375  # WORLD_SCALE.neighborhoodUnit in world-theme.ts
ENV_CENTRE = (400.0, 300.0)  # matches the entrance convention used by Fuel and Go
FIELD_W, FIELD_D = 30.0, 22.5  # metres; 800 x 600 street units

# ---------------- Palette (world-theme.ts WORLD_PALETTE + neighbourhood style) ----------------
TEX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textures")
P = dict(
    ground="tex:sand", lawn="tex:lawn", pavers="tex:paving", road="tex:asphalt", marking="#f6efe0",
    wall="tex:wall_render", plaster="tex:plaster", roof="tex:roof_tiles", glass="#8fc3d6", door="#7a4522",
    timber="#8c6a4a", accent="#d9833f", indigo="#2f4a8a", sign="#f0cf82", metal="#7b8080",
    gate="#2e3138", gold="#e9c46a", foliage="#6f9a4e", trunk="#8c6a4a", drainage="#5d6361",
    hedge="#5f8c4a", stone="#efe4cc", solar="#27407f",
)

# ---------------- Area definitions (metres, model frame; x east, z south) ----------------
ATIKU = dict(
    prefix="atk_", slug="atiku", name="Greenbank Estates", out="greenbank-estates.glb",
    roads=[
        dict(id="greenbank-avenue", axis="horizontal", offset_m=0.0, width_m=6.0, type="arterial"),
        dict(id="greenbank-cross-street", axis="vertical", offset_m=6.0, width_m=4.0, type="street"),
    ],
    # Gated plots. side = +1 means the gate faces the avenue on +z (north lots), -1 the south.
    lots=[
        dict(id="nw", x=-8.0, z=-6.5, w=10.0, d=7.0, side=1, house="flat"),
        dict(id="sw", x=-8.0, z=6.5, w=10.0, d=7.0, side=-1, house="bungalow"),
        dict(id="ne", x=11.5, z=-6.5, w=6.0, d=7.0, side=1, house="flat"),
        dict(id="se", x=11.5, z=6.5, w=6.0, d=7.0, side=-1, house="bungalow"),
    ],
    shop=dict(id="provisions", x=2.5, z=-7.0, w=4.0, d=6.0, label="Greenbank Provisions"),
    kiosk=dict(id="pos-kiosk", x=3.5, z=4.5, w=1.5, d=1.5, label="POS"),
    trees=[(-14.0, -10.6), (-14.0, 10.6), (14.0, -10.6), (14.0, 10.6)],
    benches=[(-1.5, 4.2)],
    bins=[(-6.3, 3.6)],
    poles=[(-0.4, -10.6)],  # concrete utility pole on the north edge, cables run east-west
    palms=[(-14.2, -7.0), (-14.2, 7.0)],  # west verge, clear of the avenue
    lamps=[(-10.0, -3.7), (-2.0, -3.7), (10.0, -3.7), (-10.0, 3.7), (-2.0, 3.7), (10.0, 3.7)],
    features=[("Housing", 367, 120), ("Community", 400, 500)],
    style=dict(ground="0xd9c9ad", grid="0xcbbd9f", verticalRoad=(560, 107), horizontalRoad=(300, 160)),
    objects=[
        dict(id="home", name="Greenbank homes", kind="home", x=11.5, z=-2.5),
        dict(id="market", name="Greenbank Provisions", kind="market", x=2.5, z=-2.5),
        dict(id="work", name="Greenbank opportunities", kind="work", x=3.5, z=2.5),
        dict(id="npc", name="Neighbour in Greenbank Estates", kind="npc", x=-4.0, z=1.2),
    ],
)

HILLVIEW = dict(
    prefix="hvq_", slug="oke-fia", name="Hillview Quarter", out="hillview-quarter.glb",
    roads=[
        dict(id="hillview-boulevard", axis="horizontal", offset_m=0.0, width_m=8.0, type="arterial"),
        dict(id="hillview-service-road", axis="vertical", offset_m=0.0, width_m=2.5, type="street"),
    ],
    lots=[
        dict(id="ne", x=7.5, z=-8.0, w=11.0, d=6.5, side=1, house="duplex"),
        dict(id="se", x=7.5, z=8.0, w=11.0, d=6.5, side=-1, house="duplex"),
        dict(id="sw", x=-9.0, z=8.0, w=8.0, d=6.5, side=-1, house="duplex"),
    ],
    shop=dict(id="estate-mini-mart", x=-4.0, z=-8.5, w=4.0, d=4.0, label="Hillview Mini-Mart"),
    gatehouse=dict(id="gatehouse", x=-8.5, z=-8.5, w=4.0, d=4.0, label="Estate Security Post"),
    kiosk=dict(id="pos-kiosk", x=-3.0, z=6.5, w=1.5, d=1.5, label="POS"),
    trees=[(-12.5, -10.0), (-14.0, 6.0), (14.0, 6.0), (13.8, -10.5)],
    benches=[],
    bins=[],
    lamps=[(-13.5, -4.4), (13.5, 4.4), (-1.9, -4.4), (1.9, 4.4)],
    palms=[(-14.2, -7.0), (14.4, -6.5)],  # off the boulevard (|z| > 4 m)
    features=[("Eateries", 60, 120), ("Small Shops", 330, 530), ("Gym", 150, 160)],
    style=dict(ground="0xa8bd8c", grid="0x9db07f", verticalRoad=(400, 67), horizontalRoad=(300, 213)),
    objects=[
        dict(id="home", name="Hillview homes", kind="home", x=7.5, z=-2.5),
        dict(id="market", name="Hillview Mini-Mart", kind="market", x=-4.0, z=-3.5),
        dict(id="work", name="Estate Security Post", kind="work", x=-7.0, z=-3.0),
        dict(id="npc", name="Gardener in Hillview Quarter", kind="npc", x=4.0, z=1.5),
    ],
)

# ---------------- Blender helpers ----------------
_mats = {}


def _srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


_tex_images = {}


def _tex_mat(key):
    """Principled material whose base colour is a repeating PNG (one tile per metre)."""
    name = key[len("tex:"):]
    if key not in _mats:
        if name not in _tex_images:
            _tex_images[name] = bpy.data.images.load(os.path.join(TEX_DIR, f"{name}.png"), check_existing=True)
        m = bpy.data.materials.new(name=f"nb_{name}")
        m.use_nodes = True
        tree = m.node_tree
        bsdf = tree.nodes["Principled BSDF"]
        img = tree.nodes.new("ShaderNodeTexImage")
        img.image = _tex_images[name]
        img.interpolation = "Linear"
        tree.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.9
        for key_ in ("Specular IOR Level", "Specular"):
            if key_ in bsdf.inputs:
                bsdf.inputs[key_].default_value = 0.2
                break
        _mats[key] = m
    return _mats[key]


def _box_uv(me, loc, size):
    """UVs in metres from world position, so a texture tiles once per metre on every face."""
    layer = me.uv_layers.active or me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = [i for i in range(3) if i != ax]
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            w = (loc[0] + co.x * size[0], loc[1] + co.y * size[1], loc[2] + co.z * size[2])
            layer.data[li].uv = (w[a], w[b])


def _mat(hex_color):
    if hex_color.startswith("tex:"):
        return _tex_mat(hex_color)
    if hex_color not in _mats:
        h = hex_color.lstrip("#")
        rgb = [_srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)]
        m = bpy.data.materials.new(name=f"nb_{h}")
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.95
        for key in ("Specular IOR Level", "Specular"):  # name differs across Blender versions
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = 0.2
                break
        _mats[hex_color] = m
    return _mats[hex_color]


def _finish(obj, color, prefix_name):
    obj.name = prefix_name
    obj.data.materials.append(_mat(color))
    return obj


def box(name, x, z, w, d, h, color, y0=0.0):
    """Footprint centred at metre (x, z), w along x, d along z, h tall from y0."""
    loc = (x, -z, y0 + h / 2)
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.scale = (w, d, h)
    if color.startswith("tex:"):
        _box_uv(o.data, loc, (w, d, h))
    return _finish(o, color, name)


def slab(name, x, z, y, w, d, tilt_deg, color, heading_deg=0.0):
    """Thin flat panel (solar, sign) tilted about its long axis, centred at metre (x, z), height y."""
    from mathutils import Matrix, Vector
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = (w, d, 0.05)
    o.matrix_world = (Matrix.Translation(Vector((x, -z, y)))
                      @ Matrix.Rotation(math.radians(-heading_deg), 4, "Z")
                      @ Matrix.Rotation(math.radians(tilt_deg), 4, "X")
                      @ Matrix.Diagonal((w, d, 0.05, 1.0)))
    return _finish(o, color, name)


def cyl(name, x, z, r, h, color, y0=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=(x, -z, y0 + h / 2), vertices=10)
    return _finish(bpy.context.active_object, color, name)


def sph(name, x, z, r, color, y0=0.0, sz=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, -z, y0), segments=10, ring_count=6)
    o = bpy.context.active_object
    o.scale = (1, 1, sz)
    return _finish(o, color, name)


def _walls(prefix, lot):
    """Perimeter wall with a 2 m sliding-gate opening on the avenue-facing side."""
    x, z, w, d, s = lot["x"], lot["z"], lot["w"], lot["d"], lot["side"]
    t, h = 0.25, 2.2
    front_z = z + s * d / 2
    back_z = z - s * d / 2
    box(f"{prefix}_wall_w", x - w / 2, z, t, d, h, P["wall"])
    box(f"{prefix}_wall_e", x + w / 2, z, t, d, h, P["wall"])
    box(f"{prefix}_wall_back", x, back_z, w, t, h, P["wall"])
    gap = 2.0
    left_len = w / 2 - gap / 2
    box(f"{prefix}_front_l", x - w / 2 + left_len / 2, front_z, left_len, t, h, P["wall"])
    box(f"{prefix}_front_r", x + w / 2 - left_len / 2, front_z, left_len, t, h, P["wall"])
    box(f"{prefix}_gate", x, front_z, gap - 0.1, 0.08, 2.0, P["gate"])
    box(f"{prefix}_gate_trim", x, front_z + s * 0.05, gap - 0.1, 0.06, 0.12, P["gold"], y0=1.9)


def _flat_block(prefix, lot):
    """Two-storey 'modern flat' block with balcony band, windows, door and a roof tank."""
    x, z, w, d, s = lot["x"], lot["z"], lot["w"], lot["d"], lot["side"]
    bw, bd = w * 0.62, d * 0.55
    cz = z - s * 0.4
    box(f"{prefix}_block", x, cz, bw, bd, 6.0, P["plaster"])
    box(f"{prefix}_roof", x, cz, bw + 0.3, bd + 0.3, 0.3, P["roof"], y0=6.0)
    _solar(prefix, x - bw * 0.2, cz, 6.3, bw * 0.55, bd * 0.7)
    face = cz + s * bd / 2
    box(f"{prefix}_band", x, face + s * 0.04, bw, 0.08, 0.25, P["indigo"], y0=3.0)
    for row in (1.0, 3.8):
        for i in (-1, 0, 1):
            box(f"{prefix}_win_{row}_{i}", x + i * bw / 3.2, face + s * 0.03, 0.9, 0.06, 1.1, P["glass"], y0=row)
    box(f"{prefix}_door", x, face + s * 0.03, 1.0, 0.08, 2.1, P["door"])
    cyl(f"{prefix}_tank", x + bw / 2 - 0.7, cz, 0.6, 1.1, P["metal"], y0=6.3)
    sph(f"{prefix}_palm_top", x - w / 2 + 1.0, z + s * (d / 2 - 1.0), 0.9, P["foliage"], y0=3.0)
    cyl(f"{prefix}_palm_trunk", x - w / 2 + 1.0, z + s * (d / 2 - 1.0), 0.12, 3.2, P["trunk"])


def _bungalow(prefix, lot):
    """Single-storey 3-bed bungalow with pitched-look roof slab and carport."""
    x, z, w, d, s = lot["x"], lot["z"], lot["w"], lot["d"], lot["side"]
    bw, bd = w * 0.6, d * 0.5
    cz = z - s * 0.6
    box(f"{prefix}_block", x, cz, bw, bd, 3.2, P["plaster"])
    box(f"{prefix}_roof", x, cz, bw + 0.4, bd + 0.4, 0.35, P["roof"], y0=3.2)
    _solar(prefix, x + bw * 0.15, cz, 3.55, bw * 0.5, bd * 0.6)
    face = cz + s * bd / 2
    for i in (-1, 1):
        box(f"{prefix}_win_{i}", x + i * bw / 3.5, face + s * 0.03, 1.0, 0.06, 1.2, P["glass"], y0=1.0)
    box(f"{prefix}_door", x, face + s * 0.03, 1.0, 0.08, 2.1, P["door"])
    box(f"{prefix}_carport", x - w / 2 + 1.6, z + s * 0.5, 2.6, 3.0, 0.12, P["stone"], y0=2.6)


def _duplex(prefix, lot):
    """GRA duplex: stone-clad two-storey with glass balcony and a stone carriage drive."""
    x, z, w, d, s = lot["x"], lot["z"], lot["w"], lot["d"], lot["side"]
    bw, bd = w * 0.7, d * 0.55
    cz = z - s * 0.5
    box(f"{prefix}_block", x, cz, bw, bd, 6.4, P["stone"])
    box(f"{prefix}_roof", x, cz, bw + 0.4, bd + 0.4, 0.3, P["roof"], y0=6.4)
    _solar(prefix, x, cz, 6.7, bw * 0.6, bd * 0.6)
    face = cz + s * bd / 2
    box(f"{prefix}_balcony", x, face + s * 0.25, bw * 0.8, 0.5, 0.12, P["stone"], y0=3.4)
    box(f"{prefix}_balcony_glass", x, face + s * 0.5, bw * 0.8, 0.06, 1.0, P["glass"], y0=3.5)
    for row in (1.0, 4.3):
        for i in (-1, 0, 1):
            box(f"{prefix}_win_{row}_{i}", x + i * bw / 3.3, face + s * 0.03, 0.9, 0.06, 1.2, P["glass"], y0=row)
    box(f"{prefix}_door", x + bw / 4, face + s * 0.03, 1.1, 0.08, 2.2, P["door"])
    box(f"{prefix}_drive", x - w / 2 + 1.4, z + s * 1.2, 2.8, 4.0, 0.06, P["pavers"])


HOUSE = {"flat": _flat_block, "bungalow": _bungalow, "duplex": _duplex}


def _compound_kit(prefix, lot):
    """Spec props inside each plot: black water tank on a steel stand (back corner) and a
    generator cage (front corner). Decorative only, so the collision data is unchanged."""
    x, z, w, d, s = lot["x"], lot["z"], lot["w"], lot["d"], lot["side"]
    tx, tz = x - w / 2 + 1.0, z - s * (d / 2 - 1.0)
    for i, (dx, dz) in enumerate(((-0.3, -0.3), (0.3, -0.3), (-0.3, 0.3), (0.3, 0.3))):
        box(f"{prefix}_tank_leg_{i}", tx + dx, tz + dz, 0.08, 0.08, 1.2, P["metal"])
    cyl(f"{prefix}_tank", tx, tz, 0.55, 1.0, P["gate"], y0=1.2)
    box(f"{prefix}_gen_cage", x + w / 2 - 1.2, z + s * (d / 2 - 1.2), 1.0, 0.8, 0.9, P["metal"])
    box(f"{prefix}_gen_unit", x + w / 2 - 1.2, z + s * (d / 2 - 1.2), 0.7, 0.5, 0.6, P["gate"], y0=0.1)


def _hedge(prefix, lot):
    """Clipped hedge along the inside of the back wall (GRA estate look)."""
    x, z, w, d, s = lot["x"], lot["z"], lot["w"], lot["d"], lot["side"]
    box(f"{prefix}_hedge", x, z - s * (d / 2 - 0.25), w - 1.0, 0.5, 1.1, P["hedge"])


def _utility_pole(prefix, i, x, z, h=6.5):
    """Concrete NEPA-style pole with a crossarm and transformer; cables run east-west."""
    box(f"{prefix}_pole_{i}", x, z, 0.3, 0.3, h, P["stone"])
    box(f"{prefix}_crossarm_{i}", x, z, 1.6, 0.12, 0.12, P["trunk"], y0=h - 0.6)
    box(f"{prefix}_transformer_{i}", x, z + 0.25, 0.5, 0.4, 0.6, P["metal"], y0=h - 2.2)
    box(f"{prefix}_cable_{i}", 0, z, FIELD_W, 0.02, 0.02, P["gate"], y0=h - 0.7)


def _palm(prefix, i, x, z, h=5.2):
    """Palm: leaning trunk and a crown of drooping fronds (clean low-poly, per the spec)."""
    from mathutils import Matrix, Vector
    lean = math.radians(7 if i % 2 else -6)
    top = Vector((x, -z, h))
    tm = Matrix.Translation(Vector((x, -z, h / 2))) @ Matrix.Rotation(lean, 4, "X") @ Matrix.Diagonal((0.14, 0.14, h, 1.0))
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=1.0, depth=1.0)
    o = bpy.context.active_object
    o.name = f"{prefix}_palm_trunk_{i}"
    o.matrix_world = tm
    o.data.materials.append(_mat(P["trunk"]))
    for k in range(8):
        a = math.radians(k * 45 + (i * 17))
        tilt = math.radians(38)
        dirv = Vector((math.cos(a), math.sin(a), 0))
        centre = top + Vector((dirv.x * 1.2, -dirv.y * 1.2, -0.2))  # Blender Y = -metre z
        m = (Matrix.Translation(centre)
             @ Matrix.Rotation(-a, 4, "Z")
             @ Matrix.Rotation(tilt, 4, "Y")
             @ Matrix.Diagonal((2.4, 0.42, 0.05, 1.0)))
        bpy.ops.mesh.primitive_cube_add(size=1)
        f = bpy.context.active_object
        f.name = f"{prefix}_frond_{i}_{k}"
        f.matrix_world = m
        f.data.materials.append(_mat(P["foliage"]))


def _solar(prefix, x, z, y, w, d):
    """Two-row solar array tilted to the south-east, as on the reference roofs."""
    slab(f"{prefix}_solar_a", x, z - 0.35, y + 0.35, w, d * 0.45, 18, P["solar"])
    slab(f"{prefix}_solar_b", x, z + 0.35, y + 0.35, w, d * 0.45, 18, P["solar"])


def _lamp(prefix, i, x, z):
    cyl(f"{prefix}_lamp_pole_{i}", x, z, 0.05, 3.2, P["metal"])
    box(f"{prefix}_lamp_head_{i}", x, z, 0.5, 0.25, 0.15, P["sign"], y0=3.15)


def _tree(prefix, i, x, z):
    cyl(f"{prefix}_tree_trunk_{i}", x, z, 0.15, 2.2, P["trunk"])
    sph(f"{prefix}_tree_crown_{i}", x, z, 1.0, P["foliage"], y0=2.6, sz=0.9)


def build(area):
    pre = area["prefix"]
    box(f"{pre}ground", 0, 0, FIELD_W, FIELD_D, 0.1, P["lawn"] if area["slug"] == "oke-fia" else P["ground"], y0=-0.1)
    road_color = P["road"]
    for r in area["roads"]:
        if r["axis"] == "horizontal":
            box(f"{pre}{r['id']}", 0, r["offset_m"], FIELD_W, r["width_m"], 0.05, road_color)
            for i in range(-14, 14, 3):
                box(f"{pre}{r['id']}_mark_{i}", i + 0.5, r["offset_m"], 1.6, 0.12, 0.02, P["marking"], y0=0.05)
        else:
            box(f"{pre}{r['id']}", r["offset_m"], 0, r["width_m"], FIELD_D, 0.045, road_color)
    for lot in area["lots"]:
        _walls(f"{pre}{lot['id']}", lot)
        HOUSE[lot["house"]](f"{pre}{lot['id']}", lot)
        _compound_kit(f"{pre}{lot['id']}", lot)
        if area["slug"] == "oke-fia":
            _hedge(f"{pre}{lot['id']}", lot)
    for i, (x, z) in enumerate(area.get("poles", [])):
        _utility_pole(pre, i, x, z)
    for i, (x, z) in enumerate(area.get("palms", [])):
        _palm(pre, i, x, z)
    shop = area["shop"]
    box(f"{pre}shop_{shop['id']}", shop["x"], shop["z"], shop["w"], shop["d"], 3.2, P["plaster"])
    box(f"{pre}shop_awning", shop["x"], shop["z"] + shop["d"] / 2 + 0.6, shop["w"] + 0.6, 1.2, 0.15, P["accent"], y0=2.6)
    box(f"{pre}shop_sign", shop["x"], shop["z"] + shop["d"] / 2 + 0.05, shop["w"] * 0.8, 0.08, 0.5, P["sign"], y0=3.0)
    gh = area.get("gatehouse")
    if gh:
        box(f"{pre}gatehouse", gh["x"], gh["z"], gh["w"], gh["d"], 3.4, P["stone"])
        box(f"{pre}gatehouse_roof", gh["x"], gh["z"], gh["w"] + 0.4, gh["d"] + 0.4, 0.3, P["roof"], y0=3.4)
        box(f"{pre}gatehouse_sign", gh["x"], gh["z"] + gh["d"] / 2 + 0.05, 2.6, 0.08, 0.45, P["indigo"], y0=2.6)
    k = area["kiosk"]
    box(f"{pre}pos_kiosk", k["x"], k["z"], k["w"], k["d"], 2.2, P["timber"])
    cyl(f"{pre}pos_pole", k["x"], k["z"], 0.04, 2.6, P["metal"])
    cyl(f"{pre}pos_umbrella", k["x"], k["z"], 1.1, 0.15, P["accent"], y0=2.5)
    for i, (x, z) in enumerate(area["trees"]):
        _tree(pre, i, x, z)
    for i, (x, z) in enumerate(area["benches"]):
        box(f"{pre}bench_{i}", x, z, 1.8, 0.5, 0.45, P["timber"])
    for i, (x, z) in enumerate(area["bins"]):
        box(f"{pre}bin_{i}", x, z, 0.6, 0.6, 0.7, P["drainage"])
    for i, (x, z) in enumerate(area["lamps"]):
        _lamp(pre, i, x, z)


# ---------------- Export and TypeScript output ----------------
def _street(x_m, z_m):
    return (ENV_CENTRE[0] + x_m * STREET_PER_METRE, ENV_CENTRE[1] + z_m * STREET_PER_METRE)


def _ts_area(area):
    lines = [f'export const {area["slug"].upper().replace("-", "_")}_AREA: NeighborhoodArea = {{',
             f'  slug: "{area["slug"]}",', f'  name: "{area["name"]}",', "  objects: ["]
    for o in area["objects"]:
        sx, sy = _street(o["x"], o["z"])
        lines.append(f'    {{ id: "{o["id"]}", name: "{o["name"]}", kind: "{o["kind"]}", shopSlug: null, x: {sx:.0f}, y: {sy:.0f} }},')
    lines.append("  ],")
    lines.append("  roads: [")
    for r in area["roads"]:
        if r["axis"] == "horizontal":
            off = ENV_CENTRE[1] + r["offset_m"] * STREET_PER_METRE
        else:
            off = ENV_CENTRE[0] + r["offset_m"] * STREET_PER_METRE
        lines.append(f'    {{ id: "{r["id"]}", axis: "{r["axis"]}", offset: {off:.0f}, width: {r["width_m"] * STREET_PER_METRE:.0f}, type: "{r["type"]}" }},')
    lines.append("  ],")
    lines.append("  obstacles: [")
    for lot in area["lots"]:
        sx, sy = _street(lot["x"], lot["z"])
        lines.append(f'    {{ id: "{area["slug"]}-compound-{lot["id"]}", kind: "compound", x: {sx:.0f}, y: {sy:.0f}, width: {lot["w"] * STREET_PER_METRE:.0f}, height: {lot["d"] * STREET_PER_METRE:.0f} }},')
    for key in ("shop", "gatehouse", "kiosk"):
        it = area.get(key)
        if not it:
            continue
        sx, sy = _street(it["x"], it["z"])
        kind = {"shop": "shop", "gatehouse": "landmark", "kiosk": "kiosk"}[key]
        label = f', label: "{it["label"]}"' if "label" in it else ""
        lines.append(f'    {{ id: "{area["slug"]}-{it["id"]}", kind: "{kind}"{label}, x: {sx:.0f}, y: {sy:.0f}, width: {it["w"] * STREET_PER_METRE:.0f}, height: {it["d"] * STREET_PER_METRE:.0f} }},')
    for i, (x, z) in enumerate(area["trees"]):
        sx, sy = _street(x, z)
        lines.append(f'    {{ id: "{area["slug"]}-tree-{i}", kind: "tree", x: {sx:.0f}, y: {sy:.0f}, width: 24, height: 24 }},')
    for i, (label, sx, sy) in enumerate(area["features"]):
        lines.append(f'    {{ id: "district-feature-{i}", kind: "landmark", label: "{label}", x: {sx}, y: {sy}, width: 60, height: 40 }},')
    lines.append("  ],")
    lines.append(f'  environment: {{ url: "/models/environments/neighborhoods/{area["out"]}", x: {ENV_CENTRE[0]:.0f}, y: {ENV_CENTRE[1]:.0f}, width: {FIELD_W * STREET_PER_METRE:.0f}, height: {FIELD_D * STREET_PER_METRE:.0f} }},')
    st = area["style"]
    lines.append("  style: {")
    lines.append(f'    ground: {st["ground"]},')
    lines.append(f'    grid: {st["grid"]},')
    lines.append("    road: 0x777872,")
    lines.append("    paving: 0xc5b9a5,")
    lines.append("    marking: 0xeee6d5,")
    lines.append(f'    verticalRoad: {{ x: {st["verticalRoad"][0]}, width: {st["verticalRoad"][1]} }},')
    lines.append(f'    horizontalRoad: {{ y: {st["horizontalRoad"][0]}, height: {st["horizontalRoad"][1]} }},')
    lines.append("  },")
    lines.append("};")
    return "\n".join(lines)


def export(area, out_dir):
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.objects:
        if o.name.startswith(area["prefix"]):
            o.select_set(True)
    path = os.path.join(out_dir, area["out"])
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True)
    return path


def clear(prefix):
    for o in list(bpy.data.objects):
        if o.name.startswith(prefix):
            bpy.data.objects.remove(o, do_unlink=True)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_dir = argv[0] if argv and not argv[0].startswith("--") else None
    for area in (ATIKU, HILLVIEW):
        clear(area["prefix"])
        build(area)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
            print("EXPORTED", export(area, out_dir))
        print(_ts_area(area))


if __name__ == "__main__":
    main()
