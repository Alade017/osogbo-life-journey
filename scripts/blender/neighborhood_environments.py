"""Residential neighbourhood environments for Osun Life.

Single source of truth for two hand-built areas:
  * atiku  -> Greenbank Estates (mid-income flats and bungalows; spec Tier 2)
  * oke-fia -> Hillview Quarter (GRA executive duplexes; spec Tier 3)

The layout (roads, plots, shops, kiosks, trees, home/market/work points) is exported from the
game's TypeScript by scripts/blender/export-layouts.ts into scripts/blender/layouts/*.json, so the
model and the collision data cannot drift. Only visual decor is authored here (DECOR below), and
each area is exported to public/models/environments/neighborhoods/.

Coordinate contract with the game (R3FNeighborhoodSurface.point):
  street x = centre_x + m_x * STREET_PER_METRE      (game unit: 1 m = 1/0.0375 = 26.667 street units)
  street y = centre_y + m_z * STREET_PER_METRE
  glTF x = m_x, glTF z = m_z. Blender Y is set to -m_z because the glTF exporter maps Blender Y to -Z.

Run:  <blender-python> scripts/blender/neighborhood_environments.py -- [out_dir]
Works in a headless bpy (>= 3.6) and inside a live Blender Python console.
"""
import json
import math
import os
import sys

import bpy

STREET_PER_METRE = 1 / 0.0375  # WORLD_SCALE.neighborhoodUnit in world-theme.ts
ENV_CENTRE = (400.0, 300.0)  # matches the entrance convention used by Fuel and Go
FIELD_W, FIELD_D = 30.0, 22.5  # metres; set per area from its frame in build()

# ---------------- Palette (world-theme.ts WORLD_PALETTE + neighbourhood style) ----------------
TEX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textures")
P = dict(
    ground="tex:sand", lawn="tex:lawn", pavers="tex:paving", road="tex:asphalt", marking="#f6efe0",
    wall="tex:wall_render", plaster="tex:plaster", roof="tex:roof_tiles", glass="#8fc3d6", door="#7a4522",
    timber="#8c6a4a", accent="#d9833f", indigo="#2f4a8a", sign="#f0cf82", metal="#7b8080",
    gate="#2e3138", gold="#e9c46a", foliage="#6f9a4e", trunk="#8c6a4a", drainage="#5d6361",
    hedge="#5f8c4a", stone="#efe4cc", solar="#27407f",
)

# ---------------- Area definitions ----------------
# Layout comes from scripts/blender/layouts/<slug>.json (exported from the game's TypeScript).
# Only visual decor is authored here: house styles per plot and the lamps, benches, bins,
# poles, palms and district labels. None of it is collision data.
LAYOUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "layouts")

DECOR = {
    "atiku": dict(
        prefix="atk_", out="greenbank-estates.glb",
        houses={
            "nw": "flat", "sw": "bungalow", "ne": "flat", "se": "bungalow",
            "n-east": "flat", "n-far": "flat", "s-east": "bungalow", "s-far": "bungalow",
            "c-w": "flat", "c-mid": "bungalow", "c-e": "flat", "c-east": "bungalow", "c-far": "flat",
            "d-w": "bungalow", "d-mid": "flat", "d-e": "bungalow", "d-east": "flat", "d-far": "bungalow",
        },
        benches=[(-16.5, -7.05)],
        bins=[(-21.3, -7.65)],
        poles=[(-15.4, -21.85)],  # concrete utility pole on the north edge, cables run east-west
        palms=[(-29.2, -18.25), (-29.2, -4.25)],  # west verge, clear of the avenue
        lamps=[(-25.0, -14.95), (-17.0, -14.95), (-5.0, -14.95), (-25.0, -7.55), (-17.0, -7.55), (-5.0, -7.55)],
        features=[("Housing", 367, 120), ("Community", 400, 500)],
    ),
    "oke-fia": dict(
        prefix="hvq_", out="hillview-quarter.glb",
        houses={
            "ne": "duplex", "se": "duplex", "sw": "duplex",
            "n-east": "duplex", "n-far": "duplex", "s-east": "duplex", "s-far": "duplex",
            "c-w": "duplex", "c-mid": "duplex", "c-east": "duplex", "c-far": "duplex",
            "d-w": "duplex", "d-mid": "duplex", "d-east": "duplex", "d-far": "duplex",
        },
        benches=[],
        bins=[],
        poles=[],
        # Decor is in metres from the frame centre (800, 600), shifted from the old (400, 300) centre.
        palms=[(-29.2, -18.25), (-0.6, -17.75)],  # clear of the boulevard (|z| > 4 m)
        lamps=[(-28.5, -15.65), (-1.5, -6.85), (-16.9, -15.65), (-13.1, -6.85)],
        features=[("Eateries", 60, 120), ("Small Shops", 330, 530), ("Gym", 150, 160)],
    ),
    "city-centre": dict(
        prefix="olj_", out="olaiya.glb",
        houses={},  # Olaiya has no housing plots: its places are drawn from the layout's places list
        benches=[(2.0, 5.0)],
        bins=[(-21.0, 9.0), (3.0, -1.0)],
        poles=[],  # no utility poles in the market street: the redesign keeps the view open
        palms=[(27.0, -18.0), (27.0, 4.0), (27.0, 17.0)],
        # Three street lamps along the north side of the market road; the rest of the street is open.
        lamps=[(-19.0, -12.8), (-1.0, -12.8), (10.0, -12.8)],
        features=[],
    ),
}


def load_area(slug):
    """Layout from the exported JSON plus the visual decor for that slug."""
    with open(os.path.join(LAYOUT_DIR, f"{slug}.json")) as f:
        layout = json.load(f)
    d = DECOR[slug]
    layout["prefix"] = d["prefix"]
    layout["out"] = d["out"]
    for key in ("benches", "bins", "poles", "palms", "lamps", "features"):
        layout[key] = d[key]
    for lot in layout["lots"]:
        lot["house"] = d["houses"][lot["id"]]  # every plot needs a house style
    layout["trees"] = [tuple(t) for t in layout["trees"]]
    return layout


ATIKU = load_area("atiku")
HILLVIEW = load_area("oke-fia")
CITY = load_area("city-centre")

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


def _open_stall(name, x, z, w, d, roof):
    """Open-fronted market stall: four timber posts under a cloth roof."""
    for i, (dx, dz) in enumerate([(-w / 2 + 0.15, -d / 2 + 0.15), (w / 2 - 0.15, -d / 2 + 0.15),
                                  (-w / 2 + 0.15, d / 2 - 0.15), (w / 2 - 0.15, d / 2 - 0.15)]):
        cyl(f"{name}_post_{i}", x + dx, z + dz, 0.06, 2.6, P["timber"])
    box(f"{name}_cloth", x, z, w + 0.3, d + 0.3, 0.12, roof, y0=2.6)
    box(f"{name}_counter", x, z + d / 2 - 0.3, w * 0.9, 0.5, 0.9, P["timber"])


def _place(pre, p):
    """Visual for one named street place (shop, kiosk or landmark) on the Olaiya layout."""
    x, z, w, d, pid, kind = p["x"], p["z"], p["w"], p["d"], p["id"], p["kind"]
    name = f"{pre}place_{pid}"
    if pid.endswith("fuel-pumps"):
        # Open forecourt: a canopy on four posts over two pumps.
        for i, (dx, dz) in enumerate([(-w / 2 + 0.2, -d / 2 + 0.2), (w / 2 - 0.2, -d / 2 + 0.2),
                                      (-w / 2 + 0.2, d / 2 - 0.2), (w / 2 - 0.2, d / 2 - 0.2)]):
            cyl(f"{name}_post_{i}", x + dx, z + dz, 0.07, 3.6, P["metal"])
        box(f"{name}_canopy", x, z, w + 0.4, d + 0.4, 0.25, P["accent"], y0=3.6)
        box(f"{name}_pump_a", x - w / 4, z, 0.5, 0.5, 1.2, P["indigo"])
        box(f"{name}_pump_b", x + w / 4, z, 0.5, 0.5, 1.2, P["indigo"])
    elif pid.endswith("transit"):
        # Open bus and keke shelter with a bench under the roof.
        for i, (dx, dz) in enumerate([(-w / 2 + 0.2, -d / 2 + 0.2), (w / 2 - 0.2, -d / 2 + 0.2)]):
            cyl(f"{name}_post_{i}", x + dx, z + dz, 0.06, 2.8, P["metal"])
        box(f"{name}_roof", x, z, w + 0.2, d + 0.2, 0.2, P["indigo"], y0=2.8)
        box(f"{name}_bench", x, z + d / 2 - 0.3, 1.8, 0.5, 0.45, P["timber"])
        box(f"{name}_sign", x, z - d / 2 + 0.05, w * 0.6, 0.08, 0.4, P["sign"], y0=2.4)
    elif pid.endswith("atm"):
        # Small glass-fronted ATM booth.
        box(f"{name}_booth", x, z, w, d, 2.8, P["plaster"])
        box(f"{name}_glass", x, z + d / 2 + 0.02, w * 0.6, 0.04, 1.2, P["glass"], y0=0.8)
        box(f"{name}_sign", x, z + d / 2 + 0.05, w * 0.8, 0.08, 0.4, P["indigo"], y0=2.6)
    elif pid.endswith(("adire-vats", "adire-racks", "market-stalls")):
        _open_stall(name, x, z, w, d, P["indigo"] if "vats" in pid else P["accent"])
        if "vats" in pid:
            for i, dx in enumerate((-w / 3, 0.0, w / 3)):
                cyl(f"{name}_vat_{i}", x + dx, z - d / 4, 0.4, 0.7, P["indigo"], y0=0.0)
    elif kind == "kiosk":
        box(f"{name}_kiosk", x, z, w, d, 2.2, P["timber"])
        cyl(f"{name}_umbrella", x, z, 1.1, 0.15, P["accent"], y0=2.5)
    elif kind == "shop":
        box(f"{name}_shop", x, z, w, d, 3.2, P["plaster"])
        box(f"{name}_awning", x, z + d / 2 + 0.6, w + 0.6, 1.2, 0.15, P["accent"], y0=2.6)
        box(f"{name}_sign", x, z + d / 2 + 0.05, w * 0.8, 0.08, 0.5,
            P["indigo"] if "bank" in pid else P["sign"], y0=3.0)
    else:
        # Generic landmark block: stone walls, tiled roof, sign band.
        box(f"{name}_block", x, z, w, d, 3.4, P["stone"])
        box(f"{name}_roof", x, z, w + 0.4, d + 0.4, 0.3, P["roof"], y0=3.4)
        box(f"{name}_sign", x, z + d / 2 + 0.05, w * 0.7, 0.08, 0.45, P["indigo"], y0=2.9)


PRODUCE = ["#e2832f", "#c94a3a", "#6f9a4e", "#e9c46a"]


def _planter(prefix, i, x, z, w=3.0, d=1.6):
    """Raised stone planter bed with three shrubs, for market frontages and verges."""
    box(f"{prefix}_planter_{i}", x, z, w, d, 0.35, P["stone"])
    for j, dx in enumerate((-w / 3, 0.0, w / 3)):
        sph(f"{prefix}_shrub_{i}_{j}", x + dx, z, 0.5, P["hedge"] if j % 2 == 0 else P["foliage"], y0=0.75, sz=0.8)


def _crates(prefix, i, x, z):
    """Stacked produce crates in mixed orange, red, green and yellow."""
    box(f"{prefix}_crate_a_{i}", x, z, 0.8, 0.6, 0.4, PRODUCE[i % 4])
    box(f"{prefix}_crate_b_{i}", x + 0.9, z, 0.8, 0.6, 0.4, PRODUCE[(i + 1) % 4])
    box(f"{prefix}_crate_c_{i}", x + 0.45, z, 0.8, 0.6, 0.4, PRODUCE[(i + 2) % 4], y0=0.4)


def _string_lights(prefix, x0, x1, z, y=3.0, step=2.0):
    """Festoon of lanterns strung between two posts across a street."""
    for end, x in (("a", x0), ("b", x1)):
        cyl(f"{prefix}_string_post_{end}", x, z, 0.06, y + 0.2, P["metal"])
    n = int((x1 - x0) / step)
    for i in range(1, n):
        x = x0 + i * step
        sph(f"{prefix}_lantern_{i}", x, z, 0.16, [P["sign"], P["accent"], "#d9604f"][i % 3], y0=y - 0.25)


WHITE = "#f6efe0"
KERB = "#d9d4c7"


def _zebra(prefix, i, x, z, road_w, stripes=6, step=0.7):
    """Zebra crossing across a vertical road at (x, z): bars long across the road, spaced along it."""
    for k in range(stripes):
        box(f"{prefix}_zebra_{i}_{k}", x, z + (k - (stripes - 1) / 2) * step, road_w, 0.4, 0.02, WHITE, y0=0.06)


def _kerb(prefix, name, x, z, w, d):
    """Light kerb strip along a road edge."""
    box(f"{prefix}_kerb_{name}", x, z, w, d, 0.14, KERB)


def _chalkboard(prefix, i, x, z):
    """A-frame chalkboard sign with a timber frame, the way the market stalls label their prices."""
    box(f"{prefix}_board_{i}", x, z, 0.7, 0.06, 0.9, "#2b2f2a", y0=0.5)
    box(f"{prefix}_board_frame_{i}", x, z - 0.04, 0.78, 0.04, 0.98, P["timber"], y0=0.46)


def _produce_pile(prefix, i, x, z):
    """Heaped fruit on a stall table: a row of coloured spheres."""
    for j, dx in enumerate((-0.25, 0.0, 0.25)):
        sph(f"{prefix}_fruit_{i}_{j}", x + dx, z, 0.14, PRODUCE[(i + j) % 4], y0=1.0)


def _city_dressing(pre):
    """Market-street dressing for Olaiya: planters, produce, lantern strings and extra shade trees."""
    for i, (x, z) in enumerate([(-20.0, -1.5), (-12.0, -1.5), (-4.0, -1.5), (4.0, -1.5),
                                (-20.0, 8.5), (-4.0, 9.0), (6.0, 9.0), (18.0, 9.0)]):
        _planter(pre, i, x, z)
    for i, (x, z) in enumerate([(-11.6, -2.9), (-6.2, -2.9), (-0.6, -2.9), (3.8, -2.9),
                                (14.7, -17.8), (7.7, -17.8)]):
        _crates(pre, i, x, z)
    # Two lantern festoons over the market road and the transit lane, like the night market reference.
    _string_lights(pre, -26.0, 17.0, -11.25)
    _string_lights(pre, -18.0, 16.0, 1.875)
    # Zebra crossings across the main road and the east road, kerbs along the market road and the south road.
    for i, z in enumerate([-4.0, -2.4, -0.8]):
        _zebra(pre, i, -27.75, z - 4.0 + 0.0, 3.6, stripes=5)
    for i in range(3):
        _zebra(pre, 10 + i, 18.75, 4.0 + i * 3.6 - 3.6, 3.6, stripes=5)
    _kerb(pre, "market-north", -6.0, -13.05, 44.0, 0.15)
    _kerb(pre, "market-south", -6.0, -9.45, 44.0, 0.15)
    _kerb(pre, "south-north", -6.0, 11.3, 44.0, 0.15)
    _kerb(pre, "south-south", -6.0, 14.95, 44.0, 0.15)
    # Hedge line along the south edge, like the hedged frontages in the boulevard reference.
    box(f"{pre}_hedge_south", 0.0, 15.6, 44.0, 0.8, 0.7, P["hedge"], y0=0.0)
    # Chalkboards and produce piles at the stall fronts.
    for i, (x, z) in enumerate([(-11.6, -2.2), (-0.6, -2.2), (9.7, -2.2)]):
        _chalkboard(pre, i, x, z)
    for i, (x, z) in enumerate([(-13.1, -4.8), (-8.45, -4.8), (-3.75, -4.8), (9.75, -4.8)]):
        _produce_pile(pre, i, x, z)
    # Extra shade trees on the verges and between the stalls.
    for i, (x, z) in enumerate([(-15.5, 16.2), (3.5, 16.3), (22.5, 4.5), (22.5, -6.0), (-22.0, -6.0)]):
        _tree(pre, 100 + i, x, z)


def build(area):
    global FIELD_W, FIELD_D
    FIELD_W, FIELD_D = area["frame"]["width_m"], area["frame"]["depth_m"]
    pre = area["prefix"]
    ground = {"oke-fia": P["lawn"], "city-centre": P["pavers"]}.get(area["slug"], P["ground"])
    box(f"{pre}ground", 0, 0, FIELD_W, FIELD_D, 0.1, ground, y0=-0.1)
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
    # Places beyond the shop, kiosk and gatehouse (drawn above) get their own visual.
    drawn = {shop["id"], k["id"]}
    for p in area.get("places", []):
        if p["id"] in drawn or p["id"].endswith("-gatehouse"):
            continue
        _place(pre, p)
    for i, (x, z) in enumerate(area["trees"]):
        _tree(pre, i, x, z)
    for i, (x, z) in enumerate(area["benches"]):
        box(f"{pre}bench_{i}", x, z, 1.8, 0.5, 0.45, P["timber"])
    for i, (x, z) in enumerate(area["bins"]):
        box(f"{pre}bin_{i}", x, z, 0.6, 0.6, 0.7, P["drainage"])
    for i, (x, z) in enumerate(area["lamps"]):
        _lamp(pre, i, x, z)
    if area["slug"] == "city-centre":
        _city_dressing(pre)


# ---------------- Export ----------------
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
    out_dir = argv[0] if argv else None
    for area in (ATIKU, HILLVIEW, CITY):
        clear(area["prefix"])
        build(area)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
            print("EXPORTED", export(area, out_dir))


if __name__ == "__main__":
    main()
