import { InteractionMarker } from "./InteractionMarker";
import { useEffect, useMemo, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { Box3, Group, LoopOnce, Vector3 } from "three";
import type { VenueFixture } from "@/lib/location-venue-designs";
import { startAnimationInvalidation } from "@/lib/animation-invalidation";
import { environmentModelToStage, environmentStageToModel } from "@/game/environment-navigation";

/** The venue stage's walkable footprint, in metres. Models are scaled down to fit it, never up past 1.25×. */
const STAGE_FOOTPRINT = { x: 9, z: 7 };
const MAX_FIT_SCALE = 1.25;
const HOTSPOT_SIZE: [number, number, number] = [1.3, 1.4, 1.3];
const SHUTTER_FADE_SECONDS = 0.3;

/**
 * A restyled environment model for a venue interior. The model is fitted to the stage and its
 * floor sits at y = 0. Each feature is an invisible click target over its position. A model
 * with a `trading` shutter plays its open or close clip when `open` changes.
 */
export function VenueEnvironment({
  url,
  open,
  fixtures,
  activeId,
  accentColor,
  onSelect,
  onWalk,
  onTransform,
}: {
  url: string;
  /** Undefined for a model without a shutter. */
  open?: boolean | undefined;
  fixtures: readonly VenueFixture[];
  activeId: string;
  accentColor: string;
  onSelect: (id: string) => void;
  onWalk: (point: [number, number]) => void;
  onTransform: (scaleX: number, scaleZ: number) => void;
}) {
  const gltf = useGLTF(url);
  const { invalidate } = useThree();
  const root = useRef<Group>(null);
  const holder = useMemo(() => {
    const group = new Group();
    group.add(gltf.scene.clone(true));
    const raw = new Box3().setFromObject(group).getSize(new Vector3());
    const fit = Math.min(STAGE_FOOTPRINT.x / raw.x, STAGE_FOOTPRINT.z / raw.z, MAX_FIT_SCALE);
    group.scale.setScalar(fit);
    group.updateMatrixWorld(true);
    const placed = new Box3().setFromObject(group);
    const centre = placed.getCenter(new Vector3());
    const size = placed.getSize(new Vector3());
    group.position.set(-centre.x, -placed.min.y, -centre.z);
    return { group, half: { x: size.x / 2, z: size.z / 2 } };
  }, [gltf]);

  const scaleX = holder.half.x / (STAGE_FOOTPRINT.x / 2);
  const scaleZ = holder.half.z / (STAGE_FOOTPRINT.z / 2);

  useEffect(() => {
    onTransform(scaleX, scaleZ);
  }, [onTransform, scaleX, scaleZ]);

  const { actions } = useAnimations(gltf.animations, root);
  const shuttered = open !== undefined;
  const started = useRef(false);

  useEffect(() => {
    if (!shuttered) return;
    const name = open ? "open" : "close";
    const action = actions[name];
    if (!action) return;
    const clip = action.getClip();
    action.reset().setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    if (!started.current) {
      // First frame: show the shutter in its current state without animating it.
      started.current = true;
      action.time = clip.duration;
      action.play();
      invalidate();
      return;
    }
    action.fadeIn(SHUTTER_FADE_SECONDS).play();
    actions[open ? "close" : "open"]?.fadeOut(SHUTTER_FADE_SECONDS);
    return startAnimationInvalidation({
      action,
      invalidate,
      fadeSeconds: SHUTTER_FADE_SECONDS,
    });
  }, [actions, open, shuttered, invalidate]);

  return (
    <group
      ref={root}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        if (event.delta <= 5) {
          event.stopPropagation();
          onWalk(environmentModelToStage([event.point.x, event.point.z], scaleX, scaleZ));
        }
      }}
    >
      <primitive object={holder.group} />
      <mesh position={[0, 0.035, 0]}>
        <planeGeometry args={[holder.half.x * 2, holder.half.z * 2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {fixtures.map((fixture) => {
        // Features are laid out for the full stage; scale them into the model's own footprint.
        const [x, z] = environmentStageToModel(fixture.position, scaleX, scaleZ);
        const active = fixture.id === activeId;
        return (
          <group key={fixture.id}>
            <InteractionMarker
              position={[x, 0.025, z]}
              color={accentColor}
              selected={active}
              radius={0.66}
            />
            <mesh
              position={[x, HOTSPOT_SIZE[1] / 2, z]}
              onClick={(event: ThreeEvent<MouseEvent>) => {
                event.stopPropagation();
                onSelect(fixture.id);
              }}
            >
              <boxGeometry args={HOTSPOT_SIZE} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
