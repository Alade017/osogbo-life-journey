import * as Phaser from "phaser";
import townData from "@/data/osogbo-town.json";
import {
  projectTownCell,
  townDiamondPoints,
  TOWN_MAP_HEIGHT,
  TOWN_MAP_WIDTH,
} from "@/components/map/town-map-geometry";
import type {
  PhaserMapCallbacks,
  PhaserMapData,
  PhaserMapSceneHandle,
} from "@/components/map/PhaserMapSurface";

const tileColors: Record<string, number> = {
  g: 0x9bc58a,
  r: 0xc8b99d,
  w: 0x78b9d1,
  p: 0xd7c8a9,
};

const categoryColors: Record<string, number> = {
  market: 0xd08b36,
  transport: 0x6577b8,
  school: 0x7d63a5,
  health: 0xc94e55,
  worship: 0x8b7b62,
  junction: 0x506f99,
  sport: 0x4f946c,
  food: 0xb66e3c,
  services: 0x397d83,
};

type CreateOptions = {
  host: HTMLElement;
  dataRef: { current: PhaserMapData };
  callbacksRef: { current: PhaserMapCallbacks };
  onReady: () => void;
  onGame: (game: Phaser.Game, scene: PhaserTownMapScene) => void;
};

class PhaserTownMapScene extends Phaser.Scene implements PhaserMapSceneHandle {
  private readonly dataRef: CreateOptions["dataRef"];
  private readonly callbacksRef: CreateOptions["callbacksRef"];
  private readonly onReady: () => void;
  private mapLayer!: Phaser.GameObjects.Container;
  private lastDragPoint: { x: number; y: number } | null = null;

  constructor(options: CreateOptions) {
    super({ key: "osogbo-town-map" });
    this.dataRef = options.dataRef;
    this.callbacksRef = options.callbacksRef;
    this.onReady = options.onReady;
  }

  create() {
    this.cameras.main.setBounds(0, 0, TOWN_MAP_WIDTH, TOWN_MAP_HEIGHT);
    this.cameras.main.centerOn(TOWN_MAP_WIDTH / 2, TOWN_MAP_HEIGHT / 2);
    this.mapLayer = this.add.container(0, 0);
    this.drawMap(this.dataRef.current);
    this.input.on(
      "wheel",
      (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
        this.setZoom(dy > 0 ? 1 / 1.12 : 1.12);
      },
    );
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.lastDragPoint = { x: pointer.x, y: pointer.y };
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !this.lastDragPoint) return;
      const dx = pointer.x - this.lastDragPoint.x;
      const dy = pointer.y - this.lastDragPoint.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) {
        this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
        this.cameras.main.scrollY -= dy / this.cameras.main.zoom;
      }
      this.lastDragPoint = { x: pointer.x, y: pointer.y };
    });
    this.input.on("pointerup", () => {
      this.lastDragPoint = null;
    });
    this.onReady();
  }

  drawMap(data: PhaserMapData) {
    if (!this.mapLayer) return;
    this.mapLayer.removeAll(true);
    const graphics = this.add.graphics();
    this.mapLayer.add(graphics);
    graphics.fillStyle(0xdce7dc, 1);
    graphics.fillRect(0, 0, TOWN_MAP_WIDTH, TOWN_MAP_HEIGHT);

    townData.grid.rows.forEach((row, z) => {
      [...row].forEach((cell, x) => {
        const points = townDiamondPoints(x, z).map(([px, py]) => new Phaser.Geom.Point(px, py));
        graphics.fillStyle(tileColors[cell] ?? tileColors["g"]!, 1);
        graphics.fillPoints(points, true);
        graphics.lineStyle(1, 0x688768, 0.22);
        graphics.strokePoints(points, true);
      });
    });

    townData.districts.forEach((district) => {
      const area = district.gridArea;
      const points = [
        projectTownCell(area.x, area.z),
        projectTownCell(area.x + area.width, area.z),
        projectTownCell(area.x + area.width, area.z + area.depth),
        projectTownCell(area.x, area.z + area.depth),
      ].map(({ x, y }) => new Phaser.Geom.Point(x, y));
      graphics.fillStyle(0xffffff, 0.08);
      graphics.fillPoints(points, true);
      graphics.lineStyle(2, 0x456b4e, 0.65);
      graphics.strokePoints(points, true);
      const center = projectTownCell(area.x + area.width / 2, area.z + area.depth / 2);
      this.addText(center.x, center.y, district.name, 12, 0x35513a);
      this.addZone(center.x, center.y, 100, 34, () =>
        this.callbacksRef.current.onSelectDistrict(district.id),
      );
    });

    townData.grid.buildings.forEach((building) => {
      const point = projectTownCell(building.x + 0.5, building.z + 0.5);
      graphics.fillStyle(0x946449, 1);
      graphics.fillTriangle(
        point.x - 9,
        point.y - 5,
        point.x,
        point.y - 13,
        point.x + 9,
        point.y - 5,
      );
      graphics.fillStyle(0xb78a63, 1);
      graphics.fillRect(point.x - 7, point.y - 5, 14, 11);
    });

    data.properties?.forEach((property) => {
      const point = projectTownCell(property.position[0] / 2 + 6.5, property.position[2] / 2 + 4.5);
      graphics.fillStyle(property.status === "overdue" ? 0xb42318 : 0x76513a, 1);
      graphics.fillTriangle(point.x - 9, point.y, point.x, point.y - 12, point.x + 9, point.y);
      graphics.fillStyle(0xf4e4c4, 1);
      graphics.fillRect(point.x - 6, point.y, 12, 8);
      this.addText(point.x + 16, point.y + 3, property.label ?? "Home", 10, 0x304030, 0);
    });

    const billboards = new Map(
      data.billboardMarkers.map((billboard) => [billboard.landmarkId, billboard]),
    );
    data.places.forEach((place) => {
      const point = projectTownCell(place.grid.x, place.grid.z);
      const color = categoryColors[place.category] ?? 0x397d83;
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(point.x, point.y - 8, 14);
      graphics.fillStyle(color, 1);
      graphics.fillCircle(point.x, point.y - 8, 10);
      this.addText(point.x, point.y + 14, place.label, 12, 0x25382a);
      this.addZone(point.x, point.y - 4, 104, 42, () =>
        this.callbacksRef.current.onSelectLandmark(place.id),
      );

      const billboard = billboards.get(place.id);
      if (billboard) {
        graphics.fillStyle(0x283b31, 1);
        graphics.fillCircle(point.x + 18, point.y - 22, 9);
        this.addText(point.x + 18, point.y - 22, String(billboard.count), 10, 0xffffff);
        this.addZone(point.x + 18, point.y - 22, 20, 20, () =>
          this.callbacksRef.current.onSelectBillboard?.(billboard.campaignId),
        );
      }
    });

    if (data.playerLocation) {
      const point = projectTownCell(data.playerLocation.x, data.playerLocation.y);
      graphics.lineStyle(4, 0xffffff, 1);
      graphics.fillStyle(0x2858a2, 1);
      graphics.fillCircle(point.x, point.y - 18, 12);
      graphics.strokeCircle(point.x, point.y - 18, 12);
      this.addText(point.x, point.y + 4, data.playerLocation.label ?? "You are here", 11, 0x173b6f);
    }
  }

  setZoom(factor: number) {
    this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * factor, 0.8, 2.4));
  }

  resetView() {
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(TOWN_MAP_WIDTH / 2, TOWN_MAP_HEIGHT / 2);
  }

  private addText(x: number, y: number, text: string, size: number, color: number, origin = 0.5) {
    const label = this.add
      .text(x, y, text, {
        color: `#${color.toString(16).padStart(6, "0")}`,
        fontFamily: "system-ui, sans-serif",
        fontSize: `${size}px`,
        fontStyle: "600",
        stroke: "#f7f8f2",
        strokeThickness: 3,
      })
      .setOrigin(origin, 0.5);
    this.mapLayer.add(label);
  }

  private addZone(x: number, y: number, width: number, height: number, activate: () => void) {
    const zone = this.add
      .zone(x, y, width, height)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", activate);
    this.mapLayer.add(zone);
  }
}

export function createPhaserTownMap(options: CreateOptions) {
  const scene = new PhaserTownMapScene(options);
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: options.host,
    width: TOWN_MAP_WIDTH,
    height: TOWN_MAP_HEIGHT,
    backgroundColor: "#dce7dc",
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: { activePointers: 3 },
    scene,
  });
  options.onGame(game, scene);
  return true;
}
