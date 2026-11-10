import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261108180000_support_feedback.sql"),
  "utf8",
);

describe("support feedback migration", () => {
  it("keeps the table behind row-level security with own-row reads only", () => {
    expect(migration).toContain("alter table public.support_feedback enable row level security;");
    expect(migration).toContain(
      "revoke all on public.support_feedback from public, anon, authenticated;",
    );
    expect(migration).toMatch(
      /create policy "Read own support feedback"[\s\S]*using \(user_id = \(select auth\.uid\(\)\)\)/,
    );
    expect(migration).not.toMatch(/grant (insert|update|delete)[^;]*on public\.support_feedback/);
  });

  it("limits what can be stored in the table itself", () => {
    expect(migration).toContain("check (kind in ('suggestion', 'complaint'))");
    expect(migration).toContain("check (char_length(subject) between 3 and 120)");
    expect(migration).toContain("check (char_length(message) between 10 and 1000)");
  });

  it("starts complaints in progress and suggestions as received", () => {
    expect(migration).toContain(
      "case when p_kind = 'complaint' then 'in_progress' else 'received' end",
    );
  });

  it("runs submissions through a validated, rate-limited security definer RPC", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("if v_user is null then");
    expect(migration).toContain("if v_recent >= 5 then");
    expect(migration).toContain(
      "revoke all on function public.submit_support_feedback(text, text, text, text) from public, anon;",
    );
    expect(migration).toContain(
      "grant execute on function public.submit_support_feedback(text, text, text, text) to authenticated;",
    );
  });
});
