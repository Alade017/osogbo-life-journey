import { useSyncExternalStore } from "react";

const thumbnails = new Map<string, string>();
const listeners = new Set<() => void>();

export function setItemThumbnail(slug: string, url: string) {
  thumbnails.set(slug, url);
  listeners.forEach((notify) => notify());
}

export function hasItemThumbnail(slug: string): boolean {
  return thumbnails.has(slug);
}

/** The rendered image for an item, or null until its thumbnail has been made. */
export function useItemThumbnail(slug: string | null | undefined): string | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => (slug ? (thumbnails.get(slug) ?? null) : null),
    () => null,
  );
}
