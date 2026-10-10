import * as Phaser from "phaser";
import {
  NEIGHBORHOOD_OBJECTS,
  NEIGHBORHOOD_SIZE,
  nearestInteraction,
  toScene,
  toWorld,
  validCheckpoint,
  type NeighborhoodObject,
  type WorldPoint,
} from "./neighborhood-model";
import type { NetworkPlayerSnapshot } from "./multiplayer-state";

export type NeighborhoodBridge = {
  origin: WorldPoint;
  spawn: WorldPoint;
  onNearby: (object: NeighborhoodObject | null) => void;
  onCheckpoint: (point: WorldPoint) => void;
  onInteract: (object: NeighborhoodObject) => void;
  saveCheckpoint: (point: WorldPoint) => Promise<boolean>;
  onMovementIntent: (input: { x: number; y: number }) => void;
};
export type MovementInput = "up" | "down" | "left" | "right";

class NeighborhoodScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private touch = new Set<MovementInput>();
  private destination: WorldPoint | null = null;
  private frozen = false;
  private moved = false;
  private nearby: NeighborhoodObject | null = null;
  private remoteActors = new Map<
    string,
    { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; target: WorldPoint }
  >();
  private localSessionId: string | null = null;
  private movementIntent = { x: 0, y: 0 };
  private lastIntentSentAt = 0;
  private authoritativeTarget: WorldPoint | null = null;
  constructor(private bridge: NeighborhoodBridge) {
    super("neighborhood");
  }

  create() {
    const { width, height } = NEIGHBORHOOD_SIZE;
    this.cameras.main.setBackgroundColor("#d8e6d0");
    const low = toScene({ x: 0, y: 0 }, this.bridge.origin);
    const high = toScene({ x: 14, y: 12 }, this.bridge.origin);
    const left = Math.max(12, low.x);
    const top = Math.max(12, low.y);
    this.physics.world.setBounds(
      left,
      top,
      Math.min(width - 12, high.x) - left,
      Math.min(height - 12, high.y) - top,
    );
    const ground = this.add.graphics();
    ground.fillStyle(0xe8eedf).fillRect(0, 0, width, height);
    ground.lineStyle(1, 0xd3dfcb, 0.7);
    for (let x = 0; x < width; x += 32) ground.lineBetween(x, 0, x, height);
    for (let y = 0; y < height; y += 32) ground.lineBetween(0, y, width, y);
    ground
      .fillStyle(0xbac6b4)
      .fillRoundedRect(278, 0, 84, height, 6)
      .fillRoundedRect(0, 260, width, 80, 6);
    ground.fillStyle(0xe8ddbd).fillRect(287, 0, 66, height).fillRect(0, 269, width, 62);
    ground.lineStyle(2, 0xfffaf0, 0.65);
    for (let y = 0; y < height; y += 40) ground.lineBetween(320, y, 320, y + 16);
    const solids = this.physics.add.staticGroup();
    for (const object of NEIGHBORHOOD_OBJECTS) {
      if (object.kind === "npc") {
        this.makePerson("neighbor", 0xdfa451, 0x784c32);
        this.add.sprite(object.x, object.y, "neighbor").setDepth(object.y);
        this.add
          .text(object.x, object.y - 35, "Bisi", {
            fontFamily: "sans-serif",
            fontSize: "12px",
            color: "#344638",
            backgroundColor: "#ffffff",
          })
          .setOrigin(0.5)
          .setPadding(5, 3)
          .setDepth(900);
        continue;
      }
      const art = this.add.graphics({ x: object.x - 60, y: object.y - 120 });
      art.fillStyle(0x617353, 0.15).fillEllipse(66, 126, 144, 30);
      art.fillStyle(0xe8d7bb).fillRect(6, 46, 104, 70);
      art.fillStyle(0xc8b18b).fillPoints(
        [
          { x: 110, y: 46 },
          { x: 126, y: 35 },
          { x: 126, y: 105 },
          { x: 110, y: 116 },
        ],
        true,
      );
      const roof =
        object.kind === "home" ? 0x46685b : object.kind === "market" ? 0xb97b43 : 0x647385;
      art.fillStyle(roof).fillPoints(
        [
          { x: 0, y: 47 },
          { x: 54, y: 12 },
          { x: 118, y: 43 },
          { x: 64, y: 76 },
        ],
        true,
      );
      art.lineStyle(2, 0x334d40, 0.6).strokeRect(6, 76, 104, 40);
      art.fillStyle(0x6e9b9d).fillRect(17, 81, 22, 18).fillRect(80, 81, 22, 18);
      art.fillStyle(0x564636).fillRect(50, 85, 23, 31);
      art.setDepth(object.y - 4);
      const solid = this.add.rectangle(object.x, object.y - 33, 114, 58, 0x000000, 0);
      solids.add(solid);
      this.add
        .text(object.x, object.y + 18, object.name, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#344638",
          backgroundColor: "#ffffff",
        })
        .setOrigin(0.5)
        .setPadding(6, 4)
        .setDepth(900);
    }
    for (const [x, y] of [
      [60, 75],
      [570, 65],
      [80, 485],
      [565, 500],
    ] as const) {
      const tree = this.add.graphics({ x, y });
      tree.fillStyle(0x617353, 0.15).fillEllipse(0, 9, 60, 20);
      tree.fillStyle(0x785c3d).fillRect(-5, -25, 10, 35);
      tree.fillStyle(0x4e7753).fillCircle(0, -38, 27);
      tree.fillStyle(0x74956a).fillCircle(-7, -48, 19).setDepth(y!);
    }
    this.makePerson("player", 0x176746, 0x855733);
    this.makePerson("player-step", 0x176746, 0x855733, true);
    this.anims.create({
      key: "walk",
      frames: [{ key: "player" }, { key: "player-step" }],
      frameRate: 8,
      repeat: -1,
    });
    const spawn = toScene(this.bridge.spawn, this.bridge.origin);
    this.player = this.physics.add.sprite(spawn.x, spawn.y, "player").setCollideWorldBounds(true);
    this.player.setSize(16, 12).setOffset(8, 30);
    this.physics.add.collider(this.player, solids, () => {
      this.destination = null;
    });
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E", false) as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.input.keyboard!.on("keydown-E", this.interact, this);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.frozen) this.destination = { x: pointer.worldX, y: pointer.worldY };
    });
    this.input.on("wheel", (_pointer: unknown, _objects: unknown, _dx: number, dy: number) =>
      this.zoom(dy > 0 ? -0.1 : 0.1),
    );
    this.cameras.main.setBounds(0, 0, width, height).startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.2);
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.touch.clear();
      for (const actor of this.remoteActors.values()) {
        actor.sprite.destroy();
        actor.label.destroy();
      }
      this.remoteActors.clear();
      this.bridge.onNearby(null);
    });
  }
  private makePerson(key: string, shirt: number, skin: number, step = false) {
    if (this.textures.exists(key)) return;
    const art = this.make.graphics({ x: 0, y: 0 });
    art.fillStyle(0x334d40, 0.2).fillEllipse(16, 38, 28, 10);
    art
      .fillStyle(0x344638)
      .fillRect(8, 29, 6, step ? 8 : 10)
      .fillRect(19, 29, 6, step ? 13 : 10);
    art.fillStyle(shirt).fillRoundedRect(5, 16, 23, 18, 5);
    art.fillStyle(skin).fillCircle(16, 11, 9);
    art.fillStyle(0x332a25).fillEllipse(16, 5, 19, 10);
    art.fillStyle(0x222222).fillCircle(13, 11, 1).fillCircle(20, 11, 1);
    art.generateTexture(key, 32, 44);
    art.destroy();
  }
  override update(time: number, delta: number) {
    if (!this.player) return;
    let x = 0;
    let y = 0;
    const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName ?? "");
    if (!this.frozen && !editing && !document.hidden && navigator.onLine) {
      x =
        Number(this.keys["D"]!.isDown || this.keys["RIGHT"]!.isDown || this.touch.has("right")) -
        Number(this.keys["A"]!.isDown || this.keys["LEFT"]!.isDown || this.touch.has("left"));
      y =
        Number(this.keys["S"]!.isDown || this.keys["DOWN"]!.isDown || this.touch.has("down")) -
        Number(this.keys["W"]!.isDown || this.keys["UP"]!.isDown || this.touch.has("up"));
      if (x || y) this.destination = null;
      else if (this.destination) {
        x = this.destination.x - this.player.x;
        y = this.destination.y - this.player.y;
        if (Math.hypot(x, y) < 8) {
          x = 0;
          y = 0;
          this.destination = null;
        }
      }
    }
    const length = Math.hypot(x, y);
    const intent = length ? { x: Math.sign(x), y: Math.sign(y) } : { x: 0, y: 0 };
    if (
      intent.x !== this.movementIntent.x ||
      intent.y !== this.movementIntent.y ||
      (length > 0 && time - this.lastIntentSentAt >= 100)
    ) {
      this.movementIntent = intent;
      this.lastIntentSentAt = time;
      this.bridge.onMovementIntent(intent);
    }
    this.player.setVelocity(length ? (x / length) * 110 : 0, length ? (y / length) * 110 : 0);
    this.player.setDepth(this.player.y + 20);
    const moving = length > 0;
    if (moving) {
      this.player.play("walk", true);
      if (x) this.player.setFlipX(x < 0);
    } else {
      this.player.anims.stop();
      this.player.setTexture("player");
    }
    if (moving) this.moved = true;
    else if (this.moved) {
      this.moved = false;
      const point = toWorld(this.player, this.bridge.origin);
      if (validCheckpoint(point)) this.bridge.onCheckpoint(point);
    }
    const nearby = nearestInteraction(this.player);
    if (nearby?.id !== this.nearby?.id) {
      this.nearby = nearby;
      this.bridge.onNearby(nearby);
    }

    if (this.authoritativeTarget) {
      const target = toScene(this.authoritativeTarget, this.bridge.origin);
      const correction = Math.hypot(target.x - this.player.x, target.y - this.player.y);
      if (!moving || correction > 18) this.player.setPosition(target.x, target.y);
      else if (correction > 2) {
        this.player.x += (target.x - this.player.x) * 0.2;
        this.player.y += (target.y - this.player.y) * 0.2;
      }
    }
    const blend = Math.min(1, Math.max(0, delta) * 0.012);
    for (const actor of this.remoteActors.values()) {
      actor.sprite.x += (actor.target.x - actor.sprite.x) * blend;
      actor.sprite.y += (actor.target.y - actor.sprite.y) * blend;
      actor.sprite.setDepth(actor.sprite.y + 20);
      actor.label.setPosition(actor.sprite.x, actor.sprite.y - 35);
    }
  }

  setLocalSessionId(sessionId: string | null) {
    this.localSessionId = sessionId;
  }
  syncNetworkPlayers(players: Array<NetworkPlayerSnapshot & { sessionId: string }>) {
    const active = new Set<string>();
    for (const player of players) {
      if (player.sessionId === this.localSessionId) {
        this.authoritativeTarget = { x: player.x, y: player.y };
        continue;
      }
      active.add(player.sessionId);
      const position = toScene({ x: player.x, y: player.y }, this.bridge.origin);
      let actor = this.remoteActors.get(player.sessionId);
      if (!actor) {
        const shirt = this.remoteColor(player.sessionId);
        const texture = `remote-${player.sessionId}`;
        this.makePerson(texture, shirt, 0x855733);
        const sprite = this.add.sprite(position.x, position.y, texture).setDepth(position.y + 20);
        const label = this.add
          .text(position.x, position.y - 35, player.name.slice(0, 24), {
            fontFamily: "sans-serif",
            fontSize: "12px",
            color: "#26332d",
            backgroundColor: "#fffdf8",
          })
          .setOrigin(0.5)
          .setPadding(5, 3)
          .setDepth(900);
        actor = { sprite, label, target: position };
        this.remoteActors.set(player.sessionId, actor);
      }
      actor.target = position;
      actor.sprite.setFlipX(player.facing === "west");
      actor.label.setText(player.name.slice(0, 24));
    }
    for (const [sessionId, actor] of this.remoteActors) {
      if (active.has(sessionId)) continue;
      actor.sprite.destroy();
      actor.label.destroy();
      this.remoteActors.delete(sessionId);
    }
  }
  private remoteColor(sessionId: string) {
    const palette = [0x176b45, 0xb86e43, 0x647c9a, 0x915d86, 0x92722f];
    let hash = 0;
    for (const char of sessionId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return palette[Math.abs(hash) % palette.length] ?? 0x176b45;
  }
  setTouch(direction: MovementInput, pressed: boolean) {
    if (pressed) this.touch.add(direction);
    else this.touch.delete(direction);
  }
  lock(locked: boolean) {
    this.frozen = locked;
    if (locked) {
      this.destination = null;
      this.touch.clear();
      this.moved = false;
      this.player?.setVelocity(0);
    }
  }
  restore(point: WorldPoint) {
    const p = toScene(point, this.bridge.origin);
    this.player?.setPosition(p.x, p.y);
    this.destination = null;
    this.moved = false;
  }
  interact() {
    if (!this.frozen && this.nearby) this.bridge.onInteract(this.nearby);
  }
  checkpoint() {
    return this.player
      ? this.bridge.saveCheckpoint(toWorld(this.player, this.bridge.origin))
      : Promise.resolve(false);
  }
  zoom(delta: number) {
    if (!this.cameras?.main) return;
    this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom + delta, 0.8, 2));
  }
}

export function createNeighborhoodGame(parent: HTMLElement, bridge: NeighborhoodBridge) {
  const scene = new NeighborhoodScene(bridge);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth || 640,
    height: parent.clientHeight || 500,
    backgroundColor: "#e8eedf",
    scene: [scene],
    physics: { default: "arcade", arcade: { debug: false } },
    scale: { mode: Phaser.Scale.RESIZE },
    render: { antialias: true, roundPixels: true },
    fps: { target: 60 },
    audio: { noAudio: true },
  });
  return { game, scene };
}
