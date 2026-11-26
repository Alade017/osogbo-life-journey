import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness } from "lucide-react";
import { toast } from "sonner";
import { formatNaira, q } from "@/lib/game";
import { openPlayerMessages } from "@/lib/phone-messages";
import {
  getGigBoard,
  gigBoardQueryKey,
  submitGigAction,
  type GigAction,
} from "@/lib/gig-work-client";
import "./vitalstat-nesta-app.css";

type Tab = "browse" | "posts" | "jobs";

function dueLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Lagos",
      }).format(date);
}

const ERROR_TEXT: Record<string, string> = {
  GIG_UNAVAILABLE: "This job is no longer open.",
  OWN_GIG: "You can't apply for your own job.",
  INSUFFICIENT_FUNDS: "You don't have enough cash to pay for this job.",
};

/** Gig Work: post a paid job, pick an applicant, confirm the work is done, or apply to someone else's job. */
export function GigWorkApp() {
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>("browse");
  const characterId = useQuery(q.character()).data?.id ?? "";
  const board = useQuery({
    queryKey: gigBoardQueryKey(characterId),
    queryFn: getGigBoard,
    enabled: !!characterId,
    retry: false,
  });
  const act = useMutation({
    mutationFn: (input: GigAction) => submitGigAction(input),
    onSuccess: async (_result, input) => {
      toast.success(
        input.action === "post"
          ? "Job posted. It stays open for 24 hours."
          : input.action === "apply"
            ? "Application sent. The poster will pick someone."
            : input.action === "accept"
              ? "Worker picked. Message them to agree the details."
              : input.action === "confirm"
                ? "Job confirmed. The worker has been paid."
                : "Job cancelled.",
      );
      await client.invalidateQueries({ queryKey: gigBoardQueryKey(characterId) });
      if (input.action === "post") setTab("posts");
    },
    onError: (error: Error) => toast.error(ERROR_TEXT[error.message] ?? error.message),
  });

  const data = board.data;

  return (
    <section className="nesta-app gig-app" aria-label="Gig Work">
      <header className="nesta-hero">
        <span className="nesta-mark" aria-hidden="true">
          <BriefcaseBusiness size={20} />
        </span>
        <div>
          <h2>Gig Work</h2>
          <p>Post a paid job, or apply to one.</p>
        </div>
      </header>

      <nav className="gig-tabs" aria-label="Gig Work sections">
        {(
          [
            ["browse", "Browse"],
            ["posts", "My posts"],
            ["jobs", "My jobs"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            className={tab === id ? "gig-tab gig-tab-on" : "gig-tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {board.isPending && characterId ? <p className="nesta-note">Loading gigs…</p> : null}
      {board.isError ? <p className="nesta-note">{board.error.message}</p> : null}

      {tab === "browse" ? (
        <>
          <PostForm busy={act.isPending} onPost={(input) => act.mutate(input)} />
          {data?.open.length === 0 ? (
            <div className="nesta-card">
              <p>No open jobs right now. Post one to get started.</p>
            </div>
          ) : null}
          {data?.open.map((gig) => (
            <OfferCard
              key={gig.id}
              gig={gig}
              busy={act.isPending}
              onApply={(input) => act.mutate(input)}
            />
          ))}
        </>
      ) : null}

      {tab === "posts" ? (
        data?.mine.length === 0 ? (
          <div className="nesta-card">
            <p>You haven&apos;t posted any jobs yet.</p>
          </div>
        ) : (
          data?.mine.map((gig) => (
            <div className="nesta-card" key={gig.id}>
              <h3>{gig.title}</h3>
              <p className="nesta-muted">
                {formatNaira(gig.pay)} · {gig.status}
                {gig.status === "open" ? ` · expires ${dueLabel(gig.expiresAt)}` : ""}
              </p>
              <p>{gig.description}</p>
              {gig.status === "open" ? (
                <>
                  <p className="nesta-muted">
                    {gig.applicants.length === 0
                      ? "No applicants yet."
                      : `${gig.applicants.length} applicant${gig.applicants.length === 1 ? "" : "s"}`}
                  </p>
                  {gig.applicants.map((applicant) => (
                    <div className="gig-applicant" key={applicant.characterId}>
                      <span>
                        {applicant.name}
                        {applicant.offer ? ` · offers ${formatNaira(applicant.offer)}` : ""}
                      </span>
                      <span className="gig-applicant-actions">
                        <button
                          type="button"
                          className="nesta-link"
                          onClick={() => openPlayerMessages(applicant.characterId)}
                        >
                          Message
                        </button>
                        <button
                          type="button"
                          className="nesta-button"
                          disabled={act.isPending}
                          onClick={() =>
                            act.mutate({
                              action: "accept",
                              gigId: gig.id,
                              applicantId: applicant.characterId,
                            })
                          }
                        >
                          Pick
                        </button>
                      </span>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="nesta-link"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ action: "cancel", gigId: gig.id })}
                  >
                    Cancel job
                  </button>
                </>
              ) : null}
              {gig.status === "accepted" ? (
                <>
                  <p>
                    Working with {gig.workerName ?? "your worker"}. Pays {formatNaira(gig.pay)} when
                    you confirm.
                  </p>
                  {gig.workerId ? (
                    <button
                      type="button"
                      className="nesta-link"
                      onClick={() => openPlayerMessages(gig.workerId!)}
                    >
                      Message {gig.workerName ?? "worker"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="nesta-button"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ action: "confirm", gigId: gig.id })}
                  >
                    Confirm done and pay
                  </button>
                  <button
                    type="button"
                    className="nesta-link"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ action: "cancel", gigId: gig.id })}
                  >
                    Cancel job
                  </button>
                </>
              ) : null}
            </div>
          ))
        )
      ) : null}

      {tab === "jobs" ? (
        data?.jobs.length === 0 ? (
          <div className="nesta-card">
            <p>You haven&apos;t been picked for any jobs yet.</p>
          </div>
        ) : (
          data?.jobs.map((job) => (
            <div className="nesta-card" key={job.id}>
              <h3>{job.title}</h3>
              <p className="nesta-muted">
                From {job.posterName} · {formatNaira(job.pay)} · {job.status}
              </p>
              {job.status === "accepted" ? (
                <button
                  type="button"
                  className="nesta-link"
                  onClick={() => openPlayerMessages(job.posterId)}
                >
                  Message {job.posterName}
                </button>
              ) : null}
            </div>
          ))
        )
      ) : null}
    </section>
  );
}

function PostForm({ busy, onPost }: { busy: boolean; onPost: (input: GigAction) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pay, setPay] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const amount = Math.round(Number(pay) * 100);
    if (!title.trim() || description.trim().length < 10 || !Number.isFinite(amount) || amount < 1) {
      toast.error("Add a title, a description of at least 10 characters, and a pay amount.");
      return;
    }
    onPost({ action: "post", title: title.trim(), description: description.trim(), pay: amount });
    setTitle("");
    setDescription("");
    setPay("");
  };
  return (
    <form className="nesta-card gig-form" onSubmit={submit}>
      <h3>Post a job</h3>
      <label>
        Title
        <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Description
        <textarea
          value={description}
          maxLength={1000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label>
        Pay (₦)
        <input inputMode="numeric" value={pay} onChange={(e) => setPay(e.target.value)} />
      </label>
      <button type="submit" className="nesta-button" disabled={busy}>
        Post job
      </button>
    </form>
  );
}

function OfferCard({
  gig,
  busy,
  onApply,
}: {
  gig: {
    id: string;
    title: string;
    description: string;
    pay: number;
    posterName: string;
    applied: boolean;
    expiresAt: string;
  };
  busy: boolean;
  onApply: (input: GigAction) => void;
}) {
  const [offer, setOffer] = useState("");
  return (
    <div className="nesta-card">
      <h3>{gig.title}</h3>
      <p className="nesta-muted">
        Posted by {gig.posterName} · {formatNaira(gig.pay)} · expires {dueLabel(gig.expiresAt)}
      </p>
      <p>{gig.description}</p>
      {gig.applied ? (
        <p className="nesta-muted">You applied. Message {gig.posterName} to agree the details.</p>
      ) : (
        <>
          <label>
            Counter-offer (optional, ₦)
            <input inputMode="numeric" value={offer} onChange={(e) => setOffer(e.target.value)} />
          </label>
          <button
            type="button"
            className="nesta-button"
            disabled={busy}
            onClick={() => {
              const amount = offer.trim() ? Math.round(Number(offer) * 100) : null;
              onApply({ action: "apply", gigId: gig.id, offer: amount });
            }}
          >
            Apply
          </button>
        </>
      )}
    </div>
  );
}
