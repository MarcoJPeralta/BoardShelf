import { createRemoteJWKSet, jwtVerify } from 'jose';

interface Env {
  ASSETS: Fetcher;
  BGG_API_TOKEN: string;
  FIREBASE_PROJECT_ID: string;
  BGG_RATE_LIMITER: RateLimit;
}

const BGG_ORIGIN = 'https://boardgamegeek.com';
const CACHE_TTL_SECONDS = 60 * 60 * 24;
const MAX_QUERY_LENGTH = 100;

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

/** Returns the Firebase uid of the caller, or null when the ID token is missing or invalid. */
async function verifyUser(request: Request, projectId: string): Promise<string | null> {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    return payload.sub || null;
  } catch {
    return null;
  }
}

/** Only these two BGG requests can be made, so the proxy can't be used to reach anything else. */
function buildBggUrl(url: URL): URL | null {
  if (url.pathname === '/api/bgg/search') {
    const query = url.searchParams.get('query')?.trim();
    const page = url.searchParams.get('page') ?? '1';
    if (!query || query.length > MAX_QUERY_LENGTH || !/^\d{1,4}$/.test(page)) return null;

    const target = new URL('/xmlapi2/search', BGG_ORIGIN);
    target.search = new URLSearchParams({ query, type: 'boardgame', page }).toString();
    return target;
  }

  if (url.pathname === '/api/bgg/thing') {
    const id = url.searchParams.get('id') ?? '';
    if (!/^\d{1,10}$/.test(id)) return null;

    const target = new URL('/xmlapi2/thing', BGG_ORIGIN);
    target.search = new URLSearchParams({ id, stats: '1' }).toString();
    return target;
  }

  return null;
}

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function handleBgg(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405, 'Method not allowed.');

  const target = buildBggUrl(new URL(request.url));
  if (!target) return errorResponse(400, 'Invalid request.');

  const uid = await verifyUser(request, env.FIREBASE_PROJECT_ID);
  if (!uid) return errorResponse(401, 'Sign in required.');

  const { success } = await env.BGG_RATE_LIMITER.limit({ key: uid });
  if (!success) return errorResponse(429, 'Too many requests.');

  // Keyed by the BGG URL, so the user's Authorization header never reaches the cache
  const cache = caches.default;
  const cacheKey = new Request(target.toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const upstream = await fetch(target, {
    headers: {
      Authorization: `Bearer ${env.BGG_API_TOKEN}`,
      Accept: 'application/xml',
      'User-Agent': 'BoardShelf (https://boardshelf.online)',
    },
  });

  if (upstream.status === 401 || upstream.status === 403) {
    // A BGG auth failure is our token's problem and must not look like the user's session expiring
    console.error(`BGG rejected the API token: ${upstream.status}`);
    return errorResponse(502, 'BoardGameGeek request failed.');
  }
  if (upstream.status === 429) return errorResponse(429, 'BoardGameGeek rate limit reached.');
  if (!upstream.ok) return errorResponse(503, 'BoardGameGeek is busy.');

  const response = new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': upstream.status === 200 ? `private, max-age=${CACHE_TTL_SECONDS}` : 'no-store',
    },
  });

  // BGG answers 202 while a request is still queued; only a finished answer is worth keeping
  if (upstream.status === 200) {
    const shared = response.clone();
    shared.headers.set('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}`);
    ctx.waitUntil(cache.put(cacheKey, shared));
  }
  return response;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/api/')) {
      return handleBgg(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
