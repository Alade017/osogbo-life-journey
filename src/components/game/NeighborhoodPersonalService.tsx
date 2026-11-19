import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { announceEquipmentRefresh } from "@/lib/equipment-service";
import { formatNaira, q } from "@/lib/game";
import {
  fetchPersonalServices,
  isDefiniteServiceRejection,
  personalServiceError,
  serviceIntentSchema,
  submitPersonalService,
  type ServiceIntent,
} from "@/lib/neighborhood-personal-services";
import type { Appearance } from "@/game/avatar-appearance";

export function NeighborhoodPersonalService({
  zoneId,
  kind,
  onBusyChange,
}: {
  zoneId: string;
  kind: "barber" | "pos";
  onBusyChange: (busy: boolean) => void;
}) {
  const client = useQueryClient(),
    character = useQuery(q.character()),
    wallet = useQuery(q.wallet());
  const [hair, setHair] = useState(0),
    [hairColor, setHairColor] = useState(0);
  const [working, setWorking] = useState(false);
  const [pending, setPending] = useState<ServiceIntent | null>(null),
    [notice, setNotice] = useState("");
  const lock = useRef(false),
    initialized = useRef<string | null>(null);
  const characterId = character.data?.id;
  const key = characterId ? `osun:personal-service:${characterId}:${zoneId}` : null;
  const activeKey = useRef(key);
  activeKey.current = key;
  const catalogue = useQuery({
    queryKey: ["neighborhoodPersonalServices", characterId, zoneId],
    queryFn: () => fetchPersonalServices(zoneId),
    enabled: !!characterId,
    retry: false,
    staleTime: 0,
  });
  const service = catalogue.data?.find((s) => s.kind === kind);
  useEffect(() => {
    if (!key || initialized.current === key) return;
    initialized.current = key;
    setPending(null);
    setNotice("");
    const appearance = (character.data?.appearance ?? {}) as Appearance;
    setHair(Number.isInteger(appearance.hair) ? appearance.hair! : 0);
    setHairColor(Number.isInteger(appearance.hairColor) ? appearance.hairColor! : 0);
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = serviceIntentSchema.safeParse(JSON.parse(saved));
        if (parsed.success) {
          setPending(parsed.data);
          if (parsed.data.hair !== null) setHair(parsed.data.hair);
          if (parsed.data.hairColor !== null) setHairColor(parsed.data.hairColor);
          setNotice("A previous request needs confirmation. Retry it to check the saved receipt.");
        }
      }
    } catch {
      setNotice(
        "Your previous request could not be read. Check browser storage before starting another service.",
      );
    }
  }, [key, character.data]);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: q.character().queryKey }, { throwOnError: true }),
      client.invalidateQueries({ queryKey: q.wallet().queryKey }, { throwOnError: true }),
      client.invalidateQueries({ queryKey: ["transactions"] }, { throwOnError: true }),
      client.invalidateQueries(
        { queryKey: ["neighborhoodPersonalServices"] },
        { throwOnError: true },
      ),
    ]);
    window.dispatchEvent(new Event("osogbo:server-state-changed"));
  };
  const mutation = useMutation({ retry: false, mutationFn: submitPersonalService });
  const confirm = async () => {
    if (lock.current || !key || (!pending && (!service || !service.available))) return;
    lock.current = true;
    setWorking(true);
    onBusyChange(true);
    setNotice("");
    let intent = pending;
    let receivedReceipt = false;
    try {
      if (!intent && !service) return;
      intent ??= {
        requestId: crypto.randomUUID(),
        serviceId: service!.id,
        hair: kind === "barber" ? hair : null,
        hairColor: kind === "barber" ? hairColor : null,
        quote: {
          cash_price: service!.cash_price,
          cash_payout: service!.cash_payout,
          bank_fee: service!.bank_fee,
        },
      };
      // Save before submitting. An unknown network response can safely replay this exact request.
      try {
        localStorage.setItem(key, JSON.stringify(intent));
      } catch {
        setNotice(
          "This request could not be saved in your browser. Enable storage and try again. No service was submitted.",
        );
        return;
      }
      setPending(intent);
      await mutation.mutateAsync(intent);
      receivedReceipt = true;
      if (activeKey.current !== key) return;
      if (kind === "barber") announceEquipmentRefresh();
      await refresh();
      // Keep the original intent until saved state has refreshed, so every retry is a replay.
      localStorage.removeItem(key);
      setPending(null);
      setNotice(
        kind === "barber"
          ? "Your new hairstyle is saved."
          : "POS withdrawal confirmed. Your cash, savings and fee are recorded.",
      );
    } catch (error) {
      if (activeKey.current !== key) return;
      if (!receivedReceipt && isDefiniteServiceRejection(error)) {
        try {
          localStorage.removeItem(key);
        } catch {
          /* Keep receipt recovery available if storage is restricted. */
        }
        setPending(null);
        void catalogue.refetch();
      }
      setNotice(
        receivedReceipt
          ? "Your service is confirmed, but saved details could not refresh. Retry confirmation to reload its receipt without paying again."
          : personalServiceError(error),
      );
    } finally {
      lock.current = false;
      setWorking(false);
      onBusyChange(false);
    }
  };
  const disabled = working || !!pending;
  if (character.isPending) return <p role="status">Loading service details…</p>;
  if (character.isError || !characterId)
    return (
      <div role="alert">
        <p>Your character could not load.</p>
        <button
          type="button"
          className="neighborhood-zone-action-tile"
          onClick={() => void character.refetch()}
        >
          Reload character
        </button>
      </div>
    );
  if (catalogue.isPending) return <p role="status">Loading service details…</p>;
  if (catalogue.isError || !service)
    return (
      <div role="alert">
        <p>The service catalogue could not load.</p>
        {pending && (
          <button
            type="button"
            className="neighborhood-zone-action-tile"
            disabled={working}
            onClick={() => void confirm()}
          >
            Retry service confirmation
          </button>
        )}
        <button
          type="button"
          className="neighborhood-zone-action-tile"
          onClick={() => void catalogue.refetch()}
        >
          Reload service catalogue
        </button>
      </div>
    );
  const quote = pending?.quote ?? service;
  const appearance = (character.data?.appearance ?? {}) as Appearance;
  const unchanged =
    kind === "barber" && appearance.hair === hair && appearance.hairColor === hairColor;
  const affordable =
    !wallet.isPending &&
    !wallet.isError &&
    !!wallet.data &&
    (kind === "barber"
      ? wallet.data.balance >= service.cash_price
      : wallet.data.bank_balance >= service.cash_payout + service.bank_fee);
  return (
    <section
      className="neighborhood-personal-service"
      aria-label={kind === "barber" ? "Barber service" : "POS service"}
    >
      <h3>{service.label}</h3>
      {kind === "barber" ? (
        <>
          <p>
            {formatNaira(quote.cash_price)} from pocket cash. Choose your hair style and colour.
          </p>
          <label htmlFor="barber-hair">Hair style</label>
          <select
            id="barber-hair"
            value={hair}
            disabled={disabled}
            onChange={(e) => setHair(Number(e.target.value))}
          >
            {service.hair_styles.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </select>
          <label htmlFor="barber-colour">Hair colour</label>
          <select
            id="barber-colour"
            value={hairColor}
            disabled={disabled}
            onChange={(e) => setHairColor(Number(e.target.value))}
          >
            {service.hair_colors.map((colour, i) => (
              <option key={colour} value={i}>
                {["Black", "Dark brown", "Brown", "Grey"][i] ?? `Colour ${i + 1}`}
              </option>
            ))}
          </select>
          <div
            className="neighborhood-hair-colour"
            style={{ backgroundColor: service.hair_colors[hairColor] }}
            aria-hidden="true"
          />
        </>
      ) : (
        <>
          <dl>
            <dt>Cash you receive</dt>
            <dd>{formatNaira(quote.cash_payout)}</dd>
            <dt>POS fee</dt>
            <dd>{formatNaira(quote.bank_fee)}</dd>
            <dt>Total from savings</dt>
            <dd>{formatNaira(quote.cash_payout + quote.bank_fee)}</dd>
          </dl>
          <p>
            Your cash increases by the withdrawal amount. The fee is recorded separately in your
            transaction history.
          </p>
        </>
      )}
      {!service.available && (
        <p role="status">Visit this service in City Centre while outside your home.</p>
      )}
      {wallet.isPending && !pending && <p role="status">Loading balances…</p>}
      {wallet.isError && !pending && (
        <div role="alert">
          <p>Your balances could not load.</p>
          <button
            type="button"
            className="neighborhood-zone-action-tile"
            onClick={() => void wallet.refetch()}
          >
            Reload balances
          </button>
        </div>
      )}
      {!affordable && !pending && !wallet.isPending && !wallet.isError && (
        <p>
          {kind === "barber"
            ? "Not enough pocket cash."
            : "Not enough savings for the withdrawal and fee."}
        </p>
      )}
      <button
        type="button"
        className="neighborhood-zone-action-tile"
        aria-busy={working}
        disabled={working || (!pending && (!service.available || !affordable || unchanged))}
        onClick={() => void confirm()}
      >
        {working
          ? "Confirming…"
          : pending
            ? "Retry service confirmation"
            : kind === "barber"
              ? "Pay and save hairstyle"
              : "Confirm POS withdrawal"}
      </button>
      {notice && (
        <p role="status" aria-live="polite">
          {notice}
        </p>
      )}
    </section>
  );
}
