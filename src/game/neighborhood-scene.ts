import * as Phaser from "phaser";
import {
  CITY_CENTRE_AREA,
  NEIGHBORHOOD_SIZE,
  neighborhoodAreaForSlug,
  nearestInteraction,
  toScene,
  toWorld,
  validCheckpoint,
  type NeighborhoodArea,
  type NeighborhoodObject,
  type WorldPoint,
} from "./neighborhood-model";
import type { NetworkPlayerSnapshot } from "./multiplayer-state";
import {
  type Appearance,
  type AvatarAnimationState,
  type AvatarFacing,
  type AvatarEquipment,
} from "@/components/game/Avatar";
import {
  avatarAnimationKey,
  avatarClipFrameRange,
  facingFromMovement,
  parseSavedAppearance,
} from "./character-animation";
import { avatarTextureKey, ensureAvatarTexture } from "./character-texture";

type RemoteActor = {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  target: WorldPoint;
  player: NetworkPlayerSnapshot;
  textureKey: string | null;
  appearanceKey: string;
  animationKey: string;
  facing: AvatarFacing;
  turning: boolean;
};

export type NeighborhoodBridge = {
  origin: WorldPoint;
  spawn: WorldPoint;
  area?: NeighborhoodArea;
  appearance?: Appearance;
  gender?: string;
  equipment?: readonly AvatarEquipment[];
  onNearby: (object: NeighborhoodObject | null) => void;
  onCheckpoint: (point: WorldPoint) => void;
  onLocationSelected: (object: NeighborhoodObject) => void;
  onInteract: (object: NeighborhoodObject) => void;
  onPlayerSelected: (player: NetworkPlayerSnapshot) => void;
  onPlayerTooFar: (name: string) => void;
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
  private remoteActors = new Map<string, RemoteActor>();
  private localSessionId: string | null = null;
  private movementIntent = { x: 0, y: 0 };
  private lastIntentSentAt = 0;
  private authoritativeTarget: WorldPoint | null = null;
  private localTextureKey: string | null = null;
  private localAnimationKey = "";
  private localFacing: AvatarFacing = "south";
  private localTurning = false;
  private actionOverride: { state: "talk" | "work"; until: number | null } | null = null;
  private reducedMotion = false;
  private motionPreference: MediaQueryList | null = null;
  private get area() {
    return this.bridge.area ?? neighborhoodAreaForSlug(CITY_CENTRE_AREA.slug);
  }
  constructor(private bridge: NeighborhoodBridge) {
    super("neighborhood");
  }

  create() {
    const { width, height } = NEIGHBORHOOD_SIZE;
    this.cameras.main.setBackgroundColor(this.area.style.ground);
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
    ground.fillStyle(this.area.style.ground).fillRect(0, 0, width, height);
    ground.lineStyle(1, this.area.style.grid, 0.7);
    for (let x = 0; x < width; x += 32) ground.lineBetween(x, 0, x, height);
    for (let y = 0; y < height; y += 32) ground.lineBetween(0, y, width, y);
    const roads = this.area.style;
    ground
      .fillStyle(roads.road)
      .fillRoundedRect(roads.verticalRoad.x, 0, roads.verticalRoad.width, height, 6)
      .fillRoundedRect(0, roads.horizontalRoad.y, width, roads.horizontalRoad.height, 6);
    ground
      .fillStyle(roads.paving)
      .fillRect(roads.verticalRoad.x + 9, 0, roads.verticalRoad.width - 18, height)
      .fillRect(0, roads.horizontalRoad.y + 9, width, roads.horizontalRoad.height - 18);
    ground.lineStyle(2, roads.marking, 0.65);
    const verticalCenter = roads.verticalRoad.x + roads.verticalRoad.width / 2;
    const horizontalCenter = roads.horizontalRoad.y + roads.horizontalRoad.height / 2;
    for (let y = 0; y < height; y += 40)
      ground.lineBetween(verticalCenter, y, verticalCenter, y + 16);
    for (let x = 0; x < width; x += 40)
      ground.lineBetween(x, horizontalCenter, x + 16, horizontalCenter);
    if (this.area.marketStalls) {
      const awningColors = [0xb34f3a, 0xe2a646, 0x567a56];
      this.area.marketStalls.forEach((stall, index) => {
        const graphics = this.add.graphics({ x: stall.x, y: stall.y });
        graphics
          .fillStyle(0x65503a, 0.18)
          .fillEllipse(0, 17, 38, 10)
          .fillStyle(0x8b6745)
          .fillRect(-14, 1, 28, 13)
          .fillStyle(awningColors[index % awningColors.length]!)
          .fillPoints(
            [
              { x: -19, y: 1 },
              { x: -13, y: -9 },
              { x: 14, y: -9 },
              { x: 19, y: 1 },
            ],
            true,
          )
          .setDepth(stall.y);
      });
    }
    const solids = this.physics.add.staticGroup();
    for (const object of this.area.objects) {
      if (object.kind === "npc") {
        this.makePerson("neighbor-fallback", 0xdfa451, 0x784c32);
        const neighbor = this.add
          .sprite(object.x, object.y, "neighbor-fallback")
          .setDepth(object.y);
        void ensureAvatarTexture(this, { skin: 2, hair: 2, outfit: 1 }, "female").then((key) => {
          if (!key || !this.sys.isActive()) return;
          neighbor.setTexture(key);
          if (this.reducedMotion)
            neighbor.setTexture(key, avatarClipFrameRange("idle", "south").start);
          else neighbor.play(avatarAnimationKey(key, "idle", "south"));
        });
        this.add
          .text(object.x, object.y - 42, "Bisi", {
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
    this.makePerson("player-fallback", 0x176746, 0x855733);
    const spawn = toScene(this.bridge.spawn, this.bridge.origin);
    this.player = this.physics.add
      .sprite(spawn.x, spawn.y, "player-fallback")
      .setCollideWorldBounds(true);
    this.player.setSize(18, 12).setOffset(15, 43);
    void ensureAvatarTexture(
      this,
      this.bridge.appearance,
      this.bridge.gender,
      this.bridge.equipment,
    ).then((key) => {
      if (!key || !this.sys.isActive() || !this.player) return;
      this.localTextureKey = key;
      this.player.setTexture(key, avatarClipFrameRange("idle", "south").start);
      this.setLocalAnimation("idle", this.localFacing);
    });
    this.motionPreference =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    this.reducedMotion = this.motionPreference?.matches ?? false;
    this.motionPreference?.addEventListener("change", this.handleMotionPreference);
    this.physics.add.collider(this.player, solids, () => {
      this.destination = null;
    });
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E", false) as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.input.keyboard!.on("keydown-E", this.interact, this);
    this.input.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (this.frozen) return;
        const actor = [...this.remoteActors.values()].find(
          (candidate) =>
            currentlyOver.includes(candidate.sprite) || currentlyOver.includes(candidate.label),
        );
        if (actor) {
          if (
            Phaser.Math.Distance.Between(
              this.player.x,
              this.player.y,
              actor.sprite.x,
              actor.sprite.y,
            ) <= 78
          ) {
            this.bridge.onPlayerSelected(actor.player);
          } else {
            this.destination = { x: actor.player.x, y: actor.player.y };
            this.bridge.onPlayerTooFar(actor.player.name);
          }
          return;
        }
        this.destination = { x: pointer.worldX, y: pointer.worldY };
      },
    );
    this.input.on("wheel", (_pointer: unknown, _objects: unknown, _dx: number, dy: number) =>
      this.zoom(dy > 0 ? -0.1 : 0.1),
    );
    this.cameras.main.setBounds(0, 0, width, height).startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.2);
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.touch.clear();
      this.motionPreference?.removeEventListener("change", this.handleMotionPreference);
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
    art.fillStyle(0x334d40, 0.2).fillEllipse(24, 52, 30, 9);
    art
      .fillStyle(0x344638)
      .fillRoundedRect(17, 44, 8, step ? 13 : 15, 4)
      .fillRoundedRect(27, 44, 8, step ? 15 : 13, 4);
    art.fillStyle(shirt).fillRoundedRect(12, 27, 25, 22, 7);
    art.fillStyle(skin).fillRoundedRect(13, 5, 23, 22, 9);
    art.fillStyle(0x332a25).fillEllipse(24, 8, 26, 12);
    art.fillStyle(0x222222).fillCircle(19, 16, 1.5).fillCircle(30, 16, 1.5);
    art.generateTexture(key, 48, 60);
    art.destroy();
  }
  private handleMotionPreference = (event: MediaQueryListEvent) => {
    this.reducedMotion = event.matches;
    this.localAnimationKey = "";
    for (const actor of this.remoteActors.values()) actor.animationKey = "";
  };
  private setLocalAnimation(state: AvatarAnimationState, facing: AvatarFacing) {
    if (!this.localTextureKey || !this.player) return;
    const activeState = this.reducedMotion ? "idle" : state;
    const supportedFacing = facing === "west" ? "east" : facing;
    const key = avatarAnimationKey(this.localTextureKey, activeState, supportedFacing);
    this.player.setFlipX(facing === "west");
    if (this.reducedMotion) {
      const frame = avatarClipFrameRange("idle", supportedFacing).start;
      this.player.anims.stop();
      this.player.setTexture(this.localTextureKey, frame);
      this.localAnimationKey = key;
      return;
    }
    if (this.localAnimationKey !== key) {
      this.player.anims.play(key, true);
      this.localAnimationKey = key;
    }
  }
  private setRemoteAnimation(actor: RemoteActor, state: AvatarAnimationState) {
    if (!actor.textureKey) return;
    const facing = actor.facing === "west" ? "east" : actor.facing;
    const activeState = this.reducedMotion ? "idle" : state;
    const key = avatarAnimationKey(actor.textureKey, activeState, facing);
    actor.sprite.setFlipX(actor.facing === "west");
    if (this.reducedMotion) {
      actor.sprite.anims.stop();
      actor.sprite.setTexture(actor.textureKey, avatarClipFrameRange("idle", facing).start);
      actor.animationKey = key;
      return;
    }
    if (actor.animationKey !== key) {
      actor.sprite.anims.play(key, true);
      actor.animationKey = key;
    }
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
    const facing = facingFromMovement(x, y, this.localFacing);
    if (facing !== this.localFacing) {
      this.localFacing = facing;
      this.localAnimationKey = "";
      if (!this.reducedMotion && this.localTextureKey) {
        this.localTurning = true;
        this.setLocalAnimation("turn", facing);
        this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          this.localTurning = false;
          this.localAnimationKey = "";
        });
      }
    }
    if (
      this.actionOverride?.until !== null &&
      this.actionOverride &&
      time >= this.actionOverride.until
    ) {
      this.actionOverride = null;
    }
    if (!this.localTurning) {
      this.setLocalAnimation(this.actionOverride?.state ?? (moving ? "walk" : "idle"), facing);
    }
    if (moving) this.moved = true;
    else if (this.moved) {
      this.moved = false;
      const point = toWorld(this.player, this.bridge.origin);
      if (validCheckpoint(point)) this.bridge.onCheckpoint(point);
    }
    const nearby = nearestInteraction(this.player, this.area.objects);
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
      const isWalking =
        Math.hypot(actor.target.x - actor.sprite.x, actor.target.y - actor.sprite.y) > 2;
      if (!actor.turning) this.setRemoteAnimation(actor, isWalking ? "walk" : "idle");
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
        const texture = "remote-fallback";
        this.makePerson(texture, this.remoteColor(player.sessionId), 0x855733);
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
        sprite.setInteractive({ useHandCursor: true });
        label.setInteractive({ useHandCursor: true });
        actor = {
          sprite,
          label,
          target: position,
          player,
          textureKey: null,
          appearanceKey: "",
          animationKey: "",
          facing: this.safeFacing(player.facing),
          turning: false,
        };
        this.remoteActors.set(player.sessionId, actor);
      }
      actor.target = position;
      actor.player = player;
      const nextFacing = this.safeFacing(player.facing);
      if (nextFacing !== actor.facing) {
        actor.facing = nextFacing;
        actor.animationKey = "";
        if (!this.reducedMotion && actor.textureKey) {
          actor.turning = true;
          const turnKey = avatarAnimationKey(
            actor.textureKey,
            "turn",
            nextFacing === "west" ? "east" : nextFacing,
          );
          actor.sprite.setFlipX(nextFacing === "west").anims.play(turnKey, true);
          actor.animationKey = turnKey;
          actor.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            actor.turning = false;
            actor.animationKey = "";
          });
        }
      }
      actor.label.setText(player.name.slice(0, 24));
      const savedAppearance = parseSavedAppearance(player.appearance);
      const appearanceKey = avatarTextureKey(savedAppearance, player.gender);
      if (appearanceKey !== actor.appearanceKey) {
        actor.appearanceKey = appearanceKey;
        void ensureAvatarTexture(this, savedAppearance, player.gender).then((key) => {
          if (
            !key ||
            !this.sys.isActive() ||
            !this.remoteActors.has(player.sessionId) ||
            actor!.appearanceKey !== appearanceKey
          )
            return;
          actor!.textureKey = key;
          actor!.sprite.setTexture(key);
          actor!.animationKey = "";
          this.setRemoteAnimation(actor!, "idle");
        });
      }
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
  private safeFacing(value: string): AvatarFacing {
    return value === "north" || value === "east" || value === "west" ? value : "south";
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
  playAvatarAction(state: "talk" | "work") {
    this.actionOverride = { state, until: state === "talk" ? this.time.now + 1_200 : null };
    this.localTurning = false;
    this.localAnimationKey = "";
    this.setLocalAnimation(state, this.localFacing);
  }
  clearAvatarAction() {
    this.actionOverride = null;
    this.localAnimationKey = "";
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
