"""Generate the tileable PNG textures used by neighborhood_environments.py.

Run:  <blender-python> scripts/blender/make_neighborhood_textures.py
Each texture tiles once per metre (the generator writes UVs in metres).
Needs numpy and Pillow in the same Python environment.
"""
import os

import numpy as np
from PIL import Image

SIZE = 256
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textures")


def periodic_noise(rng, size, sigma):
    """Band-limited noise in [0, 1] that wraps seamlessly (FFT low-pass)."""
    white = rng.standard_normal((size, size))
    f = np.fft.fft2(white)
    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.fftfreq(size)[None, :]
    f *= np.exp(-(fx * fx + fy * fy) * (2 * np.pi * sigma) ** 2 / 2)
    n = np.real(np.fft.ifft2(f))
    n -= n.min()
    return n / (n.max() + 1e-9)


def to_png(rgb, name):
    img = np.clip(rgb, 0, 255).astype(np.uint8)
    Image.fromarray(img, "RGB").save(os.path.join(OUT, name), optimize=True)


def paving(rng):
    # 0.4 m interlocking pavers with dark joints and per-stone colour drift
    cell = SIZE // 2.5  # tile edge in px (0.4 m per tile)
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    tile = (np.floor(xx / cell).astype(int) * 7 + np.floor(yy / cell).astype(int) * 13) % 50
    drift = (tile / 50.0 - 0.5) * 20
    base = np.array([196, 184, 162], float)
    rgb = base[None, None, :] + drift[..., None] + (periodic_noise(rng, SIZE, 2.0)[..., None] - 0.5) * 14
    gx = np.minimum(xx % cell, cell - xx % cell) < 2.5
    gy = np.minimum(yy % cell, cell - yy % cell) < 2.5
    rgb[gx | gy] = [150, 139, 122]
    to_png(rgb, "paving.png")


def asphalt(rng):
    n = periodic_noise(rng, SIZE, 1.2)
    fine = periodic_noise(rng, SIZE, 0.4)
    base = np.array([82, 86, 88], float)
    rgb = base[None, None, :] + ((n - 0.5) * 16 + (fine - 0.5) * 8)[..., None]
    to_png(rgb, "asphalt.png")


def roof_tiles(rng):
    # Warm terracotta-brown roof tiles in staggered courses (0.5 m wide, 0.25 m high)
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    course = SIZE // 4
    row = yy // course
    offset = (row % 2) * (SIZE // 4)
    col = (xx + offset) % (SIZE // 2)
    shade = 1.0 - 0.18 * (np.exp(-((yy % course) / 6.0)) - 0.3)
    base = np.array([138, 96, 72], float)
    rgb = base[None, None, :] * shade[..., None] + ((periodic_noise(rng, SIZE, 1.0) - 0.5) * 14)[..., None]
    rgb[(yy % course < 3) | (col < 3)] *= 0.72
    to_png(rgb, "roof_tiles.png")


def plaster(rng):
    n = periodic_noise(rng, SIZE, 3.0)
    fine = periodic_noise(rng, SIZE, 0.5)
    base = np.array([240, 226, 200], float)
    rgb = base[None, None, :] + ((n - 0.5) * 16 + (fine - 0.5) * 4)[..., None]
    to_png(rgb, "plaster.png")


def wall_render(rng):
    n = periodic_noise(rng, SIZE, 2.5)
    base = np.array([232, 212, 176], float)
    rgb = base[None, None, :] + ((n - 0.5) * 12)[..., None]
    to_png(rgb, "wall_render.png")


def lawn(rng):
    n = periodic_noise(rng, SIZE, 0.9)
    fine = periodic_noise(rng, SIZE, 0.3)
    dark = np.array([118, 150, 84], float)
    light = np.array([152, 180, 104], float)
    t = n[..., None]
    rgb = dark[None, None, :] * (1 - t) + light[None, None, :] * t + ((fine - 0.5) * 14)[..., None]
    to_png(rgb, "lawn.png")


def sand(rng):
    n = periodic_noise(rng, SIZE, 2.0)
    fine = periodic_noise(rng, SIZE, 0.4)
    base = np.array([222, 198, 150], float)
    rgb = base[None, None, :] + ((n - 0.5) * 18 + (fine - 0.5) * 6)[..., None]
    to_png(rgb, "sand.png")


def main():
    os.makedirs(OUT, exist_ok=True)
    rng = np.random.default_rng(42)  # fixed seed so the committed PNGs are reproducible
    for fn in (paving, asphalt, roof_tiles, plaster, wall_render, lawn, sand):
        fn(rng)
    print("wrote", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
