import * as Phaser from "phaser";
import { cityEntranceForLocation } from "@/lib/city-world";
import {
  projectNeighborhood as project,
  neighborhoodDepth,
  neighborhoodBuildingFootprint,
  NEIGHBORHOOD_TILE_SIZE as TILE_SIZE,
} from "@/game/neighborhood-geometry";
import type { AvatarAnimationState, AvatarEquipment, AvatarFacing } from "@/components/game/Avatar";
import type { Appearance } from "@/game/avatar-appearance";
import { AVATAR_DIRECTIONS, avatarAnimationKey } from "@/game/character-animation";
import { ensureAvatarTexture } from "@/game/character-texture";
import {
  NEIGHBORHOOD_ART_ASSETS,
  NEIGHBORHOOD_BUILDING_ART,
  NEIGHBORHOOD_PROP_ART,
  neighborhoodPropArtKind,
} from "@/game/neighborhood-art";
import {
  neighborhoodSceneBounds,
  type NeighborhoodArea,
  type NeighborhoodObject,
  type NeighborhoodObstacle,
  type NeighborhoodPath,
  type NeighborhoodRoad,
  toScene,
  neighborhoodAreaOrigin,
  type WorldPoint,
} from "@/game/neighborhood-model";

const DEFAULT_PLAYER_TEXTURE = "neighborhood-player-fallback";

export type NeighborhoodPlayerView = {
  sessionId: string;
  characterId: string;
  name: string;
  gender: string;
  appearance: string;
  equipment: string;
  x: number;
  y: number;
  facing: string;
  actionAnimation?: AvatarAnimationState;
};

export type PhaserNeighborhoodHandle = {
  setPlayers: (players: readonly NeighborhoodPlayerView[]) => void;
  setZoom: (factor: number) => void;
  setFollow: (enabled: boolean) => void;
};

type SceneOptions = {
  area: NeighborhoodArea;
  areaOrigin: WorldPoint;
  bounds: { x: number; y: number; width: number; height: number };
  selfSessionId: string;
  homeTypeId: string | null;
  playersRef: { current: readonly NeighborhoodPlayerView[] };
  onReady: () => void;
  onScene: (scene: PhaserNeighborhoodHandle) => void;
};

type ScreenPoint = { x: number; y: number };
type PlayerSprite = {
  sprite: Phaser.GameObjects.Sprite;
  textureKey: string | null;
  animationState: AvatarAnimationState;
  lastX: number;
  lastY: number;
};

function projectedRect(x: number, y: number, width: number, height: number) {
  return [
    project(x, y),
    project(x + width, y),
    project(x + width, y + height),
    project(x, y + height),
  ];
}

function fillPolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly ScreenPoint[],
  color: number,
  alpha = 1,
) {
  graphics.fillStyle(color, alpha);
  graphics.fillPoints(
    points.map(({ x, y }) => new Phaser.Geom.Point(x, y)),
    true,
  );
}

function appearanceFromJson(value: string): Appearance {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    const appearance: Appearance = {};
    for (const key of [
      "skin",
      "hair",
      "hairColor",
      "outfit",
      "bottoms",
      "shoes",
      "headwear",
    ] as const) {
      if (typeof record[key] === "number") appearance[key] = record[key];
    }
    return appearance;
  } catch {
    return {};
  }
}

function equipmentFromJson(value: string): AvatarEquipment[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) =>
      item && typeof item === "object" && "slot" in item && typeof item.slot === "string"
        ? [{ slot: item.slot }]
        : [],
    );
  } catch {
    return [];
  }
}

function areaBounds(origin: WorldPoint) {
  const { left, top, width, height } = neighborhoodSceneBounds(origin);
  const corners = [
    project(left, top),
    project(left + width, top),
    project(left + width, top + height),
    project(left, top + height),
  ];
  return {
    x: Math.min(...corners.map((point) => point.x)) - 120,
    y: Math.min(...corners.map((point) => point.y)) - 140,
    width:
      Math.max(...corners.map((point) => point.x)) -
      Math.min(...corners.map((point) => point.x)) +
      240,
    height:
      Math.max(...corners.map((point) => point.y)) -
      Math.min(...corners.map((point) => point.y)) +
      280,
  };
}

class PhaserNeighborhoodScene extends Phaser.Scene implements PhaserNeighborhoodHandle {
  private readonly area: NeighborhoodArea;
  private readonly areaOrigin: WorldPoint;
  private readonly bounds: SceneOptions["bounds"];
  private readonly selfSessionId: SceneOptions["selfSessionId"];
  private readonly homeTypeId: SceneOptions["homeTypeId"];
  private readonly playersRef: SceneOptions["playersRef"];
  private readonly onReady: SceneOptions["onReady"];
  private readonly onScene: SceneOptions["onScene"];
  private readonly playerSprites = new Map<string, PlayerSprite>();
  private followEnabled = true;

  constructor(options: SceneOptions) {
    super({ key: "olaiya-playable-neighborhood" });
    this.area = options.area;
    this.areaOrigin = options.areaOrigin;
    this.bounds = options.bounds;
    this.selfSessionId = options.selfSessionId;
    this.homeTypeId = options.homeTypeId;
    this.playersRef = options.playersRef;
    this.onReady = options.onReady;
    this.onScene = options.onScene;
  }

  preload() {
    for (const asset of NEIGHBORHOOD_ART_ASSETS) {
      this.load.svg(asset.key, asset.path, { width: asset.width, height: asset.height });
    }
  }

  create() {
    this.cameras.main.setBounds(
      this.bounds.x,
      this.bounds.y,
      this.bounds.width,
      this.bounds.height,
    );
    this.cameras.main.setZoom(0.65);
    this.createFallbackTexture();
    this.drawGroundAndRoads();
    this.drawBuildings();
    this.drawObstacles();
    this.setPlayers(this.playersRef.current);
    this.onScene(this);
    this.onReady();
  }

  setPlayers(players: readonly NeighborhoodPlayerView[]) {
    const active = new Set(players.map((player) => player.sessionId));
    for (const [sessionId, playerSprite] of this.playerSprites) {
      if (!active.has(sessionId)) {
        playerSprite.sprite.destroy();
        this.playerSprites.delete(sessionId);
      }
    }
    for (const player of players) this.updatePlayer(player);
  }

  setZoom(factor: number) {
    this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * factor, 0.42, 0.9));
  }

  setFollow(enabled: boolean) {
    this.followEnabled = enabled;
    if (!enabled) {
      this.cameras.main.stopFollow();
      return;
    }
    const self = this.playerSprites.get(this.selfSessionId);
    if (self) this.cameras.main.startFollow(self.sprite, true, 0.12, 0.12);
  }

  private createFallbackTexture() {
    if (this.textures.exists(DEFAULT_PLAYER_TEXTURE)) return;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x263e5c, 1).fillEllipse(24, 53, 24, 8);
    graphics.fillStyle(0xd0a47b, 1).fillCircle(24, 14, 8);
    graphics.fillStyle(0x2d805f, 1).fillRoundedRect(14, 23, 20, 23, 5);
    graphics.fillStyle(0x263e5c, 1).fillRoundedRect(15, 44, 8, 11, 3);
    graphics.fillStyle(0x263e5c, 1).fillRoundedRect(25, 44, 8, 11, 3);
    graphics.generateTexture(DEFAULT_PLAYER_TEXTURE, 48, 60);
    graphics.destroy();
  }

  private updatePlayer(player: NeighborhoodPlayerView) {
    const point = toScene({ x: player.x, y: player.y }, this.areaOrigin);
    const screen = project(point.x, point.y);
    let record = this.playerSprites.get(player.sessionId);
    if (!record) {
      const sprite = this.add
        .sprite(screen.x, screen.y, DEFAULT_PLAYER_TEXTURE)
        .setOrigin(0.5, 0.94)
        .setScale(0.9)
        .setDepth(neighborhoodDepth(point.x, point.y, 1));
      record = {
        sprite,
        textureKey: null,
        animationState: "idle",
        lastX: point.x,
        lastY: point.y,
      };
      this.playerSprites.set(player.sessionId, record);
      if (this.followEnabled && player.sessionId === this.selfSessionId)
        this.cameras.main.startFollow(sprite, true, 0.12, 0.12);
    }

    const moving = Math.hypot(point.x - record.lastX, point.y - record.lastY) > 0.002;
    record.lastX = point.x;
    record.lastY = point.y;
    record.sprite.setPosition(screen.x, screen.y).setDepth(neighborhoodDepth(point.x, point.y, 1));
    const facing = this.facingFor(player.facing);
    record.sprite.setFlipX(facing === "west");
    record.animationState = moving ? "walk" : (player.actionAnimation ?? "idle");

    const appearance = appearanceFromJson(player.appearance);
    const equipment = equipmentFromJson(player.equipment);
    const textureKey = `${player.gender}-${equipment
      .map(({ slot }) => slot)
      .sort()
      .join("-")}-${JSON.stringify(appearance)}`;
    if (record.textureKey !== textureKey) {
      record.textureKey = textureKey;
      void ensureAvatarTexture(this, appearance, player.gender, equipment).then((registered) => {
        const current = this.playerSprites.get(player.sessionId);
        if (!registered || current !== record || current.textureKey !== textureKey) return;
        current.sprite.setTexture(registered);
        this.playAvatarAnimation(current.sprite, registered, facing, current.animationState);
      });
    } else if (record.sprite.texture.key !== DEFAULT_PLAYER_TEXTURE) {
      this.playAvatarAnimation(
        record.sprite,
        record.sprite.texture.key,
        facing,
        record.animationState,
      );
    }
  }

  private facingFor(value: string): AvatarFacing {
    return value === "west" || value === "east" || value === "north" ? value : "south";
  }

  private playAvatarAnimation(
    sprite: Phaser.GameObjects.Sprite,
    textureKey: string,
    facing: AvatarFacing,
    state: AvatarAnimationState,
  ) {
    const animationFacing = facing === "west" ? "east" : facing;
    const direction = AVATAR_DIRECTIONS.includes(
      animationFacing as (typeof AVATAR_DIRECTIONS)[number],
    )
      ? animationFacing
      : "south";
    const animation = avatarAnimationKey(textureKey, state, direction);
    if (this.anims.exists(animation) && sprite.anims.currentAnim?.key !== animation)
      sprite.play(animation);
  }

  private drawGroundAndRoads() {
    const graphics = this.add.graphics().setDepth(-100_000);
    const { left, top, width, height } = neighborhoodSceneBounds(this.areaOrigin);
    const right = left + width;
    const bottom = top + height;
    const groundColors =
      this.area.slug === "oja-oba"
        ? [0xbda777, 0xc5b084, 0xc0aa7c, 0xc9b58b]
        : this.area.slug === "city-centre"
          ? [0x9cae79, 0xa5b681, 0x98aa75, 0xaab987]
          : [
              this.area.style.ground,
              this.area.style.paving,
              this.area.style.ground,
              this.area.style.grid,
            ];

    for (let x = left; x < right; x += TILE_SIZE) {
      for (let y = top; y < bottom; y += TILE_SIZE) {
        const tileX = Math.floor((x - left) / TILE_SIZE);
        const tileY = Math.floor((y - top) / TILE_SIZE);
        const color = groundColors[(tileX * 7 + tileY * 11) % groundColors.length]!;
        fillPolygon(graphics, projectedRect(x, y, TILE_SIZE, TILE_SIZE), color);
        graphics.lineStyle(1, 0x71835f, 0.17);
        graphics.strokePoints(
          projectedRect(x, y, TILE_SIZE, TILE_SIZE).map(
            ({ x: pointX, y: pointY }) => new Phaser.Geom.Point(pointX, pointY),
          ),
          true,
        );
        if ((tileX + tileY) % 4 === 0) {
          const point = project(x + 24, y + 46);
          graphics.fillStyle(0x71835f, 0.32).fillCircle(point.x, point.y, 1.5);
        }
      }
    }

    const roads = this.area.roads ?? [
      {
        id: "main-vertical",
        axis: "vertical",
        offset: this.area.style.verticalRoad.x,
        width: this.area.style.verticalRoad.width,
        type: "arterial",
      },
      {
        id: "main-horizontal",
        axis: "horizontal",
        offset: this.area.style.horizontalRoad.y,
        width: this.area.style.horizontalRoad.height,
        type: "arterial",
      },
    ];
    for (const road of roads) this.drawRoad(graphics, road, left, top, right, bottom);
    for (const path of this.area.paths ?? []) this.drawPath(graphics, path);
    this.drawCrosswalk(graphics, this.area.roads ?? [], left, top, right, bottom);
  }

  private drawPath(graphics: Phaser.GameObjects.Graphics, path: NeighborhoodPath) {
    const start = project(path.from.x, path.from.y);
    const end = project(path.to.x, path.to.y);
    graphics.lineStyle(path.width + 4, 0x766f59, 0.72).lineBetween(start.x, start.y, end.x, end.y);
    graphics.lineStyle(path.width, 0xd7c9a6, 1).lineBetween(start.x, start.y, end.x, end.y);
  }

  private drawRoad(
    graphics: Phaser.GameObjects.Graphics,
    road: NeighborhoodRoad,
    left: number,
    top: number,
    right: number,
    bottom: number,
  ) {
    const vertical = road.axis === "vertical";
    const start = Math.max(vertical ? top : left, road.start ?? (vertical ? top : left));
    const end = Math.min(vertical ? bottom : right, road.end ?? (vertical ? bottom : right));
    if (end <= start) return;
    const sidewalkWidth = road.type === "arterial" ? 16 : 12;
    for (const side of [-1, 1]) {
      const sidewalkOffset = road.offset + side * (road.width / 2 + sidewalkWidth / 2);
      const sidewalkRect = vertical
        ? projectedRect(sidewalkOffset - sidewalkWidth / 2, start, sidewalkWidth, end - start)
        : projectedRect(start, sidewalkOffset - sidewalkWidth / 2, end - start, sidewalkWidth);
      fillPolygon(graphics, sidewalkRect, 0xd7c9a6);
      graphics.lineStyle(1.5, 0x766f59, 0.56);
      const points = sidewalkRect.map(({ x, y }) => new Phaser.Geom.Point(x, y));
      graphics.strokePoints(points, true);
    }

    const roadRect = vertical
      ? projectedRect(road.offset - road.width / 2, start, road.width, end - start)
      : projectedRect(start, road.offset - road.width / 2, end - start, road.width);
    fillPolygon(graphics, roadRect, road.type === "arterial" ? 0x666d68 : 0x777872);
    const roadPoints = roadRect.map(({ x, y }) => new Phaser.Geom.Point(x, y));
    graphics.lineStyle(2, 0x424945, 0.82).strokePoints(roadPoints, true);

    for (const side of [-1, 1]) {
      const edgeOffset = road.offset + side * (road.width / 2 - 4);
      const edgeStart = project(vertical ? edgeOffset : start, vertical ? start : edgeOffset);
      const edgeEnd = project(vertical ? edgeOffset : end, vertical ? end : edgeOffset);
      graphics
        .lineStyle(2, 0xd1c19b, 0.7)
        .lineBetween(edgeStart.x, edgeStart.y, edgeEnd.x, edgeEnd.y);
    }

    if (road.type === "arterial") {
      for (let position = start + 40; position < end; position += 112) {
        const first = vertical ? project(road.offset, position) : project(position, road.offset);
        const second = vertical
          ? project(road.offset, position + 40)
          : project(position + 40, road.offset);
        graphics.lineStyle(3, 0xf0dda0, 0.76).lineBetween(first.x, first.y, second.x, second.y);
      }
    }
  }

  private drawCrosswalk(
    graphics: Phaser.GameObjects.Graphics,
    roads: readonly NeighborhoodRoad[],
    left: number,
    top: number,
    right: number,
    bottom: number,
  ) {
    const verticals = roads.filter((road) => road.axis === "vertical" && road.type === "arterial");
    const horizontals = roads.filter(
      (road) => road.axis === "horizontal" && road.type === "arterial",
    );
    for (const vertical of verticals) {
      for (const horizontal of horizontals) {
        for (let x = -vertical.width / 2 + 8; x < vertical.width / 2 - 8; x += 16) {
          const points = projectedRect(vertical.offset + x, horizontal.offset - 20, 8, 40);
          fillPolygon(graphics, points, 0xe7e2ca, 0.75);
        }
      }
    }
    const boundary = [
      project(left, top),
      project(right, top),
      project(right, bottom),
      project(left, bottom),
    ];
    graphics.lineStyle(2, 0x647451, 0.8).strokePoints(
      boundary.map(({ x, y }) => new Phaser.Geom.Point(x, y)),
      true,
    );
  }

  private drawBuildings() {
    for (const object of this.area.objects) {
      if (object.kind === "npc") {
        this.drawNeighbour(object);
        continue;
      }
      const kind = object.kind === "home" ? "compound" : object.kind === "market" ? "shop" : "shop";
      const label =
        object.kind === "home"
          ? this.homeTypeId
            ? `YOUR ${this.homeTypeId.replaceAll("-", " ").toUpperCase()}`
            : this.area.slug === "oja-oba"
              ? "MARKET COURTYARD"
              : "OLAIYA COMPOUND"
          : object.kind === "market"
            ? this.area.slug === "oja-oba"
              ? "OJA-OBA STALLS"
              : "NEIGHBOURHOOD SHOP"
            : this.area.slug === "oja-oba"
              ? "LOADING YARD"
              : "WORK & SERVICES";
      const footprint = neighborhoodBuildingFootprint(object);
      this.drawBuilding(
        object.x,
        footprint.top + footprint.height / 2,
        kind,
        label,
        this.area.slug === "oja-oba" ? "" : object.name,
        footprint.width,
        footprint.height,
        47,
      );
    }
    for (const obstacle of this.area.obstacles ?? []) {
      if (obstacle.kind !== "compound" && obstacle.kind !== "shop" && obstacle.kind !== "kiosk")
        continue;
      const label =
        obstacle.kind === "kiosk" ? "KIOSK" : obstacle.kind === "shop" ? "LOCAL SHOP" : "HOME";
      this.drawBuilding(
        obstacle.x,
        obstacle.y,
        obstacle.kind,
        this.area.slug === "oja-oba" && obstacle.kind === "kiosk"
          ? obstacle.id.endsWith("centre")
            ? "PRODUCE ROW"
            : ""
          : label,
        this.area.slug === "oja-oba" ? "" : obstacle.id.replaceAll("-", " "),
        obstacle.width,
        obstacle.height,
        obstacle.kind === "kiosk" ? 28 : 38,
      );
    }
  }

  private drawBuilding(
    x: number,
    y: number,
    kind: "compound" | "shop" | "kiosk",
    sign: string,
    name: string,
    width: number,
    depth: number,
    wallHeight: number,
  ) {
    const container = this.add
      .container(project(x, y).x, project(x, y).y)
      .setDepth(neighborhoodDepth(x, y + depth / 2));
    const graphics = this.add.graphics();
    const localProject = (dx: number, dy: number, lift = 0) => {
      const point = project(x + dx, y + dy);
      const anchor = project(x, y);
      return { x: point.x - anchor.x, y: point.y - anchor.y - lift };
    };
    const corners = [
      localProject(-width / 2, -depth / 2),
      localProject(width / 2, -depth / 2),
      localProject(width / 2, depth / 2),
      localProject(-width / 2, depth / 2),
    ];
    const roof = corners.map((point) => ({ x: point.x, y: point.y - wallHeight }));
    // Ground-contact shadow stays separate from the solid footprint.
    fillPolygon(
      graphics,
      corners.map((point) => ({ x: point.x + 9, y: point.y + 7 })),
      0x334135,
      0.2,
    );
    fillPolygon(graphics, [corners[1]!, corners[2]!, roof[2]!, roof[1]!], 0x9c6a48);
    fillPolygon(graphics, [corners[2]!, corners[3]!, roof[3]!, roof[2]!], 0xb47c55);
    const roofColor = kind === "compound" ? 0xa94e35 : kind === "kiosk" ? 0x3c755d : 0x355d78;
    fillPolygon(graphics, roof, roofColor);
    // Restrained metal-roof seams share the same projection as the building.
    for (let rib = -width / 2 + 12; rib < width / 2; rib += 12) {
      const from = localProject(rib, -depth / 2, wallHeight);
      const to = localProject(rib, depth / 2, wallHeight);
      graphics.lineStyle(1, 0xffffff, 0.14).lineBetween(from.x, from.y, to.x, to.y);
    }
    graphics.lineStyle(2, 0x533e32, 0.88);
    graphics.strokePoints(
      roof.map(({ x: pointX, y: pointY }) => new Phaser.Geom.Point(pointX, pointY)),
      true,
    );

    const frontCenter = localProject(0, depth / 2);
    graphics.fillStyle(kind === "compound" ? 0x29496c : 0x5b412f, 1);
    graphics.fillRoundedRect(frontCenter.x - 6, frontCenter.y - 28, 12, 27, 2);
    if (kind !== "kiosk") {
      graphics.fillStyle(0x9ac4bf, 1);
      graphics.fillRect(frontCenter.x - width * 0.29, frontCenter.y - wallHeight + 10, 13, 11);
      graphics.fillRect(frontCenter.x + width * 0.17, frontCenter.y - wallHeight + 10, 13, 11);
      graphics.lineStyle(2, 0xe1c38a, 1);
      graphics.lineBetween(
        frontCenter.x - width * 0.29,
        frontCenter.y - wallHeight + 15,
        frontCenter.x - width * 0.29 + 13,
        frontCenter.y - wallHeight + 15,
      );
    }
    if (kind === "shop" || kind === "kiosk") {
      const awningY = frontCenter.y - wallHeight + 31;
      graphics.fillStyle(0xe4c26c, 1).fillRect(-width * 0.34, awningY, width * 0.68, 8);
      graphics.fillStyle(0x315e4b, 1).fillRect(-width * 0.29, awningY + 8, width * 0.58, 12);
    }
    const buildingArt = NEIGHBORHOOD_BUILDING_ART[kind];
    if (this.textures.exists(buildingArt.key)) {
      graphics.destroy();
      container.add(
        this.add
          .image(0, 0, buildingArt.key)
          .setOrigin(buildingArt.originX, buildingArt.originY)
          .setScale(buildingArt.scale),
      );
    } else {
      container.add(graphics);
    }
    const title = this.add
      .text(0, -wallHeight - 22, sign, {
        color: "#fff8e9",
        backgroundColor: "#34473a",
        fontFamily: "system-ui, sans-serif",
        fontSize: kind === "kiosk" ? "8px" : "9px",
        fontStyle: "700",
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5, 1);
    const detail = this.add
      .text(0, -wallHeight - 5, name, {
        color: "#263c31",
        fontFamily: "system-ui, sans-serif",
        fontSize: "9px",
        fontStyle: "600",
        stroke: "#f7eacf",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1);
    container.add([title, detail]);
    title.setVisible(Boolean(sign));
    detail.setVisible(Boolean(name));
  }

  private drawObstacles() {
    for (const obstacle of this.area.obstacles ?? []) {
      if (obstacle.kind === "compound" || obstacle.kind === "shop" || obstacle.kind === "kiosk")
        continue;
      const anchor = project(obstacle.x, obstacle.y);
      const container = this.add
        .container(anchor.x, anchor.y)
        .setDepth(neighborhoodDepth(obstacle.x, obstacle.y));
      const graphics = this.add.graphics();
      const propKind = neighborhoodPropArtKind(obstacle.kind);
      const propArt = propKind ? NEIGHBORHOOD_PROP_ART[propKind] : null;
      if (propArt && this.textures.exists(propArt.key)) {
        container.add(
          this.add
            .image(0, 0, propArt.key)
            .setOrigin(propArt.originX, propArt.originY)
            .setScale(propArt.scale),
        );
        graphics.destroy();
      } else if (obstacle.kind === "tree") {
        graphics.fillStyle(0x3f4b34, 0.22).fillEllipse(0, 0, 34, 12);
        graphics.fillStyle(0x795b3b, 1).fillRect(-4, -26, 8, 27);
        graphics.fillStyle(0x426e48, 1).fillCircle(0, -35, 18);
        graphics.fillStyle(0x668d50, 1).fillCircle(-9, -42, 13);
        graphics.fillStyle(0x7d9954, 1).fillCircle(9, -43, 12);
        graphics.fillStyle(0x9ba45d, 0.85).fillCircle(1, -51, 8);
      } else if (obstacle.kind === "streetlight") {
        graphics.fillStyle(0x35413a, 0.2).fillEllipse(0, 0, 20, 8);
        graphics.fillStyle(0x46534a, 1).fillRect(-2, -34, 4, 35);
        graphics.fillStyle(0x35413a, 1).fillRect(-2, -35, 17, 3);
        graphics.fillStyle(0xffdf8a, 0.28).fillCircle(14, -32, 11);
        graphics.fillStyle(0xf8d77f, 1).fillCircle(14, -32, 4);
      } else if (obstacle.kind === "bench") {
        graphics.fillStyle(0x66513a, 1).fillRoundedRect(-21, -16, 42, 7, 2);
        graphics.fillStyle(0x876846, 1).fillRoundedRect(-21, -8, 42, 6, 2);
        graphics.fillStyle(0x3e4a3e, 1).fillRect(-16, -3, 4, 11);
        graphics.fillStyle(0x3e4a3e, 1).fillRect(12, -3, 4, 11);
      } else if (obstacle.kind === "bin") {
        graphics.fillStyle(0x3c6b59, 1).fillRoundedRect(-8, -20, 16, 22, 3);
        graphics.fillStyle(0x253e36, 1).fillRect(-10, -21, 20, 4);
        graphics.fillStyle(0x9cba94, 1).fillRect(-5, -14, 10, 2);
      } else {
        graphics.fillStyle(0x76513a, 1).fillRect(-2, -25, 4, 27);
        graphics.fillStyle(0xe8c878, 1).fillRoundedRect(-17, -34, 34, 15, 3);
        graphics.lineStyle(1, 0x785936, 1).strokeRoundedRect(-17, -34, 34, 15, 3);
        graphics.fillStyle(0x355948, 1).fillCircle(0, -27, 3);
      }
      if (graphics.active) container.add(graphics);
      if (obstacle.kind === "landmark" && obstacle.label) {
        container.add(
          this.add
            .text(0, -48, obstacle.label, {
              color: "#263c31",
              fontFamily: "system-ui, sans-serif",
              fontSize: "9px",
              fontStyle: "700",
              stroke: "#f7eacf",
              strokeThickness: 3,
            })
            .setOrigin(0.5, 1),
        );
      }
    }
  }

  private drawNeighbour(object: NeighborhoodObject) {
    const screen = project(object.x, object.y);
    const graphics = this.add.graphics().setDepth(neighborhoodDepth(object.x, object.y, 2));
    graphics.fillStyle(0x324033, 0.2).fillEllipse(screen.x, screen.y, 25, 9);
    graphics.fillStyle(0xd6a87c, 1).fillCircle(screen.x, screen.y - 25, 8);
    graphics.fillStyle(0x2f7156, 1).fillRoundedRect(screen.x - 8, screen.y - 17, 16, 23, 5);
    graphics.fillStyle(0x273b58, 1).fillRect(screen.x - 7, screen.y + 3, 6, 12);
    graphics.fillStyle(0x273b58, 1).fillRect(screen.x + 1, screen.y + 3, 6, 12);
    this.add
      .text(screen.x, screen.y - 54, object.name, {
        color: "#263c31",
        fontFamily: "system-ui, sans-serif",
        fontSize: "10px",
        fontStyle: "600",
        stroke: "#f7eacf",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(neighborhoodDepth(object.x, object.y, 3));
  }
}

export function createPhaserNeighborhood(options: {
  host: HTMLElement;
  area: NeighborhoodArea;
  areaOrigin?: WorldPoint;
  selfSessionId: string;
  homeTypeId: string | null;
  playersRef: { current: readonly NeighborhoodPlayerView[] };
  onReady: () => void;
  onScene: (scene: PhaserNeighborhoodHandle) => void;
}) {
  const areaOrigin =
    options.areaOrigin ?? neighborhoodAreaOrigin(cityEntranceForLocation(options.area.slug));
  const bounds = areaBounds(areaOrigin);
  const scene = new PhaserNeighborhoodScene({ ...options, bounds, areaOrigin });
  return new Phaser.Game({
    type: Phaser.CANVAS,
    parent: options.host,
    width: options.host.clientWidth || 900,
    height: options.host.clientHeight || 600,
    // Phaser can reuse a Canvas previously styled by the overview's FIT scaler.
    canvasStyle: "display:block;width:100%;height:100%;margin:0;",
    backgroundColor: options.area.slug === "oja-oba" ? "#c5b084" : "#9cae79",
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: options.host.clientWidth || 900,
      height: options.host.clientHeight || 600,
    },
    scene,
  });
}
