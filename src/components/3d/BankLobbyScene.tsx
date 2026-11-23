import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group } from "three";
import { Scene } from "./Scene";
import { WorldCharacter } from "./WorldCharacter";
import { ProceduralBankArchitecture } from "./ProceduralBankArchitecture";
import {
  BANK_WORLD,
  bankObstaclePolygons,
  buildBankWorld,
  type BankArea,
  type BankFixture,
  type BankWorldLayout,
} from "@/game/bank-world-layout";
import { createBankNavigation } from "@/game/bank-lobby-navigation";
import { createWalker, stepWalker, type MallWalker } from "@/game/mall-movement";
import type { WalkPoint } from "@/game/grid-walk-path";
import type { Appearance } from "@/game/avatar-appearance";
import { BANK_BRANCH_STAFF, type BankSlug } from "@/lib/bank-branch-data";

type OnlineBankPlayer = { characterId: string; name: string };
type Command = { id: string; serial: number } | null;
type Interaction = "teller" | "atm" | "seat";

function BankCameraFraming({ layout }: { layout: BankWorldLayout }) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    if (!("isOrthographicCamera" in camera)) return;
    camera.zoom = Math.max(
      2,
      Math.min(
        size.width / ((layout.width + layout.depth) * 0.78),
        size.height / ((layout.width + layout.depth) * 0.64),
        40,
      ),
    );
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, layout, invalidate]);
  return null;
}
function BankWorld({
  branch,
  layout,
  command,
  scanning,
  interactionBlocked,
  reducedMotion,
  playerName,
  appearance,
  gender,
  players,
  onSelect,
  onArrive,
  onMessage,
  onPosition,
  onReady,
}: {
  branch: BankSlug;
  layout: BankWorldLayout;
  command: Command;
  scanning: boolean;
  interactionBlocked: boolean;
  reducedMotion: boolean;
  playerName: string;
  appearance: Appearance;
  gender: string;
  players: OnlineBankPlayer[];
  onSelect: (id: string) => void;
  onArrive: (fixture: BankFixture) => void;
  onMessage: (message: string) => void;
  onPosition: (position: WalkPoint) => void;
  onReady: () => void;
}) {
  const navigation = useMemo(
    () =>
      createBankNavigation(bankObstaclePolygons(layout), {
        halfWidth: layout.width / 2,
        halfDepth: layout.depth / 2,
      }),
    [layout],
  );
  const consumedCommand = useRef<number | null>(null);
  const group = useRef<Group>(null),
    walker = useRef<MallWalker | null>(null),
    pending = useRef<BankFixture | null>(null);
  const [walking, setWalking] = useState(false),
    { invalidate } = useThree();
  const spawn = useMemo(() => navigation.nearest(layout.spawn), [navigation, layout]);
  useLayoutEffect(() => {
    if (!spawn) throw new Error("The bank entrance has no clear standing space.");
    group.current?.position.set(spawn[0], 0.04, spawn[1]);
    onPosition(spawn);
    invalidate();
  }, [spawn, onPosition, invalidate]);
  useEffect(onReady, [onReady]);
  useEffect(() => {
    if (!interactionBlocked) return;
    walker.current = null;
    pending.current = null;
    setWalking(false);
  }, [interactionBlocked]);
  const startWalk = useCallback(
    (target: WalkPoint, fixture: BankFixture | null) => {
      const current = group.current?.position;
      if (!current || scanning || interactionBlocked) return;
      const path = navigation.route([current.x, current.z], target);
      walker.current = null;
      pending.current = null;
      setWalking(false);
      if (!path) {
        onMessage("That route is blocked. Choose a clear floor tile or another approach.");
        return;
      }
      onMessage("");
      if (reducedMotion || Math.hypot(current.x - target[0], current.z - target[1]) < 0.05) {
        current.set(target[0], 0.04, target[1]);
        onPosition(target);
        if (fixture) onArrive(fixture);
        invalidate();
        return;
      }
      const points = path.filter(
        (point, index) =>
          index > 0 && Math.hypot(point[0] - current.x, point[1] - current.z) > 0.01,
      );
      walker.current = createWalker([current.x, current.z], points);
      pending.current = fixture;
      setWalking(true);
      invalidate();
    },
    [
      navigation,
      scanning,
      interactionBlocked,
      reducedMotion,
      onMessage,
      onPosition,
      onArrive,
      invalidate,
    ],
  );
  useEffect(() => {
    if (!command || scanning || consumedCommand.current === command.serial) return;
    consumedCommand.current = command.serial;
    const fixture = layout.fixtures.find((item) => item.id === command.id);
    if (fixture) startWalk(fixture.point, fixture);
  }, [command, layout, startWalk, scanning]);
  useFrame((_, delta) => {
    if (!walker.current || walker.current.done || !group.current) return;
    const previous = walker.current.pos,
      next = stepWalker(walker.current, Math.min(delta, 0.1));
    walker.current = next;
    group.current.position.set(next.pos[0], 0.04, next.pos[1]);
    onPosition(next.pos);
    const dx = next.pos[0] - previous[0],
      dz = next.pos[1] - previous[1];
    if (Math.hypot(dx, dz) > 0.0001) group.current.rotation.y = Math.atan2(dx, dz);
    if (next.done) {
      setWalking(false);
      const fixture = pending.current;
      pending.current = null;
      if (fixture) onArrive(fixture);
    } else invalidate();
  });
  const people = useMemo(() => {
    if (layout.area !== "hall") return [];
    const occupied: WalkPoint[] = [spawn ?? layout.spawn];
    const staff = BANK_BRANCH_STAFF[branch];
    const targets = [
      ...staff.map((person, i) => ({
        key: person.id,
        name: person.name,
        appearance: person.appearance,
        target: [i === 0 ? -5 : i === 1 ? 5 : -8, i < 2 ? -9 : 7] as WalkPoint,
      })),
      ...players.slice(0, 5).map((person, i) => ({
        key: person.characterId,
        name: person.name,
        appearance: {} as Appearance,
        target: [-4 + i * 1.5, 3] as WalkPoint,
      })),
    ];
    return targets.flatMap((person) => {
      const position = navigation.nearest(person.target, occupied);
      if (!position) return [];
      occupied.push(position);
      return [{ ...person, position }];
    });
  }, [layout, branch, players, navigation, spawn]);
  return (
    <>
      <BankCameraFraming layout={layout} />
      <ProceduralBankArchitecture
        branch={branch}
        layout={layout}
        doorsOpen={!scanning}
        onSelect={onSelect}
        onWalk={(point) => startWalk([point[0], point[2]], null)}
      />
      <group ref={group}>
        <WorldCharacter
          name={playerName}
          appearance={appearance}
          gender={gender}
          position={[0, 0, 0]}
          animation={walking ? "walk" : "idle"}
        />
      </group>
      {people.map((person) => (
        <WorldCharacter
          key={person.key}
          name={person.name}
          appearance={person.appearance}
          position={[person.position[0], 0.04, person.position[1]]}
          facing="south"
          animation="idle"
        />
      ))}
    </>
  );
}
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

/** Confirmed branch arrivals open directly in the working hall. All bank architecture is code-built. */
export function BankLobbyScene({
  branch,
  bankName,
  players,
  playerName,
  appearance,
  gender,
  reducedMotion = false,
  interactionBlocked = false,
  onInteract,
}: {
  branch: BankSlug;
  bankName: string;
  players: OnlineBankPlayer[];
  playerName: string;
  appearance: Appearance;
  gender: string;
  reducedMotion?: boolean;
  interactionBlocked?: boolean;
  onInteract: (place: Interaction) => void;
}) {
  const [area, setArea] = useState<BankArea>("hall"),
    [scanning, setScanning] = useState(!reducedMotion);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [message, setMessage] = useState("");
  const [command, setCommand] = useState<Command>(null);
  const position = useRef<WalkPoint>([0, 0]);
  const [arrivalFrom, setArrivalFrom] = useState<BankArea | undefined>();
  const layout = useMemo(
    () => buildBankWorld(branch, area, arrivalFrom),
    [branch, area, arrivalFrom],
  );
  const handleReady = useCallback(() => setReady(true), []);
  const handlePosition = useCallback((point: WalkPoint) => {
    position.current = point;
  }, []);
  const select = useCallback(
    (id: string) => {
      if (interactionBlocked) return;
      setCommand((previous) => ({ id, serial: (previous?.serial ?? 0) + 1 }));
    },
    [interactionBlocked],
  );
  const arrive = useCallback(
    (fixture: BankFixture) => {
      if (
        fixture.action === "hall" ||
        fixture.action === "grounds" ||
        fixture.action === "upstairs"
      ) {
        setCommand(null);
        setMessage("");
        setArrivalFrom(area);
        setArea(fixture.action);
        setScanning(fixture.action === "hall" && area === "grounds" && !reducedMotion);
      } else onInteract(fixture.action);
    },
    [onInteract, area, reducedMotion],
  );
  useEffect(() => {
    if (!scanning || !ready) return;
    const timer = window.setTimeout(() => {
      setScanning(false);
      setMessage("Security scan complete. Tap a clear floor tile to walk.");
    }, BANK_WORLD.scanMilliseconds);
    return () => window.clearTimeout(timer);
  }, [scanning, ready]);
  useEffect(() => {
    const interact = (event: KeyboardEvent) => {
      if (
        event.code !== "KeyE" ||
        event.repeat ||
        scanning ||
        interactionBlocked ||
        (event.target instanceof HTMLElement &&
          event.target.closest("input,textarea,select,button"))
      )
        return;
      const nearest = [...layout.fixtures].sort(
        (a, b) =>
          Math.hypot(a.point[0] - position.current[0], a.point[1] - position.current[1]) -
          Math.hypot(b.point[0] - position.current[0], b.point[1] - position.current[1]),
      )[0];
      if (
        nearest &&
        Math.hypot(
          nearest.point[0] - position.current[0],
          nearest.point[1] - position.current[1],
        ) <= 2.5
      ) {
        event.preventDefault();
        select(nearest.id);
      } else setMessage("Walk closer to a teller, ATM, door or staircase to interact.");
    };
    window.addEventListener("keydown", interact);
    return () => window.removeEventListener("keydown", interact);
  }, [layout, scanning, interactionBlocked, select]);
  if (failed)
    return (
      <BankLobbyFallback
        bankName={bankName}
        onRetry={() => setFailed(false)}
        onInteract={onInteract}
      />
    );
  const navigation =
    area === "hall"
      ? [
          ["exit", "Courtyard & ATMs"],
          ["stairs", "Upstairs customer care"],
        ]
      : area === "grounds"
        ? [["entrance", "Enter banking hall"]]
        : [["stairs", "Downstairs banking hall"]];
  return (
    <div
      data-bank-viewport
      className="relative h-[min(75vh,720px)] min-h-[400px] overflow-hidden rounded-xl bg-card"
      aria-label={`${bankName} interactive ${area}`}
    >
      <Scene
        minZoom={2}
        zoom={12}
        onError={() => setFailed(true)}
        fallback={<BankLobbyFallback bankName={bankName} onInteract={onInteract} />}
      >
        <BankWorld
          key={area}
          branch={branch}
          layout={layout}
          command={command}
          scanning={scanning}
          interactionBlocked={interactionBlocked}
          reducedMotion={reducedMotion}
          playerName={playerName}
          appearance={appearance}
          gender={gender}
          players={players}
          onSelect={select}
          onArrive={arrive}
          onMessage={setMessage}
          onPosition={handlePosition}
          onReady={handleReady}
        />
      </Scene>
      <div className="bank-world-controls" role="group" aria-label="Bank scene controls">
        <strong>
          {area === "hall"
            ? "Banking hall"
            : area === "upstairs"
              ? "First floor · Customer care"
              : "Courtyard · ATM gallery"}
        </strong>
        <div className="flex flex-wrap gap-2">
          {navigation.map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={scanning || interactionBlocked}
              onClick={() => select(id!)}
            >
              {label}
            </button>
          ))}
        </div>
        <details>
          <summary>Accessible scene actions</summary>
          <div className="grid gap-2 pt-2">
            {layout.fixtures
              .filter(
                (item) =>
                  !item.id.startsWith("seat-") ||
                  item.id === layout.fixtures.find((f) => f.action === "seat")?.id,
              )
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={scanning || interactionBlocked}
                  onClick={() => select(item.id)}
                >
                  {item.label}
                </button>
              ))}
          </div>
        </details>
      </div>
      {(scanning || message) && (
        <p className="bank-scene-message" role="status">
          {scanning ? "Security scan…" : message}
        </p>
      )}
    </div>
  );
}
