const DEFAULT_ORIGIN_BASE_URL = 'http://localhost:8000';
const DEFAULT_KIOSK_RELEASE_POLICY_KV_KEY = 'kiosk-release-policy:override';
const KIOSK_RELEASE_POLICY_PATH = '/api/kiosk-release-policy';

const LEGACY_ORIGIN_PREFIXES = [
  '/api',
  '/api/',
  '/s',
  '/s/',
  '/monitoring',
  '/monitoring/',
];

const FRESHNESS_CRITICAL_FILENAMES = new Set([
  '',
  'index.html',
  'service-worker.js',
  'asset-manifest.json',
  'app-version.json',
]);

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const ORIGIN_ACCESS_HEADERS = new Set([
  'cf-access-client-id',
  'cf-access-client-secret',
]);

function isLegacyOriginPath(pathname) {
  return LEGACY_ORIGIN_PREFIXES.some((prefix) => (
    pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)
  ));
}

function isEdgeDiagnosticPath(pathname) {
  return pathname === '/__edge/health' || pathname === '/__edge/origin-health';
}

function isKioskReleasePolicyPath(pathname) {
  return pathname === KIOSK_RELEASE_POLICY_PATH;
}

function normalizeOriginBaseUrl(value) {
  const rawValue = String(value || DEFAULT_ORIGIN_BASE_URL).trim();
  const parsed = new URL(rawValue);

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('ORIGIN_BASE_URL must use http or https');
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  parsed.username = '';
  parsed.password = '';
  return parsed.toString().replace(/\/$/, '');
}

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');

  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers,
  });
}

function normalizeKioskReleasePolicyOverride(rawPolicy) {
  if (!rawPolicy || typeof rawPolicy !== 'object') {
    return null;
  }

  const mode = rawPolicy.mode === 'force' ? 'force' : 'normal';
  const activeReleaseId = String(rawPolicy.activeReleaseId || '').trim() || 'edge-override';
  const buildVersion = String(rawPolicy.buildVersion || activeReleaseId).trim() || activeReleaseId;
  const forceNonce = mode === 'force'
    ? String(rawPolicy.forceNonce || '').trim()
    : null;

  if (mode === 'force' && !forceNonce) {
    return null;
  }

  return {
    activeReleaseId,
    buildVersion,
    mode,
    forceNonce,
    issuedAt: String(rawPolicy.issuedAt || '').trim() || new Date().toISOString(),
    reasonCode: ['deploy', 'emergency', 'rollback'].includes(rawPolicy.reasonCode)
      ? rawPolicy.reasonCode
      : 'emergency',
  };
}

async function readKioskReleasePolicyOverride(env = {}) {
  const kv = env.KIOSK_RELEASE_POLICY_KV;
  if (!kv || typeof kv.get !== 'function') {
    return null;
  }

  const key = String(env.KIOSK_RELEASE_POLICY_KV_KEY || DEFAULT_KIOSK_RELEASE_POLICY_KV_KEY).trim();
  if (!key) {
    return null;
  }

  const rawPolicy = await kv.get(key, { type: 'json' }).catch(() => null);
  return normalizeKioskReleasePolicyOverride(rawPolicy);
}

function readOriginAccessConfig(env = {}) {
  const clientId = String(env.ORIGIN_ACCESS_CLIENT_ID || '').trim();
  const clientSecret = String(env.ORIGIN_ACCESS_CLIENT_SECRET || '').trim();

  if ((clientId && !clientSecret) || (!clientId && clientSecret)) {
    throw new Error('ORIGIN_ACCESS_CLIENT_ID and ORIGIN_ACCESS_CLIENT_SECRET must be configured together');
  }

  return clientId && clientSecret
    ? { clientId, clientSecret }
    : null;
}

function applyOriginAccessHeaders(headers, env = {}) {
  const accessConfig = readOriginAccessConfig(env);
  if (!accessConfig) {
    return headers;
  }

  headers.set('CF-Access-Client-Id', accessConfig.clientId);
  headers.set('CF-Access-Client-Secret', accessConfig.clientSecret);
  return headers;
}

function copyProxyRequestHeaders(request, env = {}) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (
      HOP_BY_HOP_HEADERS.has(lowerKey) ||
      ORIGIN_ACCESS_HEADERS.has(lowerKey) ||
      lowerKey === 'host'
    ) {
      return;
    }

    headers.append(key, value);
  });

  const url = new URL(request.url);
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  headers.set('X-Checkin-Edge-Proxy', 'cloudflare-workers');

  return applyOriginAccessHeaders(headers, env);
}

function copyProxyResponseHeaders(response) {
  const headers = new Headers();
  const setCookieHeaders = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);

  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (
      HOP_BY_HOP_HEADERS.has(lowerKey) ||
      lowerKey === 'set-cookie'
    ) {
      return;
    }

    headers.append(key, value);
  });

  for (const value of setCookieHeaders) {
    if (!String(value).toLowerCase().startsWith('cf_authorization=')) {
      headers.append('Set-Cookie', value);
    }
  }

  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('X-Checkin-Origin-Proxy', 'cloudflare-workers');

  return headers;
}

function buildOriginUrl(request, originBaseUrl) {
  const requestUrl = new URL(request.url);
  const originUrl = new URL(originBaseUrl);
  originUrl.pathname = `${originUrl.pathname}${requestUrl.pathname}`.replace(/\/{2,}/g, '/');
  originUrl.search = requestUrl.search;
  return originUrl;
}

async function proxyToOrigin(request, env, config) {
  const originBaseUrl = normalizeOriginBaseUrl(env.ORIGIN_BASE_URL);
  const originUrl = buildOriginUrl(request, originBaseUrl);
  const headers = copyProxyRequestHeaders(request, env);
  const requestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
    },
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    requestInit.body = request.body;
    requestInit.duplex = 'half';
  }

  const originRequest = new Request(originUrl.toString(), requestInit);
  const originResponse = await config.fetcher(originRequest);

  return new Response(originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: copyProxyResponseHeaders(originResponse),
  });
}

async function handleKioskReleasePolicy(request, env, config) {
  if (request.method === 'GET') {
    const override = await readKioskReleasePolicyOverride(env);
    if (override) {
      return jsonResponse({
        ...override,
        edgeSource: 'kv-override',
      });
    }
  }

  return proxyToOrigin(request, env, config);
}

function shouldNoStoreAsset(pathname, contentType) {
  const filename = pathname.split('/').pop() || '';
  return (
    FRESHNESS_CRITICAL_FILENAMES.has(filename) ||
    contentType.includes('text/html')
  );
}

function applyAssetCacheHeaders(headers, request, response) {
  const { pathname } = new URL(request.url);
  const contentType = headers.get('Content-Type') || '';

  if (shouldNoStoreAsset(pathname, contentType)) {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    return;
  }

  if (pathname.includes('/static/') && response.ok) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
}

async function serveStaticAsset(request, env, config) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
    return jsonResponse({
      status: 'error',
      code: 'ASSETS_BINDING_MISSING',
      app: config.appName,
    }, { status: 500 });
  }

  const assetResponse = await env.ASSETS.fetch(request);
  const headers = new Headers(assetResponse.headers);
  headers.set('X-Checkin-Edge-App', config.appName);
  applyAssetCacheHeaders(headers, request, assetResponse);

  return new Response(assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}

async function handleOriginHealth(request, env, config) {
  const startedAt = Date.now();

  try {
    const originBaseUrl = normalizeOriginBaseUrl(env.ORIGIN_BASE_URL);
    const originUrl = new URL('/api/health', originBaseUrl);
    const headers = applyOriginAccessHeaders(new Headers({
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      'X-Checkin-Edge-Proxy': 'cloudflare-workers',
    }), env);
    const response = await config.fetcher(originUrl.toString(), {
      method: 'GET',
      headers,
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    });

    const contentType = response.headers.get('Content-Type') || '';
    const originBody = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;

    return jsonResponse({
      status: response.ok ? 'ok' : 'error',
      app: config.appName,
      environment: env.EDGE_ENVIRONMENT || 'local',
      originStatus: response.status,
      originBaseUrl,
      elapsedMs: Date.now() - startedAt,
      origin: originBody,
    }, {
      status: response.ok ? 200 : 502,
    });
  } catch (error) {
    return jsonResponse({
      status: 'error',
      app: config.appName,
      environment: env.EDGE_ENVIRONMENT || 'local',
      elapsedMs: Date.now() - startedAt,
      error: error.message,
    }, { status: 502 });
  }
}

async function handleEdgeHealth(env, config) {
  let originBaseUrl = null;
  let originHost = null;

  try {
    originBaseUrl = normalizeOriginBaseUrl(env.ORIGIN_BASE_URL);
    originHost = new URL(originBaseUrl).host;
  } catch (error) {
    originBaseUrl = 'invalid';
  }

  return jsonResponse({
    status: originBaseUrl === 'invalid' ? 'error' : 'ok',
    app: config.appName,
    environment: env.EDGE_ENVIRONMENT || 'local',
    originBaseUrl,
    originHost,
    checkedAt: new Date().toISOString(),
  }, {
    status: originBaseUrl === 'invalid' ? 500 : 200,
  });
}

async function handleRequest(request, env = {}, config) {
  const url = new URL(request.url);

  if (url.pathname === '/__edge/health') {
    return handleEdgeHealth(env, config);
  }

  if (url.pathname === '/__edge/origin-health') {
    return handleOriginHealth(request, env, config);
  }

  if (isKioskReleasePolicyPath(url.pathname)) {
    return handleKioskReleasePolicy(request, env, config);
  }

  if (isLegacyOriginPath(url.pathname)) {
    return proxyToOrigin(request, env, config);
  }

  if (isEdgeDiagnosticPath(url.pathname)) {
    return jsonResponse({ status: 'error', code: 'NOT_FOUND' }, { status: 404 });
  }

  return serveStaticAsset(request, env, config);
}

export function createAppWorker(options = {}) {
  const config = {
    appName: options.appName || 'checkin-edge',
    fetcher: options.fetcher || ((resource, init) => fetch(resource, init)),
  };

  return {
    async fetch(request, env) {
      try {
        return await handleRequest(request, env, config);
      } catch (error) {
        return jsonResponse({
          status: 'error',
          app: config.appName,
          message: 'Cloudflare edge request failed',
          error: error.message,
        }, { status: 500 });
      }
    },
  };
}

export const _private = {
  applyAssetCacheHeaders,
  applyOriginAccessHeaders,
  buildOriginUrl,
  copyProxyRequestHeaders,
  copyProxyResponseHeaders,
  isKioskReleasePolicyPath,
  isLegacyOriginPath,
  normalizeKioskReleasePolicyOverride,
  normalizeOriginBaseUrl,
  readKioskReleasePolicyOverride,
  readOriginAccessConfig,
};
