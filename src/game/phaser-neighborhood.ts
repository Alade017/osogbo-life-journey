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
  NEIGHBORHOOD_BUILDING_PROFILES,
  NEIGHBORHOOD_PROP_PROFILES,
  neighborhoodPropKind,
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
    // Every neighborhood supplies its own palette; the renderer never branches
    // on a location slug or embeds location-specific ground colors.
    const groundColors = [
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
      const kind = object.kind === "home" ? "compound" : "shop";
      const sign =
        object.kind === "home" && this.homeTypeId
          ? `YOUR ${this.homeTypeId.replaceAll("-", " ").toUpperCase()}`
          : object.name;
      const footprint = neighborhoodBuildingFootprint(object);
      this.drawBuilding(
        object.x,
        footprint.top + footprint.height / 2,
        kind,
        sign,
        object.name,
        footprint.width,
        footprint.height,
      );
    }

    for (const obstacle of this.area.obstacles ?? []) {
      if (obstacle.kind !== "compound" && obstacle.kind !== "shop" && obstacle.kind !== "kiosk")
        continue;
      const sign = obstacle.label ?? obstacle.id.replaceAll("-", " ");
      this.drawBuilding(
        obstacle.x,
        obstacle.y,
        obstacle.kind,
        sign,
        obstacle.label ?? "",
        obstacle.width,
        obstacle.height,
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
  ) {
    const profile = NEIGHBORHOOD_BUILDING_PROFILES[kind];
    const anchor = project(x, y);
    const container = this.add
      .container(anchor.x, anchor.y)
      .setDepth(neighborhoodDepth(x, y + depth / 2));
    const graphics = this.add.graphics();
    const localProject = (dx: number, dy: number, lift = 0) => {
      const point = project(x + dx, y + dy);
      return { x: point.x - anchor.x, y: point.y - anchor.y - lift };
    };
    const wallHeight = Math.max(16, Math.min(width, depth) * profile.wallHeightRatio);
    const overhang = Math.min(width, depth) * profile.roofOverhangRatio;
    const corners = [
      localProject(-width / 2, -depth / 2),
      localProject(width / 2, -depth / 2),
      localProject(width / 2, depth / 2),
      localProject(-width / 2, depth / 2),
    ];
    const roof = [
      localProject(-width / 2 - overhang, -depth / 2 - overhang, wallHeight),
      localProject(width / 2 + overhang, -depth / 2 - overhang, wallHeight),
      localProject(width / 2 + overhang, depth / 2 + overhang, wallHeight),
      localProject(-width / 2 - overhang, depth / 2 + overhang, wallHeight),
    ];

    fillPolygon(
      graphics,
      corners.map((point) => ({ x: point.x + overhang * 0.35, y: point.y + overhang * 0.25 })),
      0x334135,
      0.2,
    );
    fillPolygon(graphics, [corners[1]!, corners[2]!, { ...roof[2]! }, { ...roof[1]! }], profile.wallColors[1]);
    fillPolygon(graphics, [corners[2]!, corners[3]!, { ...roof[3]! }, { ...roof[2]! }], profile.wallColors[0]);

    const ribSpacing = Math.max(5, Math.min(width, depth) * profile.roofRibSpacingRatio);
    for (let rib = -width / 2; rib <= width / 2; rib += ribSpacing) {
      const from = localProject(rib, -depth / 2 - overhang, wallHeight);
      const to = localProject(rib, depth / 2 + overhang, wallHeight);
      graphics.lineStyle(1, profile.trimColor, 0.2).lineBetween(from.x, from.y, to.x, to.y);
    }
    fillPolygon(graphics, roof, profile.roofColor);
    graphics.lineStyle(2, 0x533e32, 0.86);
    graphics.strokePoints(
      roof.map(({ x: pointX, y: pointY }) => new Phaser.Geom.Point(pointX, pointY)),
      true,
    );

    const frontage = localProject(0, depth / 2);
    const doorWidth = Math.max(5, Math.min(width * 0.15, depth * 0.34));
    const doorHeight = wallHeight * 0.66;
    graphics.fillStyle(profile.doorColor, 1);
    graphics.fillRoundedRect(
      frontage.x - doorWidth / 2,
      frontage.y - doorHeight,
      doorWidth,
      doorHeight,
      Math.max(1, doorWidth * 0.12),
    );
    graphics.fillStyle(profile.trimColor, 0.8);
    graphics.fillRect(frontage.x + doorWidth * 0.18, frontage.y - doorHeight * 0.52, 2, 2);

    const windowWidth = Math.max(5, Math.min(width * 0.13, depth * 0.3));
    const windowHeight = Math.max(5, wallHeight * 0.23);
    const windowSpacing = width / (profile.windowCount + 1);
    for (let index = 0; index < profile.windowCount; index += 1) {
      const offset = (index - (profile.windowCount - 1) / 2) * windowSpacing;
      const windowX = frontage.x + offset * 0.48;
      const windowY = frontage.y - wallHeight * 0.67;
      graphics.fillStyle(profile.trimColor, 1);
      graphics.fillRect(
        windowX - windowWidth / 2 - 2,
        windowY - windowHeight / 2 - 2,
        windowWidth + 4,
        windowHeight + 4,
      );
      graphics.fillStyle(profile.windowColor, 1);
      graphics.fillRect(
        windowX - windowWidth / 2,
        windowY - windowHeight / 2,
        windowWidth,
        windowHeight,
      );
      graphics.lineStyle(1, profile.trimColor, 0.9);
      graphics.lineBetween(windowX, windowY - windowHeight / 2, windowX, windowY + windowHeight / 2);
      graphics.lineBetween(windowX - windowWidth / 2, windowY, windowX + windowWidth / 2, windowY);
    }

    if (profile.frontage === "awning" && profile.awningColor !== undefined) {
      const awningY = frontage.y - wallHeight * 0.43;
      const awningWidth = width * 0.7;
      graphics.fillStyle(profile.awningColor, 1);
      graphics.fillRect(frontage.x - awningWidth / 2, awningY, awningWidth, Math.max(4, depth * 0.08));
      graphics.fillStyle(profile.trimColor, 0.92);
      graphics.fillRect(frontage.x - awningWidth / 2, awningY + Math.max(4, depth * 0.08), awningWidth, 2);
    } else if (profile.frontage === "veranda") {
      const verandaWidth = width * 0.72;
      const verandaY = frontage.y - wallHeight * 0.38;
      graphics.fillStyle(profile.trimColor, 1);
      graphics.fillRect(frontage.x - verandaWidth / 2, verandaY, verandaWidth, Math.max(3, depth * 0.06));
      for (const side of [-1, 1]) {
        graphics.fillRect(
          frontage.x + side * verandaWidth * 0.42 - 1.5,
          verandaY,
          3,
          wallHeight * 0.34,
        );
      }
    } else {
      graphics.lineStyle(2, profile.trimColor, 0.8);
      graphics.lineBetween(frontage.x - doorWidth * 0.85, frontage.y, frontage.x + doorWidth * 0.85, frontage.y);
    }

    container.add(graphics);
    const title = this.add
      .text(0, -wallHeight - overhang - 18, sign, {
        color: "#fff8e9",
        backgroundColor: "#34473a",
        fontFamily: "system-ui, sans-serif",
        fontSize: kind === "kiosk" ? "8px" : "9px",
        fontStyle: "700",
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5, 1);
    const detail = this.add
      .text(0, -wallHeight - overhang - 2, name, {
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
      const profileKind = neighborhoodPropKind(obstacle.kind);
      if (!profileKind) continue;
      const profile = NEIGHBORHOOD_PROP_PROFILES[profileKind];
      const anchor = project(obstacle.x, obstacle.y);
      const container = this.add
        .container(anchor.x, anchor.y)
        .setDepth(neighborhoodDepth(obstacle.x, obstacle.y));
      const graphics = this.add.graphics();
      const width = Math.max(8, obstacle.width * profile.widthRatio);
      const height = Math.max(10, obstacle.height * profile.heightRatio);
      const [baseColor, detailColor, highlightColor, accentColor] = profile.colors;

      graphics.fillStyle(0x334135, 0.16).fillEllipse(0, 0, width * 0.82, Math.max(3, height * 0.09));
      if (profile.shape === "canopy") {
        const trunkWidth = width * 0.13;
        const trunkHeight = height * 0.48;
        graphics.fillStyle(baseColor!, 1).fillRoundedRect(
          -trunkWidth / 2,
          -trunkHeight * 0.08,
          trunkWidth,
          trunkHeight,
          trunkWidth * 0.2,
        );
        graphics.fillStyle(detailColor!, 1).fillCircle(0, -height * 0.66, width * 0.31);
        graphics.fillStyle(highlightColor!, 1).fillCircle(-width * 0.2, -height * 0.7, width * 0.22);
        graphics.fillStyle(accentColor!, 0.9).fillCircle(width * 0.2, -height * 0.72, width * 0.2);
      } else if (profile.shape === "lamp") {
        const poleWidth = Math.max(2, width * 0.1);
        const poleHeight = height * 0.82;
        graphics.fillStyle(baseColor!, 1).fillRect(-poleWidth / 2, -poleHeight, poleWidth, poleHeight);
        graphics.fillStyle(detailColor!, 1).fillRect(-poleWidth / 2, -poleHeight, width * 0.42, poleWidth * 1.1);
        graphics.fillStyle(highlightColor!, 0.24).fillCircle(width * 0.32, -poleHeight, width * 0.2);
        graphics.fillStyle(highlightColor!, 1).fillCircle(width * 0.32, -poleHeight, Math.max(2, poleWidth * 1.1));
      } else if (profile.shape === "bench") {
        const seatHeight = height * 0.18;
        graphics.fillStyle(baseColor!, 1).fillRoundedRect(
          -width / 2,
          -height * 0.48,
          width,
          seatHeight,
          Math.max(1, seatHeight * 0.2),
        );
        graphics.fillStyle(detailColor!, 1).fillRoundedRect(
          -width / 2,
          -height * 0.68,
          width,
          seatHeight * 0.72,
          Math.max(1, seatHeight * 0.2),
        );
        graphics.fillStyle(highlightColor!, 1);
        for (const side of [-1, 1]) {
          graphics.fillRect(side * width * 0.34, -height * 0.3, Math.max(2, width * 0.06), height * 0.28);
        }
      } else if (profile.shape === "bin") {
        graphics.fillStyle(baseColor!, 1).fillRoundedRect(
          -width * 0.34,
          -height * 0.78,
          width * 0.68,
          height * 0.72,
          Math.max(2, width * 0.08),
        );
        graphics.fillStyle(detailColor!, 1).fillRoundedRect(
          -width * 0.42,
          -height * 0.84,
          width * 0.84,
          height * 0.1,
          Math.max(1, width * 0.04),
        );
        graphics.fillStyle(highlightColor!, 0.9).fillRect(
          -width * 0.18,
          -height * 0.58,
          width * 0.36,
          Math.max(2, height * 0.05),
        );
      } else {
        const postWidth = Math.max(2, width * 0.07);
        graphics.fillStyle(baseColor!, 1).fillRect(-postWidth / 2, -height * 0.55, postWidth, height * 0.55);
        graphics.fillStyle(detailColor!, 1).fillRoundedRect(
          -width / 2,
          -height * 0.92,
          width,
          height * 0.34,
          Math.max(2, width * 0.06),
        );
        graphics.fillStyle(highlightColor!, 1).fillRoundedRect(
          -width * 0.42,
          -height * 0.86,
          width * 0.84,
          height * 0.22,
          Math.max(1, width * 0.04),
        );
        graphics.fillStyle(accentColor ?? 0xf2e4c8, 1).fillRect(
          -width * 0.25,
          -height * 0.77,
          width * 0.5,
          Math.max(2, height * 0.04),
        );
      }
      container.add(graphics);
      if ((obstacle.kind === "landmark" || obstacle.kind === "sign") && obstacle.label) {
        container.add(
          this.add
            .text(0, -height - 5, obstacle.label, {
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
    backgroundColor: options.area.style.ground,
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: options.host.clientWidth || 900,
      height: options.host.clientHeight || 600,
    },
    scene,
  });
}
