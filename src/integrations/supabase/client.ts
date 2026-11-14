import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createUnconfiguredSupabaseClient(message: string) {
  const notConfiguredError = new Error(message);
  const queryResult = Promise.resolve({ data: [], error: null, count: 0 });
  const singleResult = Promise.resolve({ data: null, error: null });

  const makeQueryBuilder = (): unknown =>
    new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") {
            return queryResult.then.bind(queryResult);
          }
          if (prop === "single" || prop === "maybeSingle") {
            return () => singleResult;
          }
          return () => makeQueryBuilder();
        },
      },
    );

  const noopChannel = {
    on: () => noopChannel,
    subscribe: () => noopChannel,
    unsubscribe: async () => "ok",
    send: async () => "ok",
    track: async () => "ok",
    untrack: async () => "ok",
  };

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { id: "offline", callback: () => {}, unsubscribe: () => {} } },
      }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: notConfiguredError,
      }),
      signInWithOAuth: async () => ({
        data: { provider: "google", url: "" },
        error: notConfiguredError,
      }),
      signUp: async () => ({ data: { user: null, session: null }, error: notConfiguredError }),
      setSession: async () => ({ data: { user: null, session: null }, error: notConfiguredError }),
      updateUser: async () => ({ data: { user: null }, error: notConfiguredError }),
      resetPasswordForEmail: async () => ({ data: null, error: notConfiguredError }),
    },
    from: () => makeQueryBuilder(),
    rpc: async () => ({ data: null, error: null }),
    channel: () => noopChannel,
    removeChannel: async () => "ok",
    storage: {
      from: () => ({
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        upload: async () => ({ data: null, error: notConfiguredError }),
        createSignedUrl: async () => ({ data: null, error: notConfiguredError }),
      }),
    },
  } as unknown as ReturnType<typeof createClient<Database>>;
}

function createSupabaseClient() {
  // Use import.meta.env for client-side (Vite build-time replacement)
  // Fall back to process.env for SSR (server-side rendering)
  const serverEnv = typeof process === "undefined" ? undefined : process.env;
  const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || serverEnv?.["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || serverEnv?.["SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Configure your local .env file.`;
    console.warn(`[Supabase] ${message} Running with offline stub client.`);
    return createUnconfiguredSupabaseClient(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
