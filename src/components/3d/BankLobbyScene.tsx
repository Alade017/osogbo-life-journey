import { bankPartMatches, fitBankShell } from "./bank-shell-layout";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Group, Plane, Vector3 } from "three";
import { WorldCharacter } from "@/components/3d/WorldCharacter";
import { Scene } from "@/components/3d/Scene";
import { SceneHtml as Html } from "@/components/3d/SceneHtml";
import { WorldLoadingIndicator } from "@/components/game/WorldLoadingIndicator";
import {
  BANK_LOBBY,
  createBankNavigation,
  type BankNavigation,
} from "@/game/bank-lobby-navigation";
import { bankCollisionPolygons } from "./bank-collision-polygons";
import { createWalker, stepWalker, type MallWalker } from "@/game/mall-movement";
import type { Appearance } from "@/game/avatar-appearance";
import { BANK_BRANCH_STAFF, type BankSlug } from "@/lib/bank-branch-data";

type Position = [number, number, number];

/** Where the player stands when entering the bank. */
const BANK_ENTRANCE: Position = [1.5, 0.06, 3];
type OnlineBankPlayer = { characterId: string; name: string };
const FLOOR = new Plane(new Vector3(0, 1, 0), 0);

/** The bank hall shell from the supplied environment models. */
const BANK_SHELL_URL = "/models/environments/market-and-bank/bank-vault-hall.glb";
/** The walkable lobby, in metres from its centre. The shell is fitted inside this rectangle. */
const LOBBY_WALK = { x: BANK_LOBBY.halfWidth, z: BANK_LOBBY.halfDepth };
/** The ATM kiosk model and where it stands in the walkable lobby, in lobby coordinates. */
const BANK_ATM_URL = "/models/environments/market-and-bank/atm-kiosk.glb";
const ATM_POSITION: Position = [4.6, 0, 2.5];
/** Model parts that open an activity when clicked, matched by the names in the model file. */
function LobbyArchitecture({
  fitted,
  atm,
  onInteract,
  onWalk,
}: {
  fitted: ReturnType<typeof fitBankShell>;
  atm: Group;
  onInteract: (place: "teller" | "atm" | "seat") => void;
  onWalk: (position: Position) => void;
}) {
  const walkOnFloor = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 5) return;
    event.stopPropagation();
    const point = event.ray.intersectPlane(FLOOR, new Vector3());
    if (point) onWalk([point.x, 0.06, point.z]);
  };
  return (
    <group>
      {/* The imported hall has an incomplete floor footprint. Continue it under the entire lobby. */}
      <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={walkOnFloor}>
        <planeGeometry args={[LOBBY_WALK.x * 2, LOBBY_WALK.z * 2]} />
        <meshStandardMaterial color="#d8d2c6" roughness={0.9} />
      </mesh>
      <primitive
        object={atm}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          if (event.delta > 5) return;
          event.stopPropagation();
          onInteract("atm");
        }}
      />
      <primitive
        object={fitted.holder}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          if (event.delta > 5) return;
          event.stopPropagation();
          // Pick the visible geometry, not a large invisible box spanning unrelated furniture.
          const name = event.object.name;
          if (
            bankPartMatches(name, "025-teller-counter") ||
            bankPartMatches(name, "026-bulletproof-screen")
          )
            onInteract("teller");
          else if (bankPartMatches(name, "033-waiting-chairs")) onInteract("seat");
          else if (bankPartMatches(name, "000-lobby-floor-tile")) walkOnFloor(event);
        }}
      />
    </group>
  );
}

function WalkingPlayer({
  name,
  appearance,
  gender,
  destination,
  reducedMotion,
  navigation,
  onBlocked,
}: {
  name: string;
  appearance: Appearance;
  gender: string;
  destination: Position;
  reducedMotion: boolean;
  navigation: BankNavigation;
  onBlocked: (blocked: boolean) => void;
}) {
  const group = useRef<Group>(null);
  const [walking, setWalking] = useState(false);
  const walker = useRef<MallWalker | null>(null);
  const { invalidate } = useThree();
  useLayoutEffect(() => {
    const spawn = navigation.nearest([BANK_ENTRANCE[0], BANK_ENTRANCE[2]]);
    if (!spawn) throw new Error("The bank has no clear entrance.");
    group.current?.position.set(spawn[0], 0.06, spawn[1]);
    invalidate();
  }, [navigation, invalidate]);
  useEffect(() => {
    const current = group.current?.position;
    if (!current) return;
    const path = navigation.route([current.x, current.z], [destination[0], destination[2]]);
    walker.current = null;
    setWalking(false);
    onBlocked(!path);
    if (!path) return;
    if (reducedMotion) current.set(destination[0], 0.06, destination[2]);
    else if (Math.hypot(current.x - destination[0], current.z - destination[2]) > 0.06) {
      walker.current = createWalker([current.x, current.z], path);
      setWalking(true);
    }
    invalidate();
  }, [destination, reducedMotion, navigation, invalidate, onBlocked]);
  useFrame((_, delta) => {
    if (!group.current || !walker.current || walker.current.done) return;
    const previous = walker.current.pos;
    const next = stepWalker(walker.current, Math.min(delta, 0.1));
    walker.current = next;
    group.current.position.set(next.pos[0], 0.06, next.pos[1]);
    const dx = next.pos[0] - previous[0],
      dz = next.pos[1] - previous[1];
    if (Math.hypot(dx, dz) > 0.0001) group.current.rotation.y = Math.atan2(dx, dz);
    if (next.done) setWalking(false);
    else invalidate();
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

function LobbyCharacters({
  navigation,
  branch,
  players,
  onInteract,
}: {
  branch: BankSlug;
  navigation: BankNavigation;
  players: OnlineBankPlayer[];
  onInteract: (place: "teller" | "atm" | "seat") => void;
}) {
  const visitorCount = Math.min(players.length, 5);
  const positions = useMemo(() => {
    const occupied: Array<readonly [number, number]> = [[BANK_ENTRANCE[0], BANK_ENTRANCE[2]]];
    const targets = [
      ...BANK_BRANCH_STAFF[branch].map((staff) => [staff.position[0], staff.position[2]] as const),
      [-4.5, 2.15] as const,
      ...Array.from(
        { length: visitorCount },
        (_, index) => [-2.2 + (index % 3) * 1.35, 1.25 + Math.floor(index / 3) * 0.85] as const,
      ),
    ];
    return targets.map((target) => {
      const point = navigation.nearest(target, occupied);
      if (!point) throw new Error("The bank has no clear standing area.");
      occupied.push(point);
      return [point[0], 0.06, point[1]] as Position;
    });
  }, [branch, navigation, visitorCount]);
  return (
    <>
      {BANK_BRANCH_STAFF[branch].map((staff, index) => (
        <group
          key={staff.id}
          onClick={(event) => {
            if (event.delta > 5) return;
            event.stopPropagation();
            onInteract("teller");
          }}
        >
          <WorldCharacter
            name={staff.name}
            appearance={staff.appearance}
            position={positions[index]!}
            facing="south"
            animation={staff.animation}
          />
        </group>
      ))}
      <WorldCharacter
        name="Waiting visitor"
        appearance={{ outfit: 4, bottoms: 2, hair: 2 }}
        position={positions[BANK_BRANCH_STAFF[branch].length]!}
        facing="north"
        animation="idle"
      />
      {players.slice(0, visitorCount).map((player, index) => (
        <WorldCharacter
          key={player.characterId}
          name={player.name}
          position={positions[BANK_BRANCH_STAFF[branch].length + 1 + index]!}
          facing="north"
          animation={index % 2 === 0 ? "talk" : "idle"}
        />
      ))}
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
  onBlocked,
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
  onBlocked: (blocked: boolean) => void;
}) {
  const gltf = useGLTF(BANK_SHELL_URL);
  const atmModel = useGLTF(BANK_ATM_URL);
  const fitted = useMemo(() => fitBankShell(gltf.scene), [gltf.scene]);
  const atm = useMemo(() => {
    const root = new Group();
    root.position.set(...ATM_POSITION);
    root.add(atmModel.scene.clone(true));
    return root;
  }, [atmModel.scene]);
  const navigation = useMemo(
    () => createBankNavigation(bankCollisionPolygons([fitted.holder, atm])),
    [fitted, atm],
  );
  useEffect(onReady, [onReady]);

  return (
    <>
      <LobbyArchitecture fitted={fitted} atm={atm} onInteract={onInteract} onWalk={onWalk} />
      <LobbyCharacters
        branch={branch}
        navigation={navigation}
        players={players}
        onInteract={onInteract}
      />
      <WalkingPlayer
        key={playerName}
        navigation={navigation}
        onBlocked={onBlocked}
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

/**
 * Shown only when the 3D lobby cannot load. It states that plainly and offers the same three real
 * services, so no stand-in room is drawn.
 */
export function BankLobbyFallback({
  bankName,
  onRetry,
  onInteract,
}: {
  bankName: string;
  onRetry?: () => void;
  onInteract: (place: "teller" | "atm" | "seat") => void;
}) {
  return (
    <div
      className="flex min-h-[260px] flex-col items-start justify-center gap-4 rounded-xl border border-border bg-card p-5"
      role="group"
      aria-label={`${bankName} lobby`}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">The 3D lobby could not load.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          You can still use the bank's services from here.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onInteract("teller")}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
        >
          Talk to a bank teller
        </button>
        <button
          type="button"
          onClick={() => onInteract("seat")}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
        >
          Use the waiting area
        </button>
        <button
          type="button"
          onClick={() => onInteract("atm")}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
        >
          Use the ATM
        </button>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            Try the lobby again
          </button>
        )}
      </div>
    </div>
  );
}

function BankCameraFraming() {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    if (!("isOrthographicCamera" in camera)) return;
    camera.zoom = Math.max(10, Math.min(size.width / 15, size.height / 13, 60));
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return null;
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
  const [blocked, setBlocked] = useState(false);
  const [destination, setDestination] = useState<Position>(BANK_ENTRANCE);
  const handleReady = useCallback(() => setSceneReady(true), []);
  const retry = useCallback(() => {
    setSceneFailed(false);
    setSceneReady(false);
  }, []);
  const fallback = (
    <BankLobbyFallback bankName={bankName} onRetry={retry} onInteract={onInteract} />
  );

  useEffect(() => {
    if (sceneReady || sceneFailed) return;
    const timer = window.setTimeout(() => setSceneFailed(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [sceneFailed, sceneReady]);

  if (sceneFailed) return fallback;

  return (
    <div
      data-bank-viewport
      className="relative h-[min(62vh,560px)] min-h-[340px] overflow-hidden rounded-xl border border-border bg-[#e7e2d7] sm:min-h-[420px]"
      aria-label={`${bankName} interactive lobby`}
    >
      {blocked && (
        <p
          role="status"
          className="absolute left-3 top-3 z-10 rounded-lg bg-card p-3 text-sm text-foreground"
        >
          That spot is blocked. Choose a clear floor tile.
        </p>
      )}
      <Scene
        zoom={33}
        onError={() => setSceneFailed(true)}
        fallback={fallback}
        loadingFallback={
          <Html center>
            <WorldLoadingIndicator title="Entering the bank" detail="Preparing the lobby" />
          </Html>
        }
      >
        <BankCameraFraming />
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
          onBlocked={setBlocked}
          onReady={handleReady}
        />
      </Scene>
    </div>
  );
}
