import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOUSE_BACK_WALL_Y,
  firstFreeBackWallCell,
  isWallArtKind,
  snapToBackWall,
} from "@/components/game/housing/house-room-contract";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261108210000_wall_art.sql"),
  "utf8",
);

describe("wall art catalogue", () => {
  it("seeds three priced wall art pieces with the 20% increase applied", () => {
    expect(migration).toContain("('wall-art-frame','furniture','decor','wall-art',420,true,false)");
    expect(migration).toContain(
      "('wall-art-canvas','furniture','decor','wall-art-canvas',960,true,false)",
    );
    expect(migration).toContain(
      "('wall-art-mirror','furniture','decor','wall-art-mirror',1440,true,false)",
    );
  });
});

describe("wall-only placement rules", () => {
  it("refuses wall art off the back wall in free placement, slot placement and moves", () => {
    expect(migration).toContain("raise exception 'WALL_ONLY'");
    expect(migration).toContain("not (p_y between 84.5 and 96)");
    expect(migration).toContain("return public._house_error('WALL_ONLY')");
    expect(migration).toContain(
      "if item.art_key like 'wall-art%' then raise exception 'WALL_ONLY'",
    );
  });

  it("keeps the rest of the placement path as it was", () => {
    expect(migration).toContain(
      "_house_move_to_position_original(p_player_id, p_from_slot, p_x, p_y)",
    );
    expect(migration).toContain(
      "grant execute on function public.house_place(uuid,text,text) to service_role;",
    );
  });
});

describe("back wall helpers", () => {
  it("identifies wall art by its art key", () => {
    expect(isWallArtKind("wall-art")).toBe(true);
    expect(isWallArtKind("wall-art-canvas")).toBe(true);
    expect(isWallArtKind("treadmill")).toBe(false);
    expect(isWallArtKind(null)).toBe(false);
  });

  it("snaps wall art to the back row, and to a column", () => {
    const [x, y] = snapToBackWall(3);
    expect(y).toBe(HOUSE_BACK_WALL_Y);
    expect(x).toBeCloseTo(4 + 11.5 * 0.5);
  });

  it("finds the first free back wall column", () => {
    expect(firstFreeBackWallCell([])).toEqual({ x: 4 + 11.5 * 0.5, y: HOUSE_BACK_WALL_Y });
    const taken = Array.from({ length: 8 }, (_, col) => ({
      id: `p${col}`,
      x: 4 + 11.5 * (col + 0.5),
      y: HOUSE_BACK_WALL_Y,
    }));
    expect(firstFreeBackWallCell(taken)).toBeNull();
  });
});
