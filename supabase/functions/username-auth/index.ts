const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required');

const rawSecretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
if (!rawSecretKeys) throw new Error('SUPABASE_SECRET_KEYS is required');

let secretKeys: Record<string, string>;
try {
  secretKeys = JSON.parse(rawSecretKeys);
} catch {
  throw new Error('SUPABASE_SECRET_KEYS must be valid JSON');
}

const secretKey = secretKeys['new_ secret_key'];
if (!secretKey) throw new Error('The configured secret key name was not found');

const supabaseUrl = SUPABASE_URL.replace(/\/$/, '');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('apikey', secretKey);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${supabaseUrl}${path}`, { ...init, headers });
}

async function readJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function findUserId(username: string): Promise<string | null> {
  const query = new URLSearchParams({
    select: 'id',
    username: `eq.${username}`,
    limit: '1',
  });
  const response = await apiFetch(`/rest/v1/profiles?${query.toString()}`);
  if (!response.ok) throw new Error('Profile lookup failed');
  const rows = await readJson(response);
  return Array.isArray(rows) && typeof rows[0]?.id === 'string' ? rows[0].id : null;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const response = await apiFetch(`/auth/v1/admin/users/${encodeURIComponent(userId)}`);
  if (!response.ok) return null;
  const result = await readJson(response);
  const user = result?.user ?? result;
  return typeof user?.email === 'string' ? user.email : null;
}

async function saveUsername(userId: string, username: string): Promise<boolean> {
  const response = await apiFetch('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: userId, username }),
  });
  return response.ok;
}

async function deleteProfile(userId: string): Promise<void> {
  await apiFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

async function deleteAuthUser(userId: string): Promise<void> {
  await apiFetch(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

async function handleRegister(body: any): Promise<Response> {
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return respond({ error: 'Username must be 3–24 characters using lowercase letters, numbers, or underscores.' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    return respond({ error: 'Enter a valid email and a password of at least 8 characters.' }, 400);
  }

  let existingId: string | null;
  try {
    existingId = await findUserId(username);
  } catch {
    return respond({ error: 'Sign-up is temporarily unavailable.' }, 503);
  }
  if (existingId) return respond({ error: 'That username is unavailable.' }, 409);

  const signupResponse = await apiFetch('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { username } }),
  });
  const signup = await readJson(signupResponse);
  if (!signupResponse.ok) {
    return respond({ error: 'Could not create the account. Check the details or try again later.' }, 400);
  }

  const user = signup?.user ?? signup;
  const userId = typeof user?.id === 'string' ? user.id : null;
  if (!userId) return respond({ error: 'Could not create the account.' }, 500);

  if (!(await saveUsername(userId, username))) {
    await deleteProfile(userId);
    await deleteAuthUser(userId);
    return respond({ error: 'That username is unavailable.' }, 409);
  }

  if (typeof signup?.access_token === 'string' && typeof signup?.refresh_token === 'string') {
    return respond({
      access_token: signup.access_token,
      refresh_token: signup.refresh_token,
      expires_in: signup.expires_in,
      expires_at: signup.expires_at,
      token_type: signup.token_type,
      user,
    });
  }

  return respond({ user, needsEmailConfirmation: true }, 202);
}

async function handleLogin(body: any): Promise<Response> {
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[a-z0-9_]{3,24}$/.test(username) || password.length === 0) {
    return respond({ error: 'Invalid username or password.' }, 401);
  }

  let userId: string | null;
  try {
    userId = await findUserId(username);
  } catch {
    return respond({ error: 'Sign-in is temporarily unavailable.' }, 503);
  }
  if (!userId) return respond({ error: 'Invalid username or password.' }, 401);

  const email = await getUserEmail(userId);
  if (!email) return respond({ error: 'Invalid username or password.' }, 401);

  const loginResponse = await apiFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const session = await readJson(loginResponse);
  if (!loginResponse.ok || typeof session?.access_token !== 'string' || typeof session?.refresh_token !== 'string') {
    return respond({ error: 'Invalid username or password.' }, 401);
  }

  return respond(session);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return respond({ error: 'Request body must be valid JSON.' }, 400);
  }

  if (body?.action === 'register') return await handleRegister(body);
  if (body?.action === 'login') return await handleLogin(body);
  return respond({ error: 'Unsupported action.' }, 400);
});