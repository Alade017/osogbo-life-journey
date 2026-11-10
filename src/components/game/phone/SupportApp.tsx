import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, MessageCircle, Send } from "lucide-react";
import { PaletteSelect } from "@/components/ui/palette-select";
import {
  listMySupportFeedback,
  SUPPORT_CATEGORIES,
  SUPPORT_KINDS,
  SUPPORT_MESSAGE_LIMITS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_SUBJECT_LIMITS,
  submitSupportFeedback,
  type SupportCategory,
  type SupportKind,
} from "@/lib/support-service";
import { findSupportAnswers } from "@/components/game/phone/support-faq";

type SupportTab = "help" | "feedback" | "messages";

const TABS: readonly { id: SupportTab; label: string }[] = [
  { id: "help", label: "Help" },
  { id: "feedback", label: "Feedback" },
  { id: "messages", label: "My feedback" },
];

export function SupportApp({ onHome }: { onHome?: () => void }) {
  const [tab, setTab] = useState<SupportTab>("help");
  const [prefillSubject, setPrefillSubject] = useState("");

  const openFeedback = (subject: string) => {
    setPrefillSubject(subject);
    setTab("feedback");
  };

  return (
    <div className="support-app">
      <header className="support-header">
        <span className="support-header-mark" aria-hidden="true">
          <MessageCircle size={22} />
        </span>
        <div>
          <h3>Support</h3>
          <p>Answers, suggestions and complaints</p>
        </div>
      </header>

      <div className="support-tabs" role="tablist" aria-label="Support sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "support-tab is-active" : "support-tab"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "help" && <HelpTab onNotFound={openFeedback} />}
      {tab === "feedback" && (
        <FeedbackTab
          key={prefillSubject}
          initialSubject={prefillSubject}
          onSent={() => setTab("messages")}
        />
      )}
      {tab === "messages" && <MessagesTab />}

      {onHome && (
        <button type="button" className="support-back" onClick={onHome}>
          Back to apps
        </button>
      )}
    </div>
  );
}

function HelpTab({ onNotFound }: { onNotFound: (subject: string) => void }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const answers = findSupportAnswers(query);

  return (
    <section className="game-panel support-panel" aria-label="Help">
      <label className="support-search">
        <span className="sr-only">Search help</span>
        <input
          type="search"
          value={query}
          placeholder="Search for an answer"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {answers.length > 0 ? (
        <ul className="support-faq-list">
          {answers.map((faq) => {
            const expanded = openId === faq.id;
            return (
              <li key={faq.id} className="support-faq">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenId(expanded ? null : faq.id)}
                >
                  <span>{faq.question}</span>
                  <ChevronDown size={18} aria-hidden="true" className={expanded ? "is-open" : ""} />
                </button>
                {expanded && <p>{faq.answer}</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="support-empty">
          <p>No automatic answer for that yet. Send us your question so we can look into it.</p>
          <button
            type="button"
            className="phone-btn-primary"
            onClick={() => onNotFound(query.trim().slice(0, SUPPORT_SUBJECT_LIMITS.max))}
          >
            Send feedback
          </button>
        </div>
      )}
    </section>
  );
}

function FeedbackTab({ initialSubject, onSent }: { initialSubject: string; onSent: () => void }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<SupportKind>("suggestion");
  const [category, setCategory] = useState<SupportCategory>("gameplay");
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: submitSupportFeedback,
    onSuccess: (row) => {
      setNotice(
        row.status === "in_progress"
          ? "Thank you. Your complaint is in progress and we will look into it."
          : "Thank you. Your suggestion has been received.",
      );
      setSubject("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["support-feedback"] });
      onSent();
    },
  });

  const subjectValid =
    subject.trim().length >= SUPPORT_SUBJECT_LIMITS.min &&
    subject.trim().length <= SUPPORT_SUBJECT_LIMITS.max;
  const messageValid =
    message.trim().length >= SUPPORT_MESSAGE_LIMITS.min &&
    message.trim().length <= SUPPORT_MESSAGE_LIMITS.max;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!subjectValid || !messageValid || send.isPending) return;
    setNotice(null);
    send.mutate({ kind, category, subject: subject.trim(), message: message.trim() });
  };

  return (
    <form className="game-panel support-panel support-form" onSubmit={submit}>
      {notice && <p className="support-notice">{notice}</p>}

      <label className="support-field">
        <span>Type</span>
        <PaletteSelect
          aria-label="Feedback type"
          value={kind}
          onValueChange={(next) => setKind(next as SupportKind)}
          options={SUPPORT_KINDS.map((item) => ({ value: item.value, label: item.label }))}
        />
      </label>

      <label className="support-field">
        <span>Category</span>
        <PaletteSelect
          aria-label="Feedback category"
          value={category}
          onValueChange={(next) => setCategory(next as SupportCategory)}
          options={SUPPORT_CATEGORIES.map((item) => ({ value: item.value, label: item.label }))}
        />
      </label>

      <label className="support-field">
        <span>Subject</span>
        <input
          value={subject}
          maxLength={SUPPORT_SUBJECT_LIMITS.max}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="A short title"
        />
      </label>

      <label className="support-field">
        <span>Message</span>
        <textarea
          value={message}
          maxLength={SUPPORT_MESSAGE_LIMITS.max}
          rows={5}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Tell us what happened or what would help"
        />
        <small>
          {message.trim().length}/{SUPPORT_MESSAGE_LIMITS.max}
        </small>
      </label>

      {send.isError && <p className="support-error">{send.error.message}</p>}

      <button
        type="submit"
        className="phone-btn-primary support-submit"
        disabled={!subjectValid || !messageValid || send.isPending}
      >
        <Send size={16} aria-hidden="true" />
        {send.isPending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

function MessagesTab() {
  const feedback = useQuery({
    queryKey: ["support-feedback"],
    queryFn: listMySupportFeedback,
  });

  if (feedback.isPending) {
    return <p className="game-panel support-panel support-empty">Loading your feedback…</p>;
  }
  if (feedback.isError) {
    return (
      <div className="game-panel support-panel support-empty">
        <p>{feedback.error.message}</p>
        <button type="button" onClick={() => void feedback.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (feedback.data.length === 0) {
    return (
      <p className="game-panel support-panel support-empty">You have not sent any feedback yet.</p>
    );
  }

  return (
    <ul className="support-feedback-list">
      {feedback.data.map((item) => (
        <li key={item.id} className="game-panel support-feedback-card">
          <div className="support-feedback-top">
            <strong>{item.subject}</strong>
            <span className={`support-status is-${item.status}`}>
              {SUPPORT_STATUS_LABELS[item.status]}
            </span>
          </div>
          <p>{item.message}</p>
          <small>
            {item.kind === "complaint" ? "Complaint" : "Suggestion"} ·{" "}
            {new Date(item.created_at).toLocaleDateString()}
          </small>
        </li>
      ))}
    </ul>
  );
}
