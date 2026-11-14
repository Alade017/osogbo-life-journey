/**
 * Server-side checkpoint persistence for neighbourhood players. The room owns the authoritative
 * position; this module decides when a position is worth writing and makes sure writes for one
 * session never overlap. It holds no network code, so it can be tested with a fake saver.
 */

export type CheckpointPoint = { x: number; y: number };

/** Identity the room verified from the access token and the saved character row. */
export type CheckpointTarget = { userId: string; characterId: string; locationId: string };

/** Resolves true when the row was updated, false when the character is no longer eligible. */
export type CheckpointSaver = (
  target: CheckpointTarget,
  point: CheckpointPoint,
) => Promise<boolean>;

export const CHECKPOINT_INTERVAL_MS = 10_000;

type Session = {
  target: CheckpointTarget;
  saved: CheckpointPoint | null;
  queue: Promise<void>;
  /** Writes queued or running for this session; the periodic pass skips a busy session. */
  queued: CheckpointPoint | null;
  pending: number;
  stale: boolean;
};

export function checkpointChanged(saved: CheckpointPoint | null, current: CheckpointPoint) {
  return !saved || saved.x !== current.x || saved.y !== current.y;
}

export class NeighborhoodCheckpoints {
  private readonly sessions = new Map<string, Session>();
  private readonly releases = new Set<Promise<void>>();

  constructor(
    private readonly saver: CheckpointSaver,
    private readonly report: (message: string) => void = () => undefined,
  ) {}

  /** Start tracking a session. `saved` is the last position already stored, or null if unknown. */
  track(sessionId: string, target: CheckpointTarget, saved: CheckpointPoint | null) {
    this.sessions.set(sessionId, {
      target,
      saved: saved ? { x: saved.x, y: saved.y } : null,
      queue: Promise.resolve(),
      queued: saved ? { x: saved.x, y: saved.y } : null,
      pending: 0,
      stale: false,
    });
  }

  /**
   * Save the position if it changed since the last successful write. Writes for one session run
   * one after another. A periodic save (`skipIfBusy`) gives way to any write already pending; the
   * leave-time save always queues behind them so the final position is never lost.
   */
  save(sessionId: string, current: CheckpointPoint, options: { skipIfBusy?: boolean } = {}) {
    const session = this.sessions.get(sessionId);
    if (!session || session.stale) return Promise.resolve();

    if (options.skipIfBusy && session.pending > 0) {
      return Promise.resolve();
    }

    if (session.pending === 0 && !checkpointChanged(session.saved, current)) {
      return session.queue;
    }

    if (session.pending > 0 && session.queued?.x === current.x && session.queued?.y === current.y) {
      return session.queue;
    }

    const point = { x: current.x, y: current.y };
    session.queued = point;
    session.pending += 1;

    session.queue = session.queue.then(async () => {
      try {
        if (session.stale || !checkpointChanged(session.saved, point)) return;

        const saved = await this.saver(session.target, point);

        if (saved) {
          session.saved = point;
        } else {
          session.stale = true;
        }
      } catch {
        try {
          this.report("Neighbourhood checkpoint could not be saved; it will be retried.");
        } catch {
          // Reporting must never interrupt checkpoint persistence.
        }
      } finally {
        session.pending -= 1;
        if (session.pending === 0) {
          session.queued = session.saved ? { ...session.saved } : null;
        }
      }
    });

    return session.queue;
  }

  /**
   * Periodic pass over every tracked session, using the room's current positions. It never waits
   * for writes, so one slow database call cannot hold up the next pass.
   */
  saveAll(positionOf: (sessionId: string) => CheckpointPoint | undefined) {
    for (const sessionId of this.sessions.keys()) {
      const position = positionOf(sessionId);
      if (position) void this.save(sessionId, position, { skipIfBusy: true });
    }
  }

  /** Save the final position, forget the session, and keep its write visible to disposal. */
  release(sessionId: string, finalPosition?: CheckpointPoint) {
    const session = this.sessions.get(sessionId);
    if (!session) return Promise.resolve();

    const pending = finalPosition ? this.save(sessionId, finalPosition) : session.queue;

    this.sessions.delete(sessionId);

    const tracked = pending.finally(() => {
      this.releases.delete(tracked);
    });

    this.releases.add(tracked);

    return tracked;
  }

  /** Room disposal waits for active sessions and writes already released by onLeave. */
  dispose() {
    const pending = [
      ...[...this.sessions.values()].map((session) => session.queue),
      ...this.releases,
    ];
    this.sessions.clear();
    return Promise.all(pending);
  }

  get trackedCount() {
    return this.sessions.size;
  }
}
