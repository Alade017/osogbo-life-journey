import { useLayoutEffect, useMemo, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Group, type OrthographicCamera } from "three";
import type { OrbitControls } from "three-stdlib";
import type { BankWorldLayout } from "@/game/bank-world-layout";
import {
  bankSceneBounds,
  fitBankView,
  BANK_CAMERA_MAX_ZOOM,
  type BankViewInsets,
} from "./bank-camera-framing";

export function BankCameraRig({
  layout,
  frame,
  player,
  resetToken,
  follow,
}: {
  layout: BankWorldLayout;
  frame: RefObject<HTMLDivElement | null>;
  player: RefObject<Group | null>;
  resetToken: number;
  follow: boolean;
}) {
  const { camera, controls: rawControls, size, invalidate } = useThree();
  const controls = rawControls as OrbitControls | undefined;
  const bounds = useMemo(() => bankSceneBounds(layout), [layout]);
  const delta = useMemo(() => new Vector3(), []);
  const [insets, setInsets] = useState<BankViewInsets>({
    top: 16,
    bottom: 16,
    left: 16,
    right: 16,
  });
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const shell = element.closest(".game-shell") ?? element;
    let observer: ResizeObserver | null = null;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const next = { top: 16, bottom: 16, left: 16, right: 16 };
      for (const entry of shell.querySelectorAll(
        ".world-environment,.bank-world > header,.bank-world-status,.bank-scene-message",
      )) {
        observer?.observe(entry);
        const r = entry.getBoundingClientRect();
        if (r.width && r.height) next.top = Math.max(next.top, r.bottom - rect.top + 12);
      }
      for (const entry of shell.querySelectorAll(".bank-world-controls,.game-needs-rail,.gbb")) {
        observer?.observe(entry);
        const r = entry.getBoundingClientRect();
        if (r.width && r.height) next.bottom = Math.max(next.bottom, rect.bottom - r.top + 12);
      }
      setInsets((old) => (old.top === next.top && old.bottom === next.bottom ? old : next));
    };
    observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    const mutations = new MutationObserver(measure);
    mutations.observe(shell, { childList: true, subtree: true });
    measure();
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [frame, layout]);
  useLayoutEffect(() => {
    if (!("isOrthographicCamera" in camera) || !size.width || !size.height || !controls) return;
    const orthographic = camera as OrthographicCamera;
    const fit = fitBankView(orthographic, bounds, size.width, size.height, insets);
    orthographic.position.copy(fit.position);
    orthographic.zoom = fit.zoom;
    orthographic.far = fit.far;
    controls.target.copy(fit.target);
    controls.minZoom = Math.min(2, fit.zoom);
    controls.maxZoom = BANK_CAMERA_MAX_ZOOM;
    controls.update();
    orthographic.updateProjectionMatrix();
    invalidate();
  }, [camera, controls, bounds, size.width, size.height, insets, resetToken, invalidate]);
  useLayoutEffect(() => {
    if (follow && "isOrthographicCamera" in camera) {
      const orthographic = camera as OrthographicCamera;
      orthographic.zoom = Math.min(BANK_CAMERA_MAX_ZOOM, Math.max(orthographic.zoom, 20));
      orthographic.updateProjectionMatrix();
      invalidate();
    }
  }, [follow, camera, invalidate]);
  useFrame(() => {
    if (!follow || !controls || !player.current) return;
    delta.copy(player.current.position);
    delta.y += 1;
    delta.sub(controls.target);
    if (delta.lengthSq() < 0.000001) return;
    controls.target.add(delta);
    camera.position.add(delta);
    controls.update();
    invalidate();
  });
  return null;
}
