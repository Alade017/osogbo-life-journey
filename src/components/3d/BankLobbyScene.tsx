import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Group, Plane, Vector3 } from "three";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import { WorldInstances, WorldMaterial, type WorldInstance } from "@/components/3d/WorldScene";
import { Scene } from "@/components/3d/Scene";
import { SceneHtml as Html } from "@/components/3d/SceneHtml";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";
import type { Appearance } from "@/game/avatar-appearance";
import { BANK_BRANCH_STAFF, type BankSlug } from "@/lib/bank-branch-data";

type Position = [number, number, number];
type OnlineBankPlayer = { characterId: string; name: string };
const FLOOR = new Plane(new Vector3(0, 1, 0), 0);
const FLOOR_TILE_GROUPS = [0, 1].map((parity) =>
  Array.from({ length: 10 * 14 }, (_, index) => {
    const row = Math.floor(index / 14);
    const column = index % 14;
    return { row, column };
  })
    .filter(({ row, column }) => (row + column) % 2 === parity)
    .map(({ row, column }): WorldInstance => ({
      position: [column - 6.5, 0.011, row - 4.5],
      scale: [0.97, 0.018, 0.97],
    })),
);

function Block({
  position,
  size,
  color,
  onClick,
}: {
  position: Position;
  size: Position;
  color: string;
  onClick?: (() => void) | undefined;
}) {
  return (
    <mesh
      position={position}
      castShadow
      receiveShadow
      {...(onClick
        ? {
            onClick: (event: ThreeEvent<MouseEvent>) => {
              event.stopPropagation();
              onClick();
            },
          }
        : {})}
    >
      <boxGeometry args={size} />
      <WorldMaterial color={color} />
    </mesh>
  );
}

function Plant({ position }: { position: Position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.32, 0.26, 0.7, 8]} />
        <WorldMaterial color="#b76e48" />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <icosahedronGeometry args={[0.65, 0]} />
        <WorldMaterial tone="foliage" />
      </mesh>
      <mesh position={[-0.38, 0.9, 0.08]} scale={0.7}>
        <icosahedronGeometry args={[0.55, 0]} />
        <WorldMaterial color="#71866e" />
      </mesh>
      <mesh position={[0.4, 0.88, -0.08]} scale={0.72}>
        <icosahedronGeometry args={[0.55, 0]} />
        <WorldMaterial color="#9aa47b" />
      </mesh>
    </group>
  );
}

function LobbyArchitecture({
  onInteract,
  onWalk,
}: {
  onInteract: (place: "teller" | "atm" | "seat") => void;
  onWalk: (position: Position) => void;
}) {
  const { invalidate } = useThree();

  useEffect(() => {
    const update = () => invalidate();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [invalidate]);

  const walkOnFloor = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const point = event.ray.intersectPlane(FLOOR, new Vector3());
    if (!point) return;
    onWalk([Math.max(-5.7, Math.min(5.7, point.x)), 0.06, Math.max(-3.9, Math.min(3.9, point.z))]);
  };

  return (
    <group>
      <mesh position={[0, -0.04, 0]} onClick={walkOnFloor} receiveShadow>
        <boxGeometry args={[14, 0.08, 10]} />
        <WorldMaterial tone="tileLight" />
      </mesh>
      <WorldInstances items={FLOOR_TILE_GROUPS[0]!} tone="tileLight" />
      <WorldInstances items={FLOOR_TILE_GROUPS[1]!} tone="tileShade" />

      <Block position={[0, 2, -5.15]} size={[14, 4, 0.3]} color="#e5dece" />
      <Block position={[-6.85, 2, 0]} size={[0.3, 4, 10.2]} color="#e5dece" />
      <Block position={[6.85, 2, -1.6]} size={[0.3, 4, 6.8]} color="#e5dece" />
      <Block position={[0, 3.2, -4.95]} size={[12.8, 0.12, 0.08]} color="#1e5960" />

      {[-4.7, -2.1, 0.5, 3.1].map((x) => (
        <group key={x}>
          <Block position={[x, 1.85, -4.92]} size={[2.1, 1.75, 0.06]} color="#a8d1d6" />
          <Block position={[x, 1.85, -4.85]} size={[0.09, 1.9, 0.12]} color="#f0e9dc" />
        </group>
      ))}

      <Block position={[-0.5, 0.24, -2.55]} size={[7.4, 0.48, 0.9]} color="#bd9b73" />
      <Block position={[-0.5, 0.63, -2.55]} size={[7.65, 0.2, 1]} color="#213f51" />
      {[-2.4, 1.2].map((x) => (
        <group key={x}>
          <Block position={[x, 1.2, -3.1]} size={[2.2, 0.9, 0.08]} color="#d9c8ac" />
          <Block position={[x, 1.68, -3.04]} size={[2.2, 0.08, 0.08]} color="#be874e" />
          <Block
            position={[x, 0.92, -2.1]}
            size={[1.65, 0.5, 0.08]}
            color="#d0b38c"
            onClick={() => onInteract("teller")}
          />
        </group>
      ))}

      <group
        onClick={(event) => {
          event.stopPropagation();
          onInteract("atm");
        }}
      >
        <Block position={[5, 0.88, 0.6]} size={[1.05, 1.76, 0.48]} color="#294d5a" />
        <Block position={[5, 1.46, 0.87]} size={[0.66, 0.56, 0.06]} color="#92c6bd" />
        <Block position={[5, 0.63, 0.88]} size={[0.42, 0.12, 0.05]} color="#d5ae6a" />
        <Block position={[5, 0.14, 0.87]} size={[0.72, 0.18, 0.06]} color="#d6d2c7" />
      </group>

      {[-5.15, -3.8, 3.8].map((x) => (
        <group
          key={x}
          onClick={(event) => {
            event.stopPropagation();
            onInteract("seat");
          }}
        >
          <Block position={[x, 0.55, 1.85]} size={[1.15, 0.18, 0.92]} color="#bd8a5e" />
          <Block position={[x, 1.04, 1.51]} size={[1.15, 0.82, 0.16]} color="#53766f" />
          {[-0.4, 0.4].map((leg) => (
            <Block
              key={leg}
              position={[x + leg, 0.26, 1.85]}
              size={[0.1, 0.52, 0.1]}
              color="#4b4d48"
            />
          ))}
        </group>
      ))}

      {[-2.5, -0.9, 0.7, 2.3].map((x) => (
        <group key={x} position={[x, 0, 0.05]}>
          <mesh position={[0, 0.48, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.9, 6]} />
            <WorldMaterial color="#b27c47" />
          </mesh>
          <mesh position={[0, 0.97, 0]}>
            <sphereGeometry args={[0.13, 8, 6]} />
            <WorldMaterial color="#d8c6a9" />
          </mesh>
          {x < 2.3 && (
            <Block position={[x + 0.8, 0.48, 0]} size={[0.8, 0.045, 0.045]} color="#b27c47" />
          )}
        </group>
      ))}
      <Plant position={[-6.3, 0, -3.9]} />
      <Plant position={[6.2, 0, -3.9]} />
    </group>
  );
}

function WalkingPlayer({
  name,
  appearance,
  gender,
  destination,
  reducedMotion,
}: {
  name: string;
  appearance: Appearance;
  gender: string;
  destination: Position;
  reducedMotion: boolean;
}) {
  const group = useRef<Group>(null);
  const [walking, setWalking] = useState(false);
  const { invalidate } = useThree();

  useEffect(() => {
    const current = group.current?.position;
    if (!current) return;
    if (reducedMotion) {
      current.set(...destination);
      setWalking(false);
      invalidate();
      return;
    }
    const distance = current.distanceTo(new Vector3(...destination));
    if (distance < 0.06) {
      setWalking(false);
      return;
    }
    setWalking(true);
    const timer = window.setInterval(invalidate, 1000 / 30);
    const finish = window.setTimeout(
      () => {
        window.clearInterval(timer);
        setWalking(false);
      },
      (distance / 2.6) * 1000 + 80,
    );
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(finish);
    };
  }, [destination, reducedMotion, invalidate]);

  useFrame((_, delta) => {
    const current = group.current?.position;
    if (!current || !walking) return;
    const target = new Vector3(...destination);
    current.lerp(target, Math.min(1, delta * 2.6));
    if (current.distanceTo(target) < 0.06) {
      current.copy(target);
    }
  });

  return (
    <group ref={group} position={[0, 0.06, 3.35]}>
      <WorldCharacter
        name={name}
        appearance={appearance}
        gender={gender}
        position={[0, 0, 0]}
        animation={walking && !reducedMotion ? "walk" : "idle"}
      />
    </group>
  );
}

function OnlineVisitors({ players }: { players: OnlineBankPlayer[] }) {
  return (
    <>
      {players.slice(0, 5).map((player, index) => {
        const row = Math.floor(index / 3);
        const column = index % 3;
        const x = -2.2 + column * 1.35;
        const z = 1.25 + row * 0.85;
        return (
          <WorldCharacter
            key={player.characterId}
            name={player.name}
            position={[x, 0.06, z]}
            facing="north"
            animation={index % 2 === 0 ? "talk" : "idle"}
          />
        );
      })}
    </>
  );
}

function LobbyCharacters({
  branch,
  players,
  onInteract,
}: {
  branch: BankSlug;
  players: OnlineBankPlayer[];
  onInteract: (place: "teller" | "atm" | "seat") => void;
}) {
  return (
    <>
      {BANK_BRANCH_STAFF[branch].map((staff) => (
        <group
          key={staff.id}
          onClick={(event) => {
            event.stopPropagation();
            onInteract("teller");
          }}
        >
          <WorldCharacter
            name={staff.name}
            appearance={staff.appearance}
            position={staff.position}
            facing="south"
            animation={staff.animation}
          />
        </group>
      ))}
      <WorldCharacter
        name="Waiting visitor"
        appearance={{ outfit: 4, bottoms: 2, hair: 2 }}
        position={[-4.5, 0.06, 2.15]}
        facing="north"
        animation="idle"
      />
      <OnlineVisitors players={players} />
    </>
  );
}

function BankLobbyModel({
  branch,
  bankName,
  players,
  playerName,
  appearance,
  gender,
  destination,
  reducedMotion,
  onInteract,
  onWalk,
  onReady,
}: {
  branch: BankSlug;
  bankName: string;
  players: OnlineBankPlayer[];
  playerName: string;
  appearance: Appearance;
  gender: string;
  destination: Position;
  reducedMotion: boolean;
  onInteract: (place: "teller" | "atm" | "seat") => void;
  onWalk: (position: Position) => void;
  onReady: () => void;
}) {
  useEffect(onReady, [onReady]);

  return (
    <>
      <LobbyArchitecture onInteract={onInteract} onWalk={onWalk} />
      <LobbyCharacters branch={branch} players={players} onInteract={onInteract} />
      <WalkingPlayer
        key={playerName}
        name={playerName}
        appearance={appearance}
        gender={gender}
        destination={destination}
        reducedMotion={reducedMotion}
      />
      <mesh position={[0, 0, 0]} visible={false} name={`interior:${bankName}`} />
    </>
  );
}

export function BankLobbyFallback({
  bankName,
  onInteract,
}: {
  bankName: string;
  onInteract: (place: "teller" | "atm" | "seat") => void;
}) {
  return (
    <div
      className="flex h-full min-h-[260px] flex-col justify-between rounded-xl border border-border bg-[#e7e2d7] p-5 text-[#243d49]"
      role="group"
      aria-label={`${bankName} lobby illustration`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#386a68]">{bankName}</p>
          <h2 className="mt-1 text-xl font-black">Welcome to the lobby</h2>
        </div>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold">OPEN</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-3 h-3 rounded bg-[#244d5b]" />
        <button
          type="button"
          onClick={() => onInteract("teller")}
          className="h-16 rounded-lg border-b-4 border-[#b78050] bg-[#d2c0a3]"
          aria-label="Talk to a bank teller"
        />
        <button
          type="button"
          onClick={() => onInteract("seat")}
          className="h-16 rounded-lg border-b-4 border-[#b78050] bg-[#d2c0a3]"
          aria-label="Use the waiting area"
        />
        <button
          type="button"
          onClick={() => onInteract("atm")}
          className="flex h-16 items-center justify-center rounded-lg bg-[#375d68] text-xs font-bold text-white"
        >
          ATM
        </button>
      </div>
      <p className="text-sm font-semibold">Teller service | Waiting area | 24-hour ATM</p>
    </div>
  );
}

export function BankLobbyScene({
  branch,
  bankName,
  players,
  playerName,
  appearance,
  gender,
  reducedMotion = false,
  onInteract,
}: {
  branch: BankSlug;
  bankName: string;
  players: OnlineBankPlayer[];
  playerName: string;
  appearance: Appearance;
  gender: string;
  reducedMotion?: boolean;
  onInteract: (place: "teller" | "atm" | "seat") => void;
}) {
  const [sceneFailed, setSceneFailed] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [destination, setDestination] = useState<Position>([0, 0.06, 3.35]);
  const handleReady = useCallback(() => setSceneReady(true), []);
  const fallback = <BankLobbyFallback bankName={bankName} onInteract={onInteract} />;

  useEffect(() => {
    if (sceneReady || sceneFailed) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setLoadingProgress(Math.min(95, Math.round((elapsed / 10_000) * 95)));
      if (elapsed >= 10_000) {
        window.clearInterval(timer);
        setSceneFailed(true);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [sceneFailed, sceneReady]);

  if (sceneFailed) return fallback;

  return (
    <div
      className="h-[min(62vh,560px)] min-h-[340px] overflow-hidden rounded-xl border border-border bg-[#e7e2d7] sm:min-h-[420px]"
      aria-label={`${bankName} interactive lobby`}
    >
      <Scene
        zoom={33}
        onError={() => setSceneFailed(true)}
        fallback={fallback}
        loadingFallback={
          <Html center>
            <WorldLoadingIndicator
              title="Entering the bank"
              detail="Preparing the lobby"
              progress={loadingProgress}
            />
          </Html>
        }
      >
        <BankLobbyModel
          branch={branch}
          bankName={bankName}
          players={players}
          playerName={playerName}
          appearance={appearance}
          gender={gender}
          destination={destination}
          reducedMotion={reducedMotion}
          onInteract={onInteract}
          onWalk={setDestination}
          onReady={handleReady}
        />
      </Scene>
    </div>
  );
}
