export type SupportFaq = {
  id: string;
  question: string;
  answer: string;
  /** Extra words that also match this question when the player searches. */
  keywords: readonly string[];
};

/** Prepared answers the Support app shows automatically. Edit the wording here. */
export const SUPPORT_FAQS: readonly SupportFaq[] = [
  {
    id: "find-places",
    question: "How do I find places in town?",
    answer: "Open Map to see the town. Tap a location to see what you can do there.",
    keywords: ["map", "location", "travel", "go", "find", "where"],
  },
  {
    id: "messages",
    question: "How do I message another player?",
    answer:
      "Open Messages, tap the + button to start a new message, search for the player, then send your message.",
    keywords: ["message", "chat", "talk", "friend", "send"],
  },
  {
    id: "money",
    question: "Where do I check my money?",
    answer: "Open Bank to see your balance, your transactions and your accounts.",
    keywords: ["money", "bank", "balance", "cash", "account", "naira"],
  },
  {
    id: "missions",
    question: "How do missions work?",
    answer:
      "Open Missions to see your active tasks. When a mission is complete, claim its reward from the same screen.",
    keywords: ["mission", "task", "reward", "quest", "claim"],
  },
  {
    id: "activities",
    question: "How do I do an activity?",
    answer:
      "Open Activities, choose a location and an activity, then start it. Some activities have a cooldown before you can do them again.",
    keywords: ["activity", "activities", "work", "cooldown", "energy"],
  },
  {
    id: "property",
    question: "How do I buy property?",
    answer: "Open Property to browse listings. Open Real Estate for more options and availability.",
    keywords: ["property", "house", "buy", "real estate", "land", "home"],
  },
  {
    id: "market",
    question: "How do I rent a market stall?",
    answer:
      "Open Market, choose a stall that is available, then pick the category for your goods or service.",
    keywords: ["market", "stall", "sell", "shop", "rent"],
  },
  {
    id: "party",
    question: "How do I host a party?",
    answer:
      "Open Party, pick an event centre and a date, then invite the players you want to join.",
    keywords: ["party", "event", "invite", "host", "club"],
  },
  {
    id: "report",
    question: "How do I report a player?",
    answer:
      "Open the player's profile from Messages or Players and choose Report. Pick the reason and send it.",
    keywords: ["report", "player", "abuse", "harass", "block"],
  },
  {
    id: "bug",
    question: "Something is broken. What should I do?",
    answer:
      "Send a complaint from the Feedback tab and choose Bug or error. Say what you were doing and what went wrong.",
    keywords: ["bug", "broken", "error", "crash", "stuck", "not working", "problem"],
  },
];

/**
 * Returns the prepared answers that match a search. An empty search returns every answer.
 * Matches are case-insensitive and check the question and its keywords.
 */
export function findSupportAnswers(
  query: string,
  faqs: readonly SupportFaq[] = SUPPORT_FAQS,
): SupportFaq[] {
  const term = query.trim().toLowerCase();
  if (!term) return [...faqs];
  return faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(term) ||
      faq.keywords.some(
        (keyword) => keyword.includes(term) || (keyword.length > 3 && term.includes(keyword)),
      ),
  );
}
