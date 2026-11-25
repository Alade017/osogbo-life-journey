"""Bake the road-free overview from the same grid used by the 3D destination pins."""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
town = json.loads((root / "src/data/osogbo-town.json").read_text())
rows = town["grid"]["rows"]
width, height = len(rows[0]), len(rows)
size = 1024
# Blend district colours at the edges instead of outlining rectangular street blocks.
palette = {
    "market": (203, 193, 153), "residential": (179, 193, 150),
    "leisure": (144, 178, 141), "outskirts": (165, 185, 139),
    "school": (188, 197, 163), "transport": (193, 190, 159),
}
centres = []
for district in town["districts"]:
    area = district["gridArea"]
    centres.append((area["x"] + area["width"]/2, area["z"] + area["depth"]/2,
                    palette[district["theme"]]))
base = Image.new("RGB", (256, 256))
for py in range(256):
    for px in range(256):
        x, z = (px+.5)*width/256, (py+.5)*height/256
        weights = [1 / (2+(x-cx)**2+(z-cz)**2)**2 for cx,cz,_ in centres]
        grain = 1.5 * math.sin(x*1.3+math.sin(z)) + 1.8*math.cos(z*1.2)
        base.putpixel((px,py), tuple(round(sum(w*c[i] for w,(_,_,c) in zip(weights,centres))/sum(weights)+grain) for i in range(3)))
image = base.resize((size,size), Image.Resampling.BICUBIC)
draw = ImageDraw.Draw(image)
for z,row in enumerate(rows):
    for x,tile in enumerate(row):
        if tile == "w":
            draw.rectangle((round(x*size/width), round(z*size/height),
                            round((x+1)*size/width)-1, round((z+1)*size/height)-1),
                           fill="#71acb5")
image.save(root / "public/maps/osogbo_topdown.png", optimize=True)
