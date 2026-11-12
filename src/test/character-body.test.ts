import { describe, expect, it } from "vitest";
import { AnimationClip, QuaternionKeyframeTrack } from "three";
import { motionFor, retargetClips } from "@/components/3d/CharacterBody";

function clip(name: string, nodes: string[]) {
  const tracks = nodes.map(
    (node) => new QuaternionKeyframeTrack(`${node}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
  );
  return new AnimationClip(name, 1, tracks);
}

describe("motionFor", () => {
  it("walks whenever the character is moving", () => {
    expect(motionFor("idle", true)).toBe("Walk");
    expect(motionFor("work", true)).toBe("Walk");
  });

  it("maps the standing states to their clips", () => {
    expect(motionFor("work", false)).toBe("Work");
    expect(motionFor("interact", false)).toBe("Work");
    expect(motionFor("talk", false)).toBe("Talk");
    expect(motionFor("idle", false)).toBe("Idle");
    expect(motionFor("sleep", false)).toBe("Idle");
  });
});

describe("retargetClips", () => {
  const bones = new Set(["Bip01 Pelvis", "Bip01 Head"]);

  it("keeps only tracks whose bones exist on the rig", () => {
    const [walk] = retargetClips([clip("Walk", ["Bip01 Pelvis", "Bip01 REye"])], [], bones);
    expect(walk!.tracks.map((track) => track.name)).toEqual(["Bip01 Pelvis.quaternion"]);
  });

  it("adds the talk gesture under the Talk name", () => {
    const clips = retargetClips([], [clip("Take 001", ["Bip01 Head"])], bones);
    expect(clips.map((c) => c.name)).toEqual(["Talk"]);
    expect(clips[0]!.tracks).toHaveLength(1);
  });

  it("does not change the source clips", () => {
    const source = clip("Idle", ["Bip01 REye", "Bip01 Head"]);
    retargetClips([source], [], bones);
    expect(source.tracks).toHaveLength(2);
  });
});
