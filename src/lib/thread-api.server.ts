export type ThreadAction = "pin" | "unpin" | "mute" | "unmute" | "read" | "star" | "unstar";

type Dependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  act: (
    userId: string,
    threadId: string,
    action: ThreadAction,
    duration?: string,
  ) => Promise<unknown>;
  list: (userId: string) => Promise<unknown>;
};

const durations = new Set(["8h", "1w", "always"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function createThreadHandler(dependencies: Dependencies) {
  return async (request: Request, threadId?: string, action?: ThreadAction) => {
    const userId = await dependencies.authenticate(request);
    if (!userId) return json({ error: { code: "UNAUTHORIZED" } }, 401);
    if (!threadId && !action) return json(await dependencies.list(userId));
    if (!threadId || !uuidPattern.test(threadId) || !action)
      return json({ error: { code: "UNKNOWN_THREAD" } }, 404);
    let duration: string | undefined;
    if (action === "mute") {
      const body = (await request.json().catch(() => null)) as { duration?: unknown } | null;
      if (!body || typeof body.duration !== "string" || !durations.has(body.duration))
        return json({ error: { code: "INVALID_MUTE_DURATION" } }, 400);
      duration = body.duration;
    }
    try {
      return json(await dependencies.act(userId, threadId, action, duration));
    } catch (error) {
      const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
      const code = message.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0] ?? "THREAD_ACTION_FAILED";
      return json({ error: { code } }, code === "PIN_LIMIT_REACHED" ? 409 : 400);
    }
  };
}

export async function handleThreadRequest(
  request: Request,
  threadId?: string,
  action?: ThreadAction,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const handler = createThreadHandler({
    authenticate: async (incoming) => {
      const auth = incoming.headers.get("authorization");
      if (!auth?.startsWith("Bearer ")) return null;
      const { data, error } = await supabaseAdmin.auth.getUser(auth.slice(7).trim());
      return error ? null : (data.user?.id ?? null);
    },
    act: async (userId, id, threadAction, duration) => {
      const { data, error } = await supabaseAdmin.rpc("thread_pref_action_as_user", {
        p_user_id: userId,
        p_thread_id: id,
        p_action: threadAction,
        p_duration: duration ?? null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    list: async (userId) => {
      const { data, error } = await supabaseAdmin.rpc("get_social_thread_summaries_as_user", {
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  return handler(request, threadId, action);
}
