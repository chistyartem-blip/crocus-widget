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
  '/resources/',
  '/staff/',
  '/services/',
  '/clients/',
  '/client/',
  '/analytics/',
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(request),
      });
    }

    // Support two modes:
    // 1. Vercel-compat: /api/proxy?path=book_services/1357963&...
    // 2. Native: /api/book_services/1357963

    let altegioPath, extraSearch;

    if (url.pathname === '/api/proxy' && url.searchParams.has('path')) {
      // Vercel-compat mode: extract path from ?path= param
      const rawPath = url.searchParams.get('path');
      altegioPath = '/' + rawPath.replace(/^\//, '');
      // Rebuild query without the 'path' param
      const qs = new URLSearchParams(url.search);
      qs.delete('path');
      extraSearch = qs.toString() ? '?' + qs.toString() : '';
    } else if (url.pathname.startsWith('/api/')) {
      // Native mode
      altegioPath = url.pathname.replace('/api', '');
      extraSearch = url.search;
    } else {
      return new Response('Not found', { status: 404 });
    }

    if (altegioPath === '/combo_book') {
      return handleComboBook(request, env);
    }
    if (altegioPath === '/batch_book_check') {
      return handleBatchBookCheck(request, env);
    }

    const altegioUrl = ALTEGIO_BASE + altegioPath + extraSearch;
    const cacheTtl = cacheTtlFor(request.method, altegioPath);
    const cacheKey = cacheTtl > 0
      ? new Request('https://crocus-cache.local' + altegioPath + extraSearch, { method: 'GET' })
      : null;
    if (cacheKey) {
      const cached = await caches.default.match(cacheKey);
      if (cached) {
        return new Response(await cached.text(), {
          status: cached.status,
          headers: {
            ...corsHeaders(request),
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=' + cacheTtl,
            'X-Crocus-Cache': 'HIT',
          },
        });
      }
    }

    // Determine auth headers
    const isB2B = B2B_PATHS.some(p => altegioPath.startsWith(p));
    const authHeader = isB2B
      ? `Bearer ${env.ALTEGIO_PARTNER_TOKEN}, User ${env.ALTEGIO_USER_TOKEN}`
      : `Bearer ${env.ALTEGIO_PARTNER_TOKEN}`;

    // Build request to Altegio
    const headers = new Headers({
      'Authorization':   authHeader,
      'Accept':          'application/vnd.api.v2+json',
      'Content-Type':    'application/json',
      'Accept-Language': request.headers.get('Accept-Language') || 'de',
    });

    const proxyReq = new Request(altegioUrl, {
      method:  request.method,
      headers,
      body:    ['GET', 'HEAD'].includes(request.method) ? null : await request.text(),
    });

    try {
      const res = await fetch(proxyReq);
      const body = await res.text();
      if (cacheKey && res.ok) {
        const cacheResponse = new Response(body, {
          status: res.status,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=' + cacheTtl,
          },
        });
        const put = caches.default.put(cacheKey, cacheResponse);
        if (ctx && ctx.waitUntil) ctx.waitUntil(put);
        else await put;
      }

      return new Response(body, {
        status:  res.status,
        headers: {
          ...corsHeaders(request),
          'Content-Type': 'application/json',
          'Cache-Control': cacheTtl > 0 ? 'public, max-age=' + cacheTtl : 'no-store',
          'X-Crocus-Cache': cacheTtl > 0 ? 'MISS' : 'BYPASS',
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

function cacheTtlFor(method, path) {
  if (method !== 'GET') return 0;
  if (path.startsWith('/book_times/')) return 20;
  if (path.startsWith('/book_dates/')) return 30;
  if (path.startsWith('/book_services/')) return 300;
  if (path.startsWith('/book_staff/')) return 300;
  if (path.startsWith('/book_staff_seances/')) return 120;
  return 0;
}

async function altegioRequest(env, path, method, body) {
  const res = await fetch(ALTEGIO_BASE + path, {
    method,
    headers: {
      'Authorization': `Bearer ${env.ALTEGIO_PARTNER_TOKEN}`,
      'Accept': 'application/vnd.api.v2+json',
      'Content-Type': 'application/json',
      'Accept-Language': 'de',
    },
    body: body == null ? null : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { ok: res.ok, status: res.status, text, json };
}

function responseData(result) {
  if (!result || !result.json) return null;
  return result.json.data !== undefined ? result.json.data : result.json;
}

function createdRecord(result) {
  const data = responseData(result);
  const record = Array.isArray(data) ? data[0] : data;
  return record && record.record_id && record.record_hash ? record : null;
}

async function deleteCreatedRecord(env, record) {
  if (!record) return false;
  const path = `/user/records/${encodeURIComponent(record.record_id)}/${encodeURIComponent(record.record_hash)}`;
  const result = await altegioRequest(env, path, 'DELETE');
  return result.ok;
}

async function handleComboBook(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse(request, { success: false, message: 'Method not allowed' }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return jsonResponse(request, { success: false, message: 'Invalid JSON' }, 400);
  }

  const companyId = String(payload.company_id || '');
  const appointments = Array.isArray(payload.appointments) ? payload.appointments : [];
  if (!companyId || appointments.length !== 2) {
    return jsonResponse(request, { success: false, message: 'Kombi requires exactly two appointments' }, 400);
  }

  const ordered = appointments.slice().sort((a, b) => String(a.datetime).localeCompare(String(b.datetime)));
  const baseBody = { ...payload };
  delete baseBody.company_id;
  delete baseBody.appointments;

  const check = await altegioRequest(env, `/book_check/${companyId}`, 'POST', {
    ...baseBody,
    notify_by_email: 0,
    appointments: ordered,
  });
  if (!check.ok || (check.json && check.json.success === false)) {
    return jsonResponse(request, check.json || { success: false, message: 'Selected time is unavailable' }, check.status || 409);
  }

  // Reserve the later resource first. The customer notification is sent only
  // after the earlier appointment is also created successfully.
  const laterResult = await altegioRequest(env, `/book_record/${companyId}`, 'POST', {
    ...baseBody,
    notify_by_email: 0,
    appointments: [ordered[1]],
  });
  const laterRecord = createdRecord(laterResult);
  if (!laterResult.ok || !laterRecord) {
    return jsonResponse(request, laterResult.json || { success: false, message: 'Kombi booking failed' }, laterResult.status || 409);
  }

  const earlierResult = await altegioRequest(env, `/book_record/${companyId}`, 'POST', {
    ...baseBody,
    notify_by_email: payload.notify_by_email ? 1 : 0,
    appointments: [ordered[0]],
  });
  const earlierRecord = createdRecord(earlierResult);
  if (!earlierResult.ok || !earlierRecord) {
    const rolledBack = await deleteCreatedRecord(env, laterRecord);
    return jsonResponse(request, {
      success: false,
      message: 'Selected time is unavailable',
      rolled_back: rolledBack,
    }, 409);
  }

  return jsonResponse(request, {
    success: true,
    data: [earlierRecord, laterRecord],
  }, 201);
}

async function handleBatchBookCheck(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse(request, { success: false, message: 'Method not allowed' }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return jsonResponse(request, { success: false, message: 'Invalid JSON' }, 400);
  }

  const companyId = String(payload.company_id || '');
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  if (!companyId || candidates.length === 0) {
    return jsonResponse(request, { success: false, message: 'No slots to check', ok: [] }, 400);
  }

  const maxChecks = clampInt(payload.max_checks || 24, 1, 32);
  const target = clampInt(payload.target || 16, 1, 24);
  const concurrency = clampInt(payload.concurrency || 4, 1, 4);
  const base = payload.base && typeof payload.base === 'object' ? payload.base : {};
  const queue = candidates.slice(0, maxChecks).map((candidate, index) => ({
    index,
    key: candidate && candidate.key,
    appointments: Array.isArray(candidate && candidate.appointments) ? candidate.appointments : [],
  })).filter(candidate => candidate.appointments.length > 0);

  const startedAt = Date.now();
  const ok = [];
  let cursor = 0;
  let checked = 0;

  async function worker() {
    while (cursor < queue.length && ok.length < target) {
      const item = queue[cursor++];
      const result = await altegioRequest(env, `/book_check/${companyId}`, 'POST', {
        phone: base.phone || '+4915700000616',
        fullname: base.fullname || 'Online Booking Check',
        email: base.email || '',
        notify_by_email: 0,
        lang: base.lang || 'de',
        lang_id: base.lang_id || 3,
        bookform_id: base.bookform_id || 1427839,
        appointments: item.appointments,
      });
      checked++;
      if (result.ok && !(result.json && result.json.success === false)) {
        ok.push({ index: item.index, key: item.key });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
  ok.sort((a, b) => a.index - b.index);

  return jsonResponse(request, {
    success: true,
    ok: ok.slice(0, target),
    checked,
    duration_ms: Date.now() - startedAt,
  }, 200);
}

function clampInt(value, min, max) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function jsonResponse(request, body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Accept-Language, Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}
