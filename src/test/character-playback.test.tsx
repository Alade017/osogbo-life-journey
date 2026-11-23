import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Vector3 } from "three";
import { CharacterBody } from "@/components/3d/CharacterBody";
import { BONE, type PoseMotion } from "@/components/3d/humanoid-pose";
import type { Humanoid } from "@/components/3d/humanoid-rig";
const runtime = vi.hoisted(() => ({
  frame: null as null | ((state: { clock: { elapsedTime: number } }, delta: number) => void),
  invalidate: vi.fn(),
  rigs: [] as Humanoid[],
  portals: [] as unknown[],
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (fn: typeof runtime.frame) => {
    runtime.frame = fn;
  },
  useThree: () => ({ invalidate: runtime.invalidate }),
  createPortal: (_children: unknown, target: unknown) => {
    runtime.portals.push(target);
    return null;
  },
}));
vi.mock("@/components/3d/CharacterWardrobe", () => ({ CharacterWardrobe: () => null }));
vi.mock("@/components/3d/ProceduralHeadwear", () => ({ ProceduralHeadwear: () => null }));
vi.mock("@/components/3d/humanoid-rig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/3d/humanoid-rig")>();
  return {
    ...actual,
    createHumanoid: (...args: Parameters<typeof actual.createHumanoid>) => {
      const rig = actual.createHumanoid(...args);
      runtime.rigs.push(rig);
      return rig;
    },
  };
});
beforeEach(() => {
  runtime.rigs.length = 0;
  runtime.portals.length = 0;
  runtime.frame = null;
  runtime.invalidate.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function play(seconds = 2) {
  for (let i = 0; i < seconds * 60; i++) runtime.frame!({ clock: { elapsedTime: i / 60 } }, 1 / 60);
  const rig = runtime.rigs.at(-1)!;
  rig.root.updateMatrixWorld(true);
  rig.meshes[0]!.skeleton.update();
  return rig;
}
function point(rig: Humanoid, name: string) {
  return rig.byName.get(name)!.getWorldPosition(new Vector3());
}
const motions: PoseMotion[] = [
  "Idle",
  "Walk",
  "Work",
  "Talk",
  "Interact",
  "Sit",
  "Wash",
  "Cook",
  "Collect",
  "Stretch",
  "Dance",
];
describe("upgraded character frame playback", () => {
  it.each(
    (["male", "female", "business"] as const).flatMap((variant) =>
      motions.map((motion) => ({ variant, motion })),
    ),
  )(
    "plays $variant $motion on the real rig without invalid or collapsed skinned vertices",
    ({ variant, motion }) => {
      render(<CharacterBody variant={variant} height={1} motion={motion} />);
      const rig = play();
      const skin = rig.meshes[0]!;
      const positions = skin.geometry.getAttribute("position");
      const v = new Vector3();
      let minY = Infinity,
        maxY = -Infinity;
      for (let i = 0; i < positions.count; i += 17) {
        v.fromBufferAttribute(positions, i);
        skin.applyBoneTransform(i, v);
        expect(v.toArray().every(Number.isFinite)).toBe(true);
        minY = Math.min(minY, v.y);
        maxY = Math.max(maxY, v.y);
      }
      expect(maxY - minY).toBeGreaterThan(0.45);
      expect(maxY - minY).toBeLessThan(1.5);
      expect(runtime.invalidate).toHaveBeenCalled();
    },
  );
  it.each(["Work", "Interact", "Wash", "Cook", "Collect"] as const)(
    "moves %s hands toward the face's +Z direction",
    (motion) => {
      render(<CharacterBody variant="male" height={1} motion={motion} />);
      const rig = play();
      expect(point(rig, BONE.rHand).z).toBeGreaterThan(point(rig, BONE.spine2).z + 0.1);
    },
  );
  it("sits with the knees forward and resets the same rig when returning to idle", () => {
    const { rerender } = render(<CharacterBody variant="male" height={1} motion="Walk" />);
    play();
    const rig = runtime.rigs[0]!;
    rerender(<CharacterBody variant="male" height={1} motion="Sit" />);
    play();
    expect(point(rig, BONE.rCalf).z).toBeGreaterThan(point(rig, BONE.root).z + 0.15);
    rerender(<CharacterBody variant="male" height={1} motion="Idle" />);
    play();
    expect(runtime.rigs).toHaveLength(1);
    expect(Math.abs(point(rig, BONE.rCalf).z)).toBeLessThan(0.005);
    expect(Math.abs(point(rig, BONE.rFoot).z)).toBeLessThan(0.005);
  });
});

it("stops requesting idle frames after settling and resumes when walking", () => {
  const view = render(<CharacterBody variant="male" height={1} motion="Idle" />);
  play(3);

  runtime.invalidate.mockClear();
  play(1);
  expect(runtime.invalidate).not.toHaveBeenCalled();

  view.rerender(<CharacterBody variant="male" height={1} motion="Walk" />);
  runtime.invalidate.mockClear();
  play(1);
  expect(runtime.invalidate).toHaveBeenCalled();
});

it("settles a reduced-motion idle pose without scheduling an endless animation loop", () => {
  render(<CharacterBody variant="male" height={1} motion="Idle" animated={false} />);
  const rig = play(3);
  const initial = rig.byName.get(BONE.head)!.quaternion.clone();
  runtime.invalidate.mockClear();
  runtime.frame!({ clock: { elapsedTime: 100 } }, 1 / 60);
  expect(runtime.invalidate).not.toHaveBeenCalled();
  expect(rig.byName.get(BONE.head)!.quaternion.angleTo(initial)).toBeLessThan(0.0001);
});

it.each(["male", "female"] as const)(
  "keeps %s dancing on a demand canvas and blends back to idle",
  (variant) => {
    const view = render(<CharacterBody variant={variant} height={1} motion="Dance" />);
    play(4);
    for (let i = 0; i < 120; i++) {
      runtime.invalidate.mockClear();
      runtime.frame!({ clock: { elapsedTime: 4 + i / 60 } }, 1 / 60);
      expect(runtime.invalidate).toHaveBeenCalled();
    }
    const rig = runtime.rigs[0]!;
    view.rerender(<CharacterBody variant={variant} height={1} motion="Idle" />);
    play(3);
    expect(runtime.rigs).toHaveLength(1);
    expect(Math.abs(rig.byName.get(BONE.root)!.rotation.y)).toBeLessThan(0.001);
  },
);

it("holds a still dance pose with reduced motion", () => {
  render(<CharacterBody variant="female" height={1} motion="Dance" animated={false} />);
  const rig = play(3),
    hand = point(rig, BONE.rHand).clone();
  runtime.invalidate.mockClear();
  runtime.frame!({ clock: { elapsedTime: 99 } }, 1 / 60);
  rig.root.updateMatrixWorld(true);
  expect(runtime.invalidate).not.toHaveBeenCalled();
  expect(point(rig, BONE.rHand).distanceTo(hand)).toBeLessThan(0.001);
});

it("attaches worn back accessories to the animated upper spine", () => {
  render(
    <CharacterBody
      variant="male"
      height={1}
      motion="Walk"
      backAccessory={<group name="test-backpack" />}
    />,
  );
  const rig = runtime.rigs[0]!;
  expect(runtime.portals).toContain(rig.byName.get(BONE.spine2));
});
