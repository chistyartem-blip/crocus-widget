/**
 * Crocus Booking Proxy — Cloudflare Worker
 * Скрывает partner_token от браузера, проксирует запросы к Altegio API
 *
 * Env vars (wrangler secrets):
 *   ALTEGIO_PARTNER_TOKEN  — партнёрский токен
 *   ALTEGIO_USER_TOKEN     — пользовательский токен (для B2B)
 */

const ALTEGIO_BASE = 'https://api.alteg.io/api/v1';

// Разрешённые публичные эндпоинты (без user token)
const PUBLIC_PATHS = [
  '/book_services/',
  '/book_staff/',
  '/book_staff_seances/',
  '/book_dates/',
  '/book_times/',
  '/book_check/',
  '/book_record/',
  '/bookform/',
];

// B2B эндпоинты (требуют user token)
const B2B_PATHS = [
  '/records/',
  '/record/',
  '/staff/',
  '/services/',
  '/clients/',
  '/client/',
  '/analytics/',
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(request),
      });
    }

    // Only proxy /api/* paths
    if (!url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    // Strip /api prefix → Altegio path
    const altegioPath = url.pathname.replace('/api', '');
    const altegioUrl  = ALTEGIO_BASE + altegioPath + url.search;

    // Determine auth headers
    const isB2B = B2B_PATHS.some(p => altegioPath.startsWith(p));
    const authHeader = isB2B
      ? `Bearer ${env.ALTEGIO_PARTNER_TOKEN}, User ${env.ALTEGIO_USER_TOKEN}`
      : `Bearer ${env.ALTEGIO_PARTNER_TOKEN}`;

    // Build request to Altegio
    const headers = new Headers({
      'Authorization': authHeader,
      'Accept':        'application/vnd.api.v2+json',
      'Content-Type':  'application/json',
    });

    const proxyReq = new Request(altegioUrl, {
      method:  request.method,
      headers,
      body:    ['GET', 'HEAD'].includes(request.method) ? null : await request.text(),
    });

    try {
      const res = await fetch(proxyReq);
      const body = await res.text();

      return new Response(body, {
        status:  res.status,
        headers: {
          ...corsHeaders(request),
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 502,
        headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
      });
    }
  }
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}
