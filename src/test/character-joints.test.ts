import { describe, expect, it } from "vitest";
import { BONE } from "@/components/3d/humanoid-pose";
import { createHumanoid } from "@/components/3d/humanoid-rig";

describe("connected body joints", () => {
  it.each(
    (["male", "female"] as const).flatMap((variant) =>
      [0, 1, 2, 3].map((build) => ({ variant, build })),
    ),
  )(
    "keeps $variant build $build torso, arms, hands, legs and feet in one closed surface",
    ({ variant, build }) => {
      const rig = createHumanoid({ variant, build, skinColor: "#754c32", hairColor: null });
      const geometry = rig.meshes[0]!.geometry;
      const positions = geometry.getAttribute("position"),
        bones = geometry.getAttribute("skinIndex"),
        weights = geometry.getAttribute("skinWeight");
      const keys = new Map<string, number>(),
        parent: number[] = [],
        source: number[] = [];
      function root(i: number): number {
        while (parent[i] !== i) {
          parent[i] = parent[parent[i]!]!;
          i = parent[i]!;
        }
        return i;
      }
      for (let i = 0; i < positions.count; i++) {
        const values = [
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i),
          ...Array.from({ length: 4 }, (_, j) => bones.getComponent(i, j)),
          ...Array.from({ length: 4 }, (_, j) => weights.getComponent(i, j)),
        ];
        const key = values.map((v) => v.toFixed(6)).join(":");
        if (!keys.has(key)) {
          keys.set(key, parent.length);
          parent.push(parent.length);
        }
        source.push(keys.get(key)!);
      }
      for (let i = 0; i < source.length; i += 3) {
        const a = root(source[i]!);
        parent[root(source[i + 1]!)] = a;
        parent[root(source[i + 2]!)] = a;
      }
      const counts = new Map<number, number>();
      source.forEach((id) => counts.set(root(id), (counts.get(root(id)) ?? 0) + 1));
      const core = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
      const edges = new Map<string, { count: number; direction: number }>();
      const influenced = new Set<string>();
      for (let i = 0; i < source.length; i += 3) {
        if (root(source[i]!) !== core) continue;
        const tri = source.slice(i, i + 3);
        expect(new Set(tri).size).toBe(3);
        for (let j = 0; j < 3; j++) {
          const a = tri[j]!,
            b = tri[(j + 1) % 3]!;
          const key = [Math.min(a, b), Math.max(a, b)].join(":");
          const edge = edges.get(key) ?? { count: 0, direction: 0 };
          edge.count++;
          edge.direction += a < b ? 1 : -1;
          edges.set(key, edge);
          for (let k = 0; k < 4; k++)
            if (weights.getComponent(i + j, k) > 0.01)
              influenced.add(rig.bones[bones.getComponent(i + j, k)]!.name);
        }
      }
      for (const edge of edges.values()) {
        expect(edge.count).toBe(2);
        expect(edge.direction).toBe(0);
      }
      for (const name of [
        BONE.root,
        BONE.spine2,
        BONE.lUpperArm,
        BONE.rUpperArm,
        BONE.lForearm,
        BONE.rForearm,
        BONE.lHand,
        BONE.rHand,
        BONE.lThigh,
        BONE.rThigh,
        BONE.lCalf,
        BONE.rCalf,
        BONE.lFoot,
        BONE.rFoot,
      ])
        expect(influenced).toContain(name);
    },
  );
});
