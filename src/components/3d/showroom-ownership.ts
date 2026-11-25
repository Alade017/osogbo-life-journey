/** Tracks committed clones and reservations made before suspending loads.
 * Released requests can still be in flight in the GLTF loader cache; this is
 * a guard for explicit failed-request retries, not a disposal authority. */
export function createShowroomOwnership() {
  const owners = new Map<string, number>();
  function retain(url: string) {
    owners.set(url, (owners.get(url) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const remaining = (owners.get(url) ?? 1) - 1;
      if (remaining === 0) owners.delete(url);
      else owners.set(url, remaining);
    };
  }
  return { retain, canClear: (url: string) => !owners.has(url) };
}
