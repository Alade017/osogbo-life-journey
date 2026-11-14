import { describe, expect, it } from "vitest";
import {
  NeighborhoodCheckpoints,
  checkpointChanged,
  type CheckpointPoint,
  type CheckpointTarget,
} from "../../multiplayer/neighborhood-checkpoints.ts";
const target: CheckpointTarget = {
  userId: "u1",
  characterId: "c1",
  locationId: "l1",
};
/** Lets queued promise callbacks run before the test looks at their effects. */
function flush() {
  return new Promise<void>((done) => setTimeout(done, 0));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe("neighbourhood checkpoint manager", () => {
  it("skips positions that match the last saved point", async () => {
    const writes: CheckpointPoint[] = [];
    const manager = new NeighborhoodCheckpoints(async (_t, point) => {
      writes.push(point);
      return true;
    });
    manager.track("s1", target, { x: 3, y: 4 });
    await manager.save("s1", { x: 3, y: 4 });
    expect(writes).toEqual([]);
  });
  it("saves a changed position once and then skips it", async () => {
    const writes: CheckpointPoint[] = [];
    const manager = new NeighborhoodCheckpoints(async (_t, point) => {
      writes.push(point);
      return true;
    });
    manager.track("s1", target, { x: 3, y: 4 });
    await manager.save("s1", { x: 5, y: 4 });
    await manager.save("s1", { x: 5, y: 4 });
    expect(writes).toEqual([{ x: 5, y: 4 }]);
  });
  it("never overlaps writes for the same session", async () => {
    let active = 0;
    let maxActive = 0;
    const gates: Array<() => void> = [];
    const manager = new NeighborhoodCheckpoints(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      const gate = deferred<void>();
      gates.push(() => gate.resolve());
      await gate.promise;
      active -= 1;
      return true;
    });
    manager.track("s1", target, null);
    const first = manager.save("s1", { x: 1, y: 1 });
    const second = manager.save("s1", { x: 2, y: 2 }, { skipIfBusy: true });
    const leave = manager.release("s1", { x: 9, y: 9 });
    await flush();
    expect(gates).toHaveLength(1);
    gates[0]!();
    await first;
    await second;
    await flush();
    expect(gates).toHaveLength(2);
    gates[1]!();
    await leave;
    expect(maxActive).toBe(1);
  });
  it("skips the periodic pass while a write is pending, but still saves at leave", async () => {
    const writes: CheckpointPoint[] = [];
    const gate = deferred<void>();
    const manager = new NeighborhoodCheckpoints(async (_t, point) => {
      writes.push(point);
      await gate.promise;
      return true;
    });
    manager.track("s1", target, null);
    const first = manager.save("s1", { x: 1, y: 1 });
    manager.saveAll(() => ({ x: 2, y: 2 }));
    await flush();
    expect(writes).toEqual([{ x: 1, y: 1 }]);
    const leave = manager.release("s1", { x: 7, y: 7 });
    gate.resolve();
    await first;
    await leave;
    expect(writes).toEqual([
      { x: 1, y: 1 },
      { x: 7, y: 7 },
    ]);
  });
  it("stops saving a session once the database reports the character is no longer eligible", async () => {
    const writes: CheckpointPoint[] = [];
    const manager = new NeighborhoodCheckpoints(async (_t, point) => {
      writes.push(point);
      return false;
    });
    manager.track("s1", target, null);
    await manager.save("s1", { x: 1, y: 1 });
    await manager.save("s1", { x: 2, y: 2 });
    expect(writes).toEqual([{ x: 1, y: 1 }]);
  });
  it("reports failures without throwing and keeps the session for a retry", async () => {
    const reports: string[] = [];
    let attempts = 0;
    const manager = new NeighborhoodCheckpoints(
      async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("secret-key-value");
        return true;
      },
      (message) => reports.push(message),
    );
    manager.track("s1", target, null);
    await manager.save("s1", { x: 1, y: 1 });
    expect(reports).toEqual(["Neighbourhood checkpoint could not be saved; it will be retried."]);
    expect(reports.join(" ")).not.toContain("secret-key-value");
    await manager.save("s1", { x: 1, y: 1 });
    expect(attempts).toBe(2);
  });
  it("forgets sessions on release and on dispose", async () => {
    const manager = new NeighborhoodCheckpoints(async () => true);
    manager.track("s1", target, null);
    manager.track("s2", target, null);
    await manager.release("s1", { x: 1, y: 1 });
    expect(manager.trackedCount).toBe(1);
    await manager.dispose();
    expect(manager.trackedCount).toBe(0);
  });
  it("waits for a released final checkpoint when the room is disposed", async () => {
    const gate = deferred<void>();
    const writes: CheckpointPoint[] = [];
    const manager = new NeighborhoodCheckpoints(async (_t, point) => {
      writes.push(point);
      await gate.promise;
      return true;
    });
    manager.track("s1", target, null);
    const leave = manager.release("s1", { x: 8, y: 9 });
    expect(manager.trackedCount).toBe(0);
    let disposed = false;
    const disposal = manager.dispose().then(() => {
      disposed = true;
    });
    await flush();
    expect(writes).toEqual([{ x: 8, y: 9 }]);
    expect(disposed).toBe(false);
    gate.resolve();
    await Promise.all([leave, disposal]);
    expect(disposed).toBe(true);
  });
  it("treats an unknown saved point as changed", () => {
    expect(checkpointChanged(null, { x: 0, y: 0 })).toBe(true);
    expect(checkpointChanged({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(false);
  }); 
  it("saves the final position when it matches the previous saved point but an update is pending", async () => {
    const gate = deferred<void>();
    const writes: CheckpointPoint[] = [];
    const manager = new NeighborhoodCheckpoints(async (_t, point) => {
      writes.push(point);
      if (writes.length === 1) await gate.promise;
      return true;
    });
    manager.track("s1", target, { x: 3, y: 4 });
    const first = manager.save("s1", { x: 5, y: 4 });
    await flush();
    const leave = manager.release("s1", { x: 3, y: 4 });
    gate.resolve();
    await Promise.all([first, leave]);
    expect(writes).toEqual([
      { x: 5, y: 4 },
      { x: 3, y: 4 },
    ]);
  }); 
  it("continues saving when the error reporting callback throws", async () => {
    let attempts = 0;
    const manager = new NeighborhoodCheckpoints(
      async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("database failure");
        return true;
      },
      () => {
        throw new Error("reporting failure");
      },
    );
    manager.track("s1", target, null);
  
    await manager.save("s1", { x: 1, y: 1 });
    await manager.save("s1", { x: 1, y: 1 });
  
    expect(attempts).toBe(2);
  });
});
