import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { createAppWorker, _private } from '../shared/gateway.mjs';

const makeAssets = (responseFactory = () => new Response('<html>app</html>', {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
})) => ({
  fetch: async (request) => responseFactory(request),
});

function stripJsonComments(source) {
  let result = '';
  let inString = false;
  let stringQuote = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === stringQuote) {
        inString = false;
        stringQuote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    result += char;
  }

  return result;
}

function readJsonc(filePath) {
  return JSON.parse(stripJsonComments(fs.readFileSync(filePath, 'utf8')));
}

test('edge health reports configured app and origin without calling origin', async () => {
  const worker = createAppWorker({
    appName: 'test-main',
    fetcher: async () => {
      throw new Error('origin should not be called');
    },
  });

  const response = await worker.fetch(
    new Request('https://preview.example.com/__edge/health'),
    { ORIGIN_BASE_URL: 'https://origin.example.com', EDGE_ENVIRONMENT: 'test' }
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.app, 'test-main');
  assert.equal(body.environment, 'test');
  assert.equal(body.originHost, 'origin.example.com');
});

test('origin health calls legacy origin health endpoint', async () => {
  let requestedUrl = null;
  let requestedHeaders = null;
  const worker = createAppWorker({
    appName: 'test-main',
    fetcher: async (resource, init = {}) => {
      requestedUrl = String(resource);
      requestedHeaders = new Headers(init.headers);
      return new Response(JSON.stringify({ status: 'ok', releaseId: 'release-1' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const response = await worker.fetch(
    new Request('https://preview.example.com/__edge/origin-health'),
    { ORIGIN_BASE_URL: 'https://origin.example.com/base' }
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(requestedUrl, 'https://origin.example.com/api/health');
  assert.equal(requestedHeaders.get('cf-access-client-id'), null);
  assert.equal(requestedHeaders.get('cf-access-client-secret'), null);
  assert.equal(body.status, 'ok');
  assert.equal(body.origin.releaseId, 'release-1');
});

test('origin health sends configured Access service token headers', async () => {
  let requestedHeaders = null;
  const worker = createAppWorker({
    appName: 'test-main',
    fetcher: async (resource, init = {}) => {
      requestedHeaders = new Headers(init.headers);
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const response = await worker.fetch(
    new Request('https://preview.example.com/__edge/origin-health'),
    {
      ORIGIN_BASE_URL: 'https://origin.example.com',
      ORIGIN_ACCESS_CLIENT_ID: 'worker-client-id',
      ORIGIN_ACCESS_CLIENT_SECRET: 'worker-client-secret',
    }
  );

  assert.equal(response.status, 200);
  assert.equal(requestedHeaders.get('cf-access-client-id'), 'worker-client-id');
  assert.equal(requestedHeaders.get('cf-access-client-secret'), 'worker-client-secret');
});

test('api, short-url, and monitoring paths are proxied to the origin', async () => {
  const proxiedPaths = [
    '/api',
    '/api/health',
    '/api/sms/abandoned-walkin',
    '/api/survey/status',
    '/api/waivers/portal/test-token',
    '/api/waivers/portal/test-token/submit',
    '/api/sse/manager/bloom-updates/G0X353MBKGTCW',
    '/s',
    '/s/abc123',
    '/monitoring',
    '/monitoring/stats',
  ];

  for (const proxiedPath of proxiedPaths) {
    let originRequest = null;
    const worker = createAppWorker({
      appName: 'test-main',
      fetcher: async (request) => {
        originRequest = request;
        return new Response('ok', {
          headers: {
            'Content-Type': 'text/plain',
            Connection: 'keep-alive',
          },
        });
      },
    });

    const response = await worker.fetch(
      new Request(`https://preview.example.com${proxiedPath}?q=1`, {
        headers: {
          'x-auth-token': 'manager-token',
          Connection: 'close',
        },
      }),
      { ORIGIN_BASE_URL: 'https://origin.example.com' }
    );

    assert.equal(originRequest.url, `https://origin.example.com${proxiedPath}?q=1`);
    assert.equal(originRequest.headers.get('x-auth-token'), 'manager-token');
    assert.equal(originRequest.headers.get('x-forwarded-host'), 'preview.example.com');
    assert.equal(originRequest.headers.get('connection'), null);
    assert.equal(response.headers.get('Connection'), null);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
  }
});

test('proxy strips client Access headers and applies Worker service token headers', async () => {
  let originRequest = null;
  const worker = createAppWorker({
    appName: 'test-main',
    fetcher: async (request) => {
      originRequest = request;
      return new Response('ok');
    },
  });

  const response = await worker.fetch(
    new Request('https://preview.example.com/api/health', {
      headers: {
        'CF-Access-Client-Id': 'spoofed-id',
        'CF-Access-Client-Secret': 'spoofed-secret',
      },
    }),
    {
      ORIGIN_BASE_URL: 'https://origin.example.com',
      ORIGIN_ACCESS_CLIENT_ID: 'worker-client-id',
      ORIGIN_ACCESS_CLIENT_SECRET: 'worker-client-secret',
    }
  );

  assert.equal(response.status, 200);
  assert.equal(originRequest.headers.get('cf-access-client-id'), 'worker-client-id');
  assert.equal(originRequest.headers.get('cf-access-client-secret'), 'worker-client-secret');
});

test('proxy strips Cloudflare Access authorization cookies from origin responses', async () => {
  const headers = _private.copyProxyResponseHeaders(new Response('ok', {
    headers: {
      'Set-Cookie': 'CF_Authorization=access-jwt; Path=/; Secure; HttpOnly',
      'X-Origin-Header': 'kept',
    },
  }));

  assert.equal(headers.get('set-cookie'), null);
  assert.equal(headers.get('x-origin-header'), 'kept');
});

test('proxy preserves ordinary origin cookies', async () => {
  const headers = _private.copyProxyResponseHeaders(new Response('ok', {
    headers: {
      'Set-Cookie': 'session=ordinary; Path=/; Secure; HttpOnly',
    },
  }));

  assert.equal(headers.get('set-cookie'), 'session=ordinary; Path=/; Secure; HttpOnly');
});

test('proxy preserves multiple ordinary origin cookies while stripping Access cookies', async () => {
  const originHeaders = new Headers();
  originHeaders.append('Set-Cookie', 'session=ordinary; Path=/; Secure; HttpOnly');
  originHeaders.append('Set-Cookie', 'CF_Authorization=access-jwt; Path=/; Secure; HttpOnly');
  originHeaders.append('Set-Cookie', 'prefs=dark; Path=/; Secure');

  const headers = _private.copyProxyResponseHeaders(new Response('ok', {
    headers: originHeaders,
  }));

  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean);

  assert.deepEqual(setCookies, [
    'session=ordinary; Path=/; Secure; HttpOnly',
    'prefs=dark; Path=/; Secure',
  ]);
});

test('kiosk release policy can be served from Cloudflare KV override', async () => {
  let originCalled = false;
  const worker = createAppWorker({
    appName: 'test-main',
    fetcher: async () => {
      originCalled = true;
      return new Response('origin should not be called');
    },
  });

  const response = await worker.fetch(
    new Request('https://preview.example.com/api/kiosk-release-policy'),
    {
      ORIGIN_BASE_URL: 'https://origin.example.com',
      KIOSK_RELEASE_POLICY_KV_KEY: 'kiosk-release-policy:override',
      KIOSK_RELEASE_POLICY_KV: {
        async get(key, options) {
          assert.equal(key, 'kiosk-release-policy:override');
          assert.deepEqual(options, { type: 'json' });
          return {
            activeReleaseId: 'checkin-edge',
            buildVersion: 'checkin-edge',
            mode: 'force',
            forceNonce: 'edge-force-1',
            issuedAt: '2026-06-21T12:00:00.000Z',
            reasonCode: 'emergency',
          };
        },
      },
    }
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(originCalled, false);
  assert.equal(body.mode, 'force');
  assert.equal(body.forceNonce, 'edge-force-1');
  assert.equal(body.edgeSource, 'kv-override');
  assert.match(response.headers.get('Cache-Control'), /no-store/);
});

test('kiosk release policy falls through to origin when KV override is absent', async () => {
  let originRequest = null;
  const worker = createAppWorker({
    appName: 'test-main',
    fetcher: async (request) => {
      originRequest = request;
      return new Response(JSON.stringify({
        activeReleaseId: 'origin-release',
        buildVersion: 'origin-release',
        mode: 'normal',
        forceNonce: null,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const response = await worker.fetch(
    new Request('https://preview.example.com/api/kiosk-release-policy'),
    {
      ORIGIN_BASE_URL: 'https://origin.example.com',
      KIOSK_RELEASE_POLICY_KV: {
        async get() {
          return null;
        },
      },
    }
  );
  const body = await response.json();

  assert.equal(originRequest.url, 'https://origin.example.com/api/kiosk-release-policy');
  assert.equal(response.status, 200);
  assert.equal(body.activeReleaseId, 'origin-release');
  assert.equal(body.edgeSource, undefined);
});

test('origin Access service token config fails closed when partially configured', async () => {
  assert.throws(
    () => _private.copyProxyRequestHeaders(
      new Request('https://preview.example.com/api/health'),
      { ORIGIN_ACCESS_CLIENT_ID: 'worker-client-id' }
    ),
    /must be configured together/
  );
});

test('proxy preserves non-GET request bodies and streams origin responses', async () => {
  let originRequest = null;
  let originBody = null;
  const worker = createAppWorker({
    appName: 'test-main',
    fetcher: async (request) => {
      originRequest = request;
      originBody = await request.text();
      return new Response('accepted', {
        status: 202,
        headers: { 'Content-Type': 'text/plain' },
      });
    },
  });

  const response = await worker.fetch(
    new Request('https://preview.example.com/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'boot error' }),
    }),
    { ORIGIN_BASE_URL: 'https://origin.example.com' }
  );

  assert.equal(originRequest.method, 'POST');
  assert.equal(originRequest.headers.get('content-type'), 'application/json');
  assert.equal(originBody, '{"message":"boot error"}');
  assert.equal(response.status, 202);
  assert.equal(await response.text(), 'accepted');
  assert.match(response.headers.get('Cache-Control'), /no-store/);
});

test('static html and app metadata are served with no-store headers', async () => {
  const worker = createAppWorker({ appName: 'test-main' });
  const env = {
    ASSETS: makeAssets(() => new Response('<html>app</html>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })),
  };

  const response = await worker.fetch(new Request('https://preview.example.com/dashboard'), env);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.equal(response.headers.get('X-Checkin-Edge-App'), 'test-main');
});

test('freshness-critical app files are no-store even when not html', async () => {
  const worker = createAppWorker({ appName: 'test-main' });
  const env = {
    ASSETS: makeAssets((request) => {
      const { pathname } = new URL(request.url);
      const isJson = pathname.endsWith('.json');
      return new Response(isJson ? '{}' : 'self.addEventListener("install", () => {});', {
        headers: { 'Content-Type': isJson ? 'application/json' : 'application/javascript' },
      });
    }),
  };

  for (const path of ['/service-worker.js', '/asset-manifest.json', '/app-version.json']) {
    const response = await worker.fetch(new Request(`https://preview.example.com${path}`), env);

    assert.equal(response.status, 200);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
  }
});

test('hashed static assets keep immutable cache headers', async () => {
  const worker = createAppWorker({ appName: 'test-main' });
  const env = {
    ASSETS: makeAssets(() => new Response('console.log("ok");', {
      headers: { 'Content-Type': 'application/javascript' },
    })),
  };

  const response = await worker.fetch(
    new Request('https://preview.example.com/static/js/main.abc123.js'),
    env
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
});

test('reports dashboard defaults to same-origin reports API', () => {
  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(currentFile), '../..');
  const source = fs.readFileSync(
    path.join(repoRoot, 'src/api/client.js'),
    'utf8'
  );

  assert.match(source, /process\.env\.REACT_APP_API_URL \|\| '\/api\/reports'/);
  assert.doesNotMatch(source, /thankyou\.elegantlashesbykatie\.com\/api\/reports/);
});

test('wrangler configs declare exact approved routes and protected origin secrets', () => {
  const currentFile = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(currentFile), '../..');
  const requiredSecrets = [
    'ORIGIN_ACCESS_CLIENT_ID',
    'ORIGIN_ACCESS_CLIENT_SECRET',
  ];
  const expectedRoutesByConfig = {
    'cloudflare/reports/wrangler.jsonc': [{
      pattern: 'reports.elegantlashesbykatie.com/*',
      zone_name: 'elegantlashesbykatie.com',
    }],
  };

  for (const configPath of [
    'cloudflare/reports/wrangler.jsonc',
  ]) {
    const config = readJsonc(path.join(repoRoot, configPath));

    assert.equal(config.workers_dev, true, `${configPath} should keep workers.dev previews enabled`);
    assert.equal(config.route, undefined, `${configPath} must not declare a singular production route`);
    assert.deepEqual(config.routes, expectedRoutesByConfig[configPath], `${configPath} must declare only the approved production route`);
    assert.equal(config.custom_domain, undefined, `${configPath} must not declare a custom domain`);
    assert.equal(config.custom_domains, undefined, `${configPath} must not declare custom domains`);
    assert.equal(config.assets?.html_handling, 'none', `${configPath} must serve explicit .html assets without extensionless redirects`);
    assert.equal(config.assets?.directory, '../../build', `${configPath} must serve the reports build from the repository root`);
    assert.equal(config.vars?.ORIGIN_BASE_URL, 'https://checkin-origin.elegantlashesbykatie.com');
    assert.equal(config.vars?.EDGE_ENVIRONMENT, 'production');
    assert.equal(config.vars?.KIOSK_RELEASE_POLICY_KV_KEY, 'kiosk-release-policy:override');
    assert.equal(config.observability?.enabled, true);
    assert.equal(config.observability?.head_sampling_rate, 0.1);
    assert.deepEqual(config.kv_namespaces, [{
      binding: 'KIOSK_RELEASE_POLICY_KV',
      id: '62298b62c8a644898c7f0aa5c875b075',
    }]);
    assert.deepEqual([...(config.secrets?.required || [])].sort(), requiredSecrets);
  }
});

test('origin URL normalization rejects unsupported protocols', () => {
  assert.throws(
    () => _private.normalizeOriginBaseUrl('ftp://origin.example.com'),
    /http or https/
  );
});
