import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Box3, Group, Plane, Vector3 } from "three";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import { Scene } from "@/components/3d/Scene";
import { SceneHtml as Html } from "@/components/3d/SceneHtml";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";
import type { Appearance } from "@/game/avatar-appearance";
import { BANK_BRANCH_STAFF, type BankSlug } from "@/lib/bank-branch-data";

type Position = [number, number, number];

/** Where the player stands when entering the bank. */
const BANK_ENTRANCE: Position = [0, 0.06, 3.35];
type OnlineBankPlayer = { characterId: string; name: string };
const FLOOR = new Plane(new Vector3(0, 1, 0), 0);

/** The bank hall shell from the supplied environment models. */
const BANK_SHELL_URL = "/models/environments/market-and-bank/bank-vault-hall.glb";
/** The walkable lobby, in metres from its centre. The shell is fitted inside this rectangle. */
const LOBBY_WALK = { x: 5.7, z: 3.45 };
/** The ATM kiosk model and where it stands in the walkable lobby, in lobby coordinates. */
const BANK_ATM_URL = "/models/environments/market-and-bank/atm-kiosk.glb";
const ATM_POSITION: Position = [4.6, 0, 2.5];
/** Model parts that open an activity when clicked, matched by the names in the model file. */
const SHELL_HOTSPOTS: Record<string, "teller" | "seat"> = {
  "025-teller-counter": "teller",
  "026-bulletproof-screen": "teller",
  "033-waiting-chairs": "seat",
};

type ShellHotspot = { place: "teller" | "seat"; centre: Position; size: Position };

/**
 * Turns the shell so its long side runs across the lobby, scales it to fit the walkable floor,
 * and reads each hotspot's bounds from the model's own named parts.
 */
function fitBankShell(scene: Group) {
  const shell = scene.clone(true);
  const holder = new Group();
  holder.add(shell);
  holder.updateMatrixWorld(true);

  const hotspots: ShellHotspot[] = [];
  for (const [name, place] of Object.entries(SHELL_HOTSPOTS)) {
    const part = shell.getObjectByName(name);
    if (!part) continue;
    const box = new Box3().setFromObject(part);
    const centre = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    hotspots.push({
      place,
      centre: [centre.x, centre.y, centre.z],
      size: [size.x, size.y, size.z],
    });
  }

  // Turn a quarter, then scale so the rotated footprint fits the walkable floor.
  holder.rotation.y = Math.PI / 2;
  holder.updateMatrixWorld(true);
  const turned = new Box3().setFromObject(holder);
  const turnedSize = turned.getSize(new Vector3());
  const fit = Math.min((LOBBY_WALK.x * 2) / turnedSize.x, (LOBBY_WALK.z * 2) / turnedSize.z);
  holder.scale.setScalar(fit);
  holder.updateMatrixWorld(true);
  const placed = new Box3().setFromObject(holder);
  const centre = placed.getCenter(new Vector3());
  // Centre the hall on the origin, with its floor at y = 0.
  holder.position.set(-centre.x, -placed.min.y, -centre.z);

  return { holder, shell, hotspots };
}

function LobbyArchitecture({
  onInteract,
  onWalk,
}: {
  onInteract: (place: "teller" | "atm" | "seat") => void;
  onWalk: (position: Position) => void;
}) {
  const { invalidate } = useThree();
  const gltf = useGLTF(BANK_SHELL_URL);
  const fitted = useMemo(() => fitBankShell(gltf.scene), [gltf]);
  const atmModel = useGLTF(BANK_ATM_URL);
  const atm = useMemo(() => atmModel.scene.clone(true), [atmModel]);

  useEffect(() => {
    const update = () => invalidate();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [invalidate]);

  const walkOnFloor = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const point = event.ray.intersectPlane(FLOOR, new Vector3());
    if (!point) return;
    onWalk([
      Math.max(-LOBBY_WALK.x, Math.min(LOBBY_WALK.x, point.x)),
      0.06,
      Math.max(-LOBBY_WALK.z, Math.min(LOBBY_WALK.z, point.z)),
    ]);
  };

  return (
    <group>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={walkOnFloor}>
        <planeGeometry args={[LOBBY_WALK.x * 2, LOBBY_WALK.z * 2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group
        position={ATM_POSITION}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          onInteract("atm");
        }}
      >
        <primitive object={atm} />
      </group>
      <primitive object={fitted.holder}>
        <primitive object={fitted.shell}>
          {fitted.hotspots.map((hotspot) => (
            <mesh
              key={`${hotspot.place}-${hotspot.centre.join(",")}`}
              position={hotspot.centre}
              onClick={(event: ThreeEvent<MouseEvent>) => {
                event.stopPropagation();
                onInteract(hotspot.place);
              }}
            >
              <boxGeometry args={hotspot.size} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}
        </primitive>
      </primitive>
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
  const walkingRef = useRef(false);
  const target = useMemo(() => new Vector3(...destination), [destination]);
  const { invalidate } = useThree();

  // Start at the entrance once. The position is not a prop, so renders never snap the body back.
  useLayoutEffect(() => {
    group.current?.position.set(...BANK_ENTRANCE);
    invalidate();
  }, [invalidate]);

  useEffect(() => {
    const current = group.current?.position;
    if (!current) return;
    if (reducedMotion) {
      current.copy(target);
      walkingRef.current = false;
      setWalking(false);
      invalidate();
      return;
    }
    if (current.distanceTo(target) < 0.06) return;
    walkingRef.current = true;
    setWalking(true);
  }, [target, reducedMotion, invalidate]);

  // Keep frames coming while the character walks, so the walk is drawn in demand mode too.
  useEffect(() => {
    if (!walking) return;
    const timer = window.setInterval(invalidate, 1000 / 30);
    return () => window.clearInterval(timer);
  }, [walking, invalidate]);

  useFrame((_, delta) => {
    const current = group.current?.position;
    if (!current || !walkingRef.current) return;
    current.lerp(target, Math.min(1, delta * 2.6));
    if (current.distanceTo(target) < 0.06) {
      current.copy(target);
      walkingRef.current = false;
      setWalking(false);
    }
  });

  return (
    <group ref={group}>
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
  const [destination, setDestination] = useState<Position>(BANK_ENTRANCE);
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
