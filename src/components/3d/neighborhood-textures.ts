import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

const textureCache = new Map<string, Texture>();

function makeCanvasTexture(
  key: string,
  size: number,
  repeatX: number,
  repeatY: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): Texture | null {
  const cached = textureCache.get(key);
  if (cached) return cached;
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  draw(ctx, size);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  textureCache.set(key, texture);
  return texture;
}

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Stained concrete ground texture with expansion joints and subtle forecourt oil spots. */
export function stainedConcreteTexture(): Texture | null {
  return makeCanvasTexture("stained-concrete", 256, 4, 6, (ctx, size) => {
    ctx.fillStyle = "#b8b4aa";
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 420; i += 1) {
      const x = seededUnit(i * 3 + 1) * size;
      const y = seededUnit(i * 3 + 2) * size;
      const r = 1 + seededUnit(i * 3 + 3) * 3;
      ctx.fillStyle = i % 2 === 0 ? "rgba(92, 88, 80, 0.14)" : "rgba(225, 220, 210, 0.12)";
      ctx.fillRect(x, y, r, r);
    }

    // Subtle oil & tire stain blotches near pump bays
    const stains = [
      { x: 78, y: 92, r: 22 },
      { x: 184, y: 174, r: 26 },
      { x: 112, y: 205, r: 16 },
    ];
    for (const stain of stains) {
      const grad = ctx.createRadialGradient(stain.x, stain.y, 2, stain.x, stain.y, stain.r);
      grad.addColorStop(0, "rgba(42, 40, 38, 0.32)");
      grad.addColorStop(0.6, "rgba(58, 55, 50, 0.16)");
      grad.addColorStop(1, "rgba(58, 55, 50, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(stain.x, stain.y, stain.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Expansion joint grid
    ctx.strokeStyle = "rgba(85, 82, 76, 0.35)";
    ctx.lineWidth = 2;
    for (let p = 0; p < size; p += 64) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
  });
}

/** Interlocking gray concrete paving brick pattern for the Commercial Bank courtyard. */
export function interlockingPavingTexture(): Texture | null {
  return makeCanvasTexture("interlocking-paving", 256, 6, 8, (ctx, size) => {
    ctx.fillStyle = "#9ca3ab";
    ctx.fillRect(0, 0, size, size);

    const cols = 8;
    const rows = 16;
    const w = size / cols;
    const h = size / rows;

    for (let r = 0; r < rows; r += 1) {
      const stagger = (r % 2) * (w * 0.5);
      for (let c = -1; c <= cols; c += 1) {
        const shade = 158 + Math.floor(seededUnit(r * 31 + c * 17) * 26);
        ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
        ctx.fillRect(c * w + stagger + 1.5, r * h + 1.5, w - 3, h - 3);
      }
    }
  });
}

/** Warm Osogbo laterite earth texture for the Adire Makers' Yard & Market. */
export function lateriteGroundTexture(): Texture | null {
  return makeCanvasTexture("laterite-ground", 256, 5, 5, (ctx, size) => {
    ctx.fillStyle = "#c98658";
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 600; i += 1) {
      const x = seededUnit(i * 5 + 1) * size;
      const y = seededUnit(i * 5 + 2) * size;
      const w = 2 + seededUnit(i * 5 + 3) * 6;
      const h = 2 + seededUnit(i * 5 + 4) * 4;
      ctx.fillStyle =
        i % 3 === 0
          ? "rgba(155, 85, 45, 0.22)"
          : i % 3 === 1
            ? "rgba(222, 165, 118, 0.2)"
            : "rgba(110, 62, 34, 0.14)";
      ctx.fillRect(x, y, w, h);
    }

    // Subtle indigo dye splash near vat zone
    const splash = ctx.createRadialGradient(128, 128, 4, 128, 128, 28);
    splash.addColorStop(0, "rgba(22, 34, 92, 0.18)");
    splash.addColorStop(1, "rgba(22, 34, 92, 0)");
    ctx.fillStyle = splash;
    ctx.beginPath();
    ctx.arc(128, 128, 28, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Worn asphalt shoulder texture for the Keke Napep & Korope loading bay. */
export function asphaltShoulderTexture(): Texture | null {
  return makeCanvasTexture("asphalt-shoulder", 256, 2, 6, (ctx, size) => {
    ctx.fillStyle = "#686c6e";
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 360; i += 1) {
      const x = seededUnit(i * 7 + 1) * size;
      const y = seededUnit(i * 7 + 2) * size;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(25,28,30,0.16)";
      ctx.fillRect(x, y, 2, 2);
    }

    // Yellow transit bay edge line
    ctx.fillStyle = "#e7b93c";
    ctx.fillRect(size - 16, 0, 10, size);
  });
}

/** Deep indigo (#16225C) resist-dyed Adire cloth texture for drying racks. */
export function adireIndigoClothTexture(): Texture | null {
  return makeCanvasTexture("adire-indigo-cloth", 256, 2, 2, (ctx, size) => {
    ctx.fillStyle = "#16225C";
    ctx.fillRect(0, 0, size, size);

    const cells = 4;
    const step = size / cells;
    ctx.strokeStyle = "#cbd8f6";
    ctx.fillStyle = "#dbe7ff";
    ctx.lineWidth = 3;

    for (let r = 0; r < cells; r += 1) {
      for (let c = 0; c < cells; c += 1) {
        const cx = (c + 0.5) * step;
        const cy = (r + 0.5) * step;
        // Concentric cassava-starch resist rings
        ctx.beginPath();
        ctx.arc(cx, cy, step * 0.28, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, step * 0.12, 0, Math.PI * 2);
        ctx.fill();

        // Cross-stitch motifs
        ctx.beginPath();
        ctx.moveTo(cx - step * 0.42, cy);
        ctx.lineTo(cx - step * 0.32, cy);
        ctx.moveTo(cx + step * 0.32, cy);
        ctx.lineTo(cx + step * 0.42, cy);
        ctx.moveTo(cx, cy - step * 0.42);
        ctx.lineTo(cx, cy - step * 0.32);
        ctx.moveTo(cx, cy + step * 0.32);
        ctx.lineTo(cx, cy + step * 0.42);
        ctx.stroke();
      }
    }
  });
}
