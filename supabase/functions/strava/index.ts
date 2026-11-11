import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const appUrl = new URL(Deno.env.get('STRAVA_APP_URL')!);
const cors = {
  'Access-Control-Allow-Origin': appUrl.origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

function reply(body: object, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

async function key() {
  const raw = Uint8Array.from(atob(Deno.env.get('STRAVA_TOKEN_KEY')!), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error('Invalid encryption key');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...iv, ...encrypted));
}

async function decrypt(value: string) {
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await key(), bytes.slice(12)));
}

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Deno.env.get('STRAVA_CLIENT_ID'),
      client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
      ...params,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Strava-Token ungültig oder abgelaufen. Bitte verbinde Strava erneut.');
  const data = await response.json();
  if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string' ||
      typeof data.expires_at !== 'number' || !Number.isFinite(data.expires_at)) {
    throw new Error('Ungültige Antwort von Strava.');
  }
  return data;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const auth = request.headers.get('Authorization') ?? '';
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return reply({ error: 'Anmeldung erforderlich.' }, 401);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const body = await request.json();
    if (body.action === 'connect') {
      if (typeof body.code !== 'string' || body.code.length > 1024 || !body.code) return reply({ error: 'Ungültiger Autorisierungscode.' }, 400);
      const tokens = await tokenRequest({ code: body.code, grant_type: 'authorization_code' });
      if (!Number.isSafeInteger(tokens.athlete?.id) || tokens.athlete.id <= 0) throw new Error('Ungültige Strava-Athleten-ID.');
      const { error } = await admin.rpc('save_strava_connection', {
        p_user_id: user.id, p_athlete_id: tokens.athlete.id,
        p_access_token: await encrypt(tokens.access_token), p_refresh_token: await encrypt(tokens.refresh_token),
        p_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
      });
      if (error) throw new Error('Die Verbindung konnte nicht gespeichert werden.');
      return reply({ connected: true });
    }
    if (body.action === 'refresh') {
      const lock = crypto.randomUUID();
      const stale = new Date(Date.now() - 60000).toISOString();
      const { data: member, error } = await admin.from('community_members')
        .update({ strava_refresh_lock: lock, strava_refresh_locked_at: new Date().toISOString() })
        .eq('user_id', user.id).not('strava_refresh_token', 'is', null)
        .lt('strava_token_expires_at', new Date(Date.now() + 300000).toISOString())
        .or(`strava_refresh_locked_at.is.null,strava_refresh_locked_at.lt.${stale}`)
        .select('strava_refresh_token').maybeSingle();
      if (error) throw new Error('Die Verbindung konnte nicht geladen werden.');
      if (!member) return reply({ refreshed: false });
      try {
        const tokens = await tokenRequest({ refresh_token: await decrypt(member.strava_refresh_token), grant_type: 'refresh_token' });
        const { error: saveError } = await admin.from('community_members').update({
          strava_access_token: await encrypt(tokens.access_token),
          strava_refresh_token: await encrypt(tokens.refresh_token),
          strava_token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
          strava_refresh_lock: null, strava_refresh_locked_at: null,
        }).eq('user_id', user.id).eq('strava_refresh_lock', lock);
        if (saveError) throw new Error('Das erneuerte Token konnte nicht gespeichert werden.');
        return reply({ refreshed: true });
      } finally {
        await admin.from('community_members').update({ strava_refresh_lock: null, strava_refresh_locked_at: null })
          .eq('user_id', user.id).eq('strava_refresh_lock', lock);
      }
    }
    return reply({ error: 'Ungültige Aktion.' }, 400);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Strava-Anfrage fehlgeschlagen.' }, 400);
  }
});
