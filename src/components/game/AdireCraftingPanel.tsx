import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { q } from "@/lib/game";
import {
  collectCrafting,
  craftSecondsLeft,
  craftingError,
  craftStartSchema,
  definiteCraftingRejection,
  fetchCrafting,
  startCrafting,
  type CraftStart,
} from "@/lib/adire-crafting";
export function AdireCraftingPanel({
  zoneId,
  onBusyChange,
  onBuyMaterials,
}: {
  zoneId: string;
  onBusyChange: (busy: boolean) => void;
  onBuyMaterials: () => void;
}) {
  const client = useQueryClient(),
    character = useQuery(q.character());
  const [pending, setPending] = useState<CraftStart | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const lock = useRef(false),
    initialized = useRef<string | null>(null);
  const characterId = character.data?.id,
    key = characterId ? `osun:adire-start:${characterId}` : null;
  const activeKey = useRef(key);
  activeKey.current = key;
  const state = useQuery({
    queryKey: ["adireCrafting", characterId, zoneId],
    queryFn: () => fetchCrafting(zoneId),
    enabled: !!characterId,
    retry: false,
    staleTime: 0,
  });
  const [, tick] = useState(0);
  const clock = useMemo(
    () => ({
      sample: performance.now(),
      server: state.data?.server_now ?? new Date().toISOString(),
    }),
    [state.data],
  );
  const job = state.data?.jobs.find((j) => !j.claimed_at);
  const jobId = job?.id;
  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [jobId]);
  useEffect(() => {
    if (!key || initialized.current === key) return;
    initialized.current = key;
    setPending(null);
    setNotice("");
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = craftStartSchema.safeParse(JSON.parse(raw));
        if (parsed.success) setPending(parsed.data);
      }
    } catch {
      setNotice(
        "The saved crafting request could not be read. Check browser storage before starting another craft.",
      );
    }
  }, [key]);
  // A loaded server job is also the start receipt, including when the first response was lost.
  useEffect(() => {
    if (!pending || !key || !state.data?.jobs.some((j) => j.request_id === pending.requestId))
      return;
    try {
      localStorage.removeItem(key);
      setPending(null);
    } catch {
      /* Keep the same receipt until storage is available. */
    }
  }, [pending, key, state.data]);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["adireCrafting"] }, { throwOnError: true }),
      client.invalidateQueries({ queryKey: q.inventory().queryKey }, { throwOnError: true }),
    ]);
    window.dispatchEvent(new Event("osogbo:server-state-changed"));
  };
  async function perform(intent: CraftStart | null, collectId?: string) {
    if (lock.current || !key) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setNotice("");
    let confirmed = false;
    try {
      if (collectId) {
        await collectCrafting(collectId, zoneId);
      } else if (intent) {
        try {
          localStorage.setItem(key, JSON.stringify(intent));
        } catch {
          setNotice(
            "The request could not be saved. Enable browser storage and retry. No materials were consumed.",
          );
          return;
        }
        setPending(intent);
        await startCrafting(intent);
      } else return;
      confirmed = true;
      if (activeKey.current !== key) return;
      await refresh();
      if (intent) {
        localStorage.removeItem(key);
        setPending(null);
      }
      setNotice(
        collectId
          ? "Finished item collected into your inventory."
          : "Craft started. Materials have been consumed; your work continues while you are away.",
      );
    } catch (error) {
      if (activeKey.current !== key) return;
      if (intent && !confirmed && definiteCraftingRejection(error)) {
        try {
          localStorage.removeItem(key);
        } catch {
          /* Preserve recovery if storage is restricted. */
        }
        setPending(null);
        void state.refetch();
      }
      setNotice(
        confirmed
          ? "Your craft is confirmed, but saved details could not refresh. Reload crafting; repeated collection cannot duplicate the item."
          : craftingError(error),
      );
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  if (character.isPending) return <p role="status">Loading character…</p>;
  if (character.isError || !characterId)
    return (
      <div role="alert">
        Your character could not load.{" "}
        <button type="button" onClick={() => void character.refetch()}>
          Reload character
        </button>
      </div>
    );
  if (state.isPending) return <p role="status">Loading recipes…</p>;
  const remaining = job
    ? craftSecondsLeft(job.ready_at, clock.server, performance.now() - clock.sample)
    : 0;
  return (
    <section className="neighborhood-crafting" aria-label="Adire crafting">
      <h3>Adire workbench</h3>
      <p>
        Buy materials, start a recipe, and collect its finished item. Crafting uses real time and
        continues while you are away. Materials are paid for at the shop; starting has no extra cash
        charge.
      </p>
      <button
        type="button"
        className="neighborhood-zone-action-tile"
        disabled={busy}
        onClick={onBuyMaterials}
      >
        Buy materials / sell finished pieces
      </button>
      {state.isError && (
        <p role="alert">Recipes could not refresh. Your pending work remains saved.</p>
      )}
      <button
        type="button"
        className="auth-text-link"
        disabled={busy || state.isFetching}
        onClick={() => void state.refetch()}
      >
        Reload crafting
      </button>
      {pending && (
        <button
          type="button"
          className="neighborhood-zone-action-tile"
          disabled={busy}
          onClick={() => void perform(pending)}
        >
          Retry craft confirmation
        </button>
      )}
      {job && (
        <div className="neighborhood-zone-trip-confirm">
          <strong>{job.name}</strong>
          <p>{job.station_name}</p>
          <p role="timer" aria-live="off">
            {remaining > 0
              ? `${remaining}s remaining (estimate)`
              : "Ready to collect — server confirmation required"}
          </p>
          {job.zone_id !== zoneId ? (
            <p>Return to {job.station_name} to collect.</p>
          ) : (
            <button
              type="button"
              className="neighborhood-zone-action-tile"
              disabled={busy || remaining > 0}
              onClick={() => void perform(null, job.id)}
            >
              Collect {job.output_name}
            </button>
          )}
        </div>
      )}
      {!job &&
        state.data?.recipes.map((recipe) => (
          <article key={recipe.id} className="neighborhood-craft-recipe">
            <h4>{recipe.name}</h4>
            <p>
              {recipe.duration_seconds}s · {recipe.output_quantity} × {recipe.output_name}
            </p>
            <ul>
              {recipe.materials.map((material) => (
                <li key={material.name}>
                  {material.name}: {material.quantity} required · {material.owned} owned
                </li>
              ))}
            </ul>
            {!recipe.available && (
              <p>Visit this Adire station in City Centre while outside your home.</p>
            )}
            <button
              type="button"
              className="neighborhood-zone-action-tile"
              disabled={
                busy ||
                !!pending ||
                !recipe.available ||
                recipe.materials.some((m) => m.owned < m.quantity)
              }
              onClick={() =>
                void perform({
                  recipeId: recipe.id,
                  requestId: crypto.randomUUID(),
                  quote: recipe.quote,
                })
              }
            >
              Start {recipe.name}
            </button>
          </article>
        ))}
      {state.data?.jobs.find((j) => j.claimed_at) && (
        <p>Last collected: {state.data.jobs.find((j) => j.claimed_at)!.output_name}</p>
      )}
      {notice && (
        <p role="status" aria-live="polite">
          {notice}
        </p>
      )}
    </section>
  );
}
