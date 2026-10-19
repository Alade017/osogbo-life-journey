export const MESSAGE_CHARACTER_LIMIT = 1_000;

type MessageInput = {
  channel: "area" | "private";
  body: string;
  locationId?: string;
  conversationId?: string;
  replyToMessageId?: string;
};

type Dependencies = {
  authenticate: (request: Request) => Promise<string | null>;
  send: (userId: string, input: MessageInput, requestId: string) => Promise<unknown>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(code: string, status: number) {
  return Response.json({ error: { code } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function createMessageSendHandler(dependencies: Dependencies) {
  return async (request: Request) => {
    const userId = await dependencies.authenticate(request);
    if (!userId) return failure("UNAUTHORIZED", 401);
    let value: unknown;
    try {
      value = await request.json();
    } catch {
      return failure("INVALID_REQUEST", 400);
    }
    if (!value || typeof value !== "object") return failure("INVALID_REQUEST", 400);
    const body = "body" in value && typeof value.body === "string" ? value.body.trim() : "";
    const channel = "channel" in value ? value.channel : null;
    const locationId = "locationId" in value ? value.locationId : undefined;
    const conversationId = "conversationId" in value ? value.conversationId : undefined;
    const replyToMessageId = "replyToMessageId" in value ? value.replyToMessageId : undefined;
    if (!body || body.length > MESSAGE_CHARACTER_LIMIT)
      return failure("MESSAGE_LENGTH_INVALID", 400);
    if (channel !== "area" && channel !== "private") return failure("INVALID_CHANNEL", 400);
    if (
      (locationId !== undefined && typeof locationId !== "string") ||
      (conversationId !== undefined && typeof conversationId !== "string") ||
      (replyToMessageId !== undefined &&
        (typeof replyToMessageId !== "string" || !uuidPattern.test(replyToMessageId))) ||
      (channel === "area" && (!locationId || conversationId)) ||
      (channel === "private" && (!conversationId || locationId))
    )
      return failure("INVALID_DESTINATION", 400);
    const requestId = request.headers.get("Idempotency-Key")?.trim() ?? "";
    if (!uuidPattern.test(requestId)) return failure("INVALID_IDEMPOTENCY_KEY", 400);
    try {
      const result = await dependencies.send(
        userId,
        {
          channel,
          body,
          ...(locationId ? { locationId } : {}),
          ...(conversationId ? { conversationId } : {}),
          ...(replyToMessageId ? { replyToMessageId } : {}),
        },
        requestId,
      );
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
      const code = message.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0] ?? "MESSAGE_REJECTED";
      return failure(code, code === "MESSAGE_RATE_LIMIT" ? 429 : 409);
    }
  };
}

export async function handleMessageSendRequest(request: Request) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return createMessageSendHandler({
    authenticate: async (incoming) => {
      const authorization = incoming.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) return null;
      const { data, error } = await supabaseAdmin.auth.getUser(authorization.slice(7).trim());
      return error ? null : (data.user?.id ?? null);
    },
    send: async (userId, input, requestId) => {
      const { data, error } = await supabaseAdmin.rpc("send_social_message_as_user", {
        p_user_id: userId,
        p_channel: input.channel,
        p_body: input.body,
        p_request_id: requestId,
        ...(input.locationId ? { p_location_id: input.locationId } : {}),
        ...(input.conversationId ? { p_conversation_id: input.conversationId } : {}),
        ...(input.replyToMessageId ? { p_reply_to_message_id: input.replyToMessageId } : {}),
      });
      if (error) throw new Error(error.message);
      return data;
    },
  })(request);
}
