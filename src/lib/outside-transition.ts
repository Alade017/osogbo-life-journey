import { useSyncExternalStore } from "react";

/** Moving between the home and the neighbourhood. Progress advances only on real load events. */
export type TransitionKind = "leaving" | "entering";

export type TransitionState = {
  kind: TransitionKind | null;
  label: string;
  done: number;
  total: number;
};

const IDLE: TransitionState = { kind: null, label: "", done: 0, total: 0 };
let state: TransitionState = IDLE;
const listeners = new Set<() => void>();

function emit(next: TransitionState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function beginTransition(kind: TransitionKind, label: string, total: number) {
  emit({ kind, label, done: 0, total: Math.max(1, total) });
}

/** Marks one more real step complete. The label names the step now in progress. */
export function completeTransitionStep(label?: string) {
  if (!state.kind) return;
  emit({
    ...state,
    done: Math.min(state.total, state.done + 1),
    label: label ?? state.label,
  });
}

/** The transition currently running, read outside React (for cleanup when a page unmounts). */
export function currentTransitionKind(): TransitionKind | null {
  return state.kind;
}

export function endTransition() {
  emit(IDLE);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

export function useOutsideTransition(): TransitionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
