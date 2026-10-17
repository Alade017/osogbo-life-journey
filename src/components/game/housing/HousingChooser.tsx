import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, House, LoaderCircle, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getRecommendedHouses, HOUSING, type HousingPlayer } from "@/game/housing/eligibility";

type HouseOption = {
  id: string;
  name: string;
  label: string;
  description?: string;
  bedrooms: number;
  shared_facilities: boolean;
  weekly_rent_minor: number;
  min_weekly_income_minor: number;
  deposit_weeks: number;
  deposit_minor: number;
  upfront_total_minor: number;
  preference_tags: string[];
  eligible: boolean;
  reason: string | null;
  reason_code: string;
};

type Eligibility = HousingPlayer & {
  weekly_income_minor: number;
  first_payment_at: string;
  houses: HouseOption[];
};

type QuestionKey = "household" | "space" | "priority";
type Answers = Partial<Record<QuestionKey, string>>;

const QUESTIONS: {
  key: QuestionKey;
  title: string;
  options: { value: string; label: string; description: string }[];
}[] = [
  {
    key: "household",
    title: "Who lives with you?",
    options: [
      { value: "alone", label: "Alone", description: "A place that is yours to shape." },
      { value: "partner", label: "With a partner", description: "Room for two daily routines." },
      { value: "small_family", label: "Small family", description: "A little extra room to grow." },
      { value: "large_family", label: "Large family", description: "Space for everyone at home." },
    ],
  },
  {
    key: "space",
    title: "How much space do you want?",
    options: [
      { value: "one_room", label: "One room", description: "Keep it simple and close." },
      { value: "few_rooms", label: "A few rooms", description: "Separate space for daily life." },
      { value: "plenty_space", label: "Plenty of space", description: "Room to spread out." },
    ],
  },
  {
    key: "priority",
    title: "What matters most?",
    options: [
      { value: "cheap", label: "Cheap", description: "Keep weekly costs low." },
      { value: "private", label: "Private", description: "Have your own facilities." },
      { value: "comfortable", label: "Comfortable", description: "Make home feel settled." },
      {
        value: "close_to_work",
        label: "Close to work",
        description: "Stay near your work routine.",
      },
    ],
  },
];

function naira(amount: number) {
  return `₦${Number(amount).toLocaleString("en-NG")}`;
}

function preferenceTags(answers: Answers) {
  const tags: string[] = [];
  if (answers.household === "alone") tags.push("starter", "private", "independent");
  if (answers.household === "partner") tags.push("couple", "private");
  if (answers.household === "small_family" || answers.household === "large_family")
    tags.push("family", "space");
  if (answers.space === "one_room") tags.push("starter", "budget");
  if (answers.space === "few_rooms") tags.push("space");
  if (answers.space === "plenty_space") tags.push("space", "premium");
  if (answers.priority === "cheap") tags.push("budget");
  if (answers.priority === "private") tags.push("private", "independent");
  if (answers.priority === "comfortable") tags.push("comfortable");
  if (answers.priority === "close_to_work") tags.push("close-to-work");
  return [...new Set(tags)];
}

async function api(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.reason ?? body?.error?.code ?? "Housing request failed.");
  }
  return body;
}

function formatLagosDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

export function HousingChooser({
  open,
  pending,
  allowSkip = false,
  onClose,
}: {
  open: boolean;
  pending: boolean;
  allowSkip?: boolean;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const eligibleQuery = useQuery<Eligibility>({
    queryKey: ["housingEligibility"],
    enabled: open,
    queryFn: () => api("/api/housing/eligible"),
    staleTime: 0,
  });
  const [questionIndex, setQuestionIndex] = useState(QUESTIONS.length);
  const [answers, setAnswers] = useState<Answers>({});
  const [confirming, setConfirming] = useState<HouseOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestKeys = useRef(new Map<string, string>());
  const preferences = useMemo(() => preferenceTags(answers), [answers]);

  useEffect(() => {
    if (!open) return;
    setQuestionIndex(QUESTIONS.length);
    setAnswers({});
    setConfirming(null);
    setError("");
  }, [open]);

  const recommended = useMemo(() => {
    const data = eligibleQuery.data;
    if (!data) return [];
    const player: HousingPlayer = {
      weekly_job_income_minor: Number(data.weekly_job_income_minor ?? 0),
      weekly_recurring_income_minor: Number(data.weekly_recurring_income_minor ?? 0),
      wallet_balance_minor: Number(data.wallet_balance_minor ?? 0),
      income_source_count: Number(data.income_source_count ?? 0),
      job_income_band: data.job_income_band ?? null,
    };
    const rank = getRecommendedHouses(player, preferences).map((entry) => entry.house.id);
    const serverHouses = new Map(data.houses.map((house) => [house.id, house]));
    return rank
      .map((id) => serverHouses.get(id))
      .filter((house): house is HouseOption => house !== undefined)
      .sort((a, b) => {
        const rankA = rank.indexOf(a.id);
        const rankB = rank.indexOf(b.id);
        return rankA - rankB;
      });
  }, [eligibleQuery.data, preferences]);

  if (!open) return null;

  async function rent(house: HouseOption) {
    setBusy(true);
    setError("");
    try {
      const key = requestKeys.current.get(house.id) ?? crypto.randomUUID();
      requestKeys.current.set(house.id, key);
      await api("/api/housing/rent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ house_type_id: house.id }),
      });
      requestKeys.current.delete(house.id);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["character"] }),
        cache.invalidateQueries({ queryKey: ["housingHome"] }),
        cache.invalidateQueries({ queryKey: ["homeSave"] }),
        cache.invalidateQueries({ queryKey: ["wallet"] }),
        cache.invalidateQueries({ queryKey: ["transactions"] }),
        cache.invalidateQueries({ queryKey: ["housingEligibility"] }),
      ]);
      onClose();
      await navigate({ to: "/home", search: { visit: undefined } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The server could not complete this rent.");
      void eligibleQuery.refetch();
    } finally {
      setBusy(false);
    }
  }

  async function liveWithFamily() {
    setBusy(true);
    setError("");
    try {
      await api("/api/housing/defer", { method: "POST" });
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["character"] }),
        cache.invalidateQueries({ queryKey: ["housingHome"] }),
      ]);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "We could not save your choice. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function advanceQuestion() {
    if (questionIndex < QUESTIONS.length - 1) {
      setQuestionIndex((index) => index + 1);
      return;
    }
    setQuestionIndex(QUESTIONS.length);
  }

  const question = QUESTIONS[questionIndex];
  const selectedDate = eligibleQuery.data?.first_payment_at;

  return (
    <div
      className="housing-choice-overlay fixed inset-0 z-[120] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <section
        aria-labelledby="housing-title"
        aria-modal="true"
        role="dialog"
        className="housing-choice-sheet w-full max-h-[92dvh] overflow-y-auto rounded-t-[24px] border border-edge bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-card-foreground shadow-2xl sm:max-w-3xl sm:rounded-[24px]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Your home</p>
            <h2 id="housing-title" className="mt-1 font-display text-2xl font-bold">
              {confirming
                ? "Confirm your rent"
                : questionIndex < QUESTIONS.length
                  ? "Help me choose"
                  : "Places to live in Osogbo"}
            </h2>
            {!confirming && questionIndex < QUESTIONS.length && (
              <p className="mt-1 text-sm text-muted-foreground">
                A few quick choices will help us find a good match.
              </p>
            )}
          </div>
          {!pending && (
            <button
              type="button"
              aria-label="Close housing choices"
              className="game-control min-h-11 min-w-11 rounded-full p-2"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {confirming ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-accent p-3 text-primary">
                  <House size={22} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-bold">{confirming.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {confirming.bedrooms} bedroom{confirming.bedrooms === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Weekly rent</dt>
                  <dd className="font-semibold">{naira(confirming.weekly_rent_minor)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    Deposit ({confirming.deposit_weeks} weeks)
                  </dt>
                  <dd className="font-semibold">{naira(confirming.deposit_minor)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">First payment date</dt>
                  <dd className="font-semibold">
                    {selectedDate ? formatLagosDate(selectedDate) : "Checking with the server…"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Due today</dt>
                  <dd className="font-semibold">{naira(confirming.upfront_total_minor)}</dd>
                </div>
              </dl>
            </div>
            {error && (
              <p className="text-sm text-muted-foreground" role="alert">
                {error}
              </p>
            )}
            <Button
              className="min-h-11 w-full"
              disabled={busy || !selectedDate}
              onClick={() => void rent(confirming)}
            >
              {busy ? (
                <LoaderCircle className="mr-2 animate-spin" size={16} />
              ) : (
                <Check className="mr-2" size={16} />
              )}
              Rent for {naira(confirming.weekly_rent_minor)} a week
            </Button>
            <Button
              variant="outline"
              className="min-h-11 w-full"
              disabled={busy}
              onClick={() => {
                setConfirming(null);
                setError("");
              }}
            >
              <ChevronLeft className="mr-2" size={16} /> Back to homes
            </Button>
          </div>
        ) : question && questionIndex < QUESTIONS.length ? (
          <div className="mt-5">
            <div className="mb-4 flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>
                Question {questionIndex + 1} of {QUESTIONS.length}
              </span>
              <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${((questionIndex + 1) / QUESTIONS.length) * 100}%` }}
                />
              </span>
            </div>
            <h3 className="mb-3 font-display text-xl font-bold">{question.title}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {question.options.map((option) => {
                const selected = answers[question.key] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    className={`min-h-16 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selected ? "border-primary bg-accent" : "border-border bg-background hover:bg-accent/60"}`}
                    onClick={() =>
                      setAnswers((current) => ({ ...current, [question.key]: option.value }))
                    }
                  >
                    <span className="block font-semibold">{option.label}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex gap-2">
              {questionIndex > 0 && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setQuestionIndex((index) => index - 1)}
                >
                  <ChevronLeft size={16} /> Back
                </Button>
              )}
              <Button
                className="min-h-11 flex-1"
                disabled={!answers[question.key]}
                onClick={advanceQuestion}
              >
                {questionIndex === QUESTIONS.length - 1 ? "See homes" : "Continue"}
                <ChevronRight className="ml-2" size={16} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-sm text-muted-foreground">
                Compare every available home. Your first week and deposit are due when you move in,
                and eligibility is checked by the server.
              </p>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setAnswers({});
                  setQuestionIndex(0);
                }}
              >
                <Sparkles size={16} aria-hidden="true" /> Help me choose
              </Button>
            </div>
            {eligibleQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <LoaderCircle className="animate-spin" aria-label="Loading homes" />
              </div>
            ) : eligibleQuery.isError ? (
              <div
                className="rounded-xl border border-border bg-background p-4 text-sm"
                role="alert"
              >
                Homes could not load. Try again in a moment.
                <Button
                  variant="outline"
                  className="mt-3 min-h-11 w-full"
                  onClick={() => void eligibleQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <div className="housing-choice-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recommended.map((house) => {
                  const catalogue = HOUSING.find((item) => item.id === house.id);
                  const matched = (catalogue?.preference_tags ?? []).some((tag) =>
                    preferences.includes(tag),
                  );
                  return (
                    <article
                      key={house.id}
                      className={`housing-choice-card rounded-2xl border border-border bg-background p-4 ${house.eligible ? "" : "is-ineligible opacity-60"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="rounded-xl bg-accent p-2 text-primary">
                            <House size={20} />
                          </span>
                          <div>
                            <h3 className="font-bold">{house.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {house.bedrooms} bedroom{house.bedrooms === 1 ? "" : "s"}
                              {house.shared_facilities
                                ? " · shared facilities"
                                : " · private facilities"}
                            </p>
                          </div>
                        </div>
                        {matched && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-1 text-xs font-semibold">
                            <Sparkles size={13} aria-hidden="true" /> Good match
                          </span>
                        )}
                      </div>
                      <p className="mt-4 text-sm text-muted-foreground">
                        {catalogue?.description ?? house.description}
                      </p>
                      <p className="mt-3 text-sm font-semibold">
                        {naira(house.weekly_rent_minor)} / week
                      </p>
                      <p className="mt-1 text-sm">
                        Deposit ({house.deposit_weeks} weeks):{" "}
                        <strong>{naira(house.deposit_minor)}</strong>
                      </p>
                      {house.eligible ? (
                        <Button
                          className="mt-4 min-h-11 w-full"
                          disabled={busy}
                          onClick={() => setConfirming(house)}
                        >
                          Rent this
                        </Button>
                      ) : (
                        <p className="mt-4 min-h-11 rounded-xl bg-muted px-3 py-3 text-sm font-medium text-muted-foreground">
                          {house.reason ?? "This home does not meet the current requirements."}
                        </p>
                      )}
                    </article>
                  );
                })}
                {recommended.length === 0 && (
                  <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground sm:col-span-2">
                    No homes are available right now. Please try again later.
                  </p>
                )}
              </div>
            )}
            {error && (
              <p className="mt-3 text-sm text-muted-foreground" role="alert">
                {error}
              </p>
            )}
            {allowSkip && (
              <Button
                variant="plain"
                className="mt-4 min-h-11 w-full"
                disabled={busy}
                onClick={() => void liveWithFamily()}
              >
                Live with family for now
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
