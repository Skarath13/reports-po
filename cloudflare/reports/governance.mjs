import {
  SECTION_DEFINITIONS,
  SectionGovernanceError,
  acknowledgeSectionEntry,
  buildDuplicateSectionSnapshots,
  buildFullReportSectionSnapshots,
  getMySectionState,
  getObservedSectionSnapshotsForAudit,
  getSectionAuditEvents,
  persistObservedSnapshots,
  recordSectionSignoff,
  snapshotsForClient,
} from './section-governance.mjs';

const PACIFIC_TIME_ZONE = 'America/Los_Angeles';
const GOVERNANCE_DB_BINDING = 'REPORTS_GOVERNANCE_DB';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SESSION_PATTERN = /^[A-Za-z0-9._:-]{16,160}$/;
const MAX_AUDIT_ROWS = 500;

const LOCATIONS = [
  { id: 'tustin', name: 'Tustin', squareId: 'G0X353MBKGTCW' },
  { id: 'costa-mesa', name: 'Costa Mesa', squareId: 'LVMKS7ERWS3KP' },
  { id: 'santa-ana', name: 'Santa Ana', squareId: 'LZMX8CTA69S7E' },
  { id: 'irvine', name: 'Irvine', squareId: 'LC0CZ4AZ7TKXS' },
  { id: 'newport-beach', name: 'Newport Beach', squareId: 'LR7WA061BB4KA' },
];

const LOCATIONS_BY_ID = new Map(LOCATIONS.map((location) => [location.id, location]));
const LOCATIONS_BY_SQUARE_ID = new Map(LOCATIONS.map((location) => [location.squareId, location]));

function decodePathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return null;
  }
}

class GovernanceUnavailableError extends Error {
  constructor(message = 'Reports governance storage is unavailable') {
    super(message);
    this.name = 'GovernanceUnavailableError';
  }
}

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

function getDb(env) {
  const db = env?.[GOVERNANCE_DB_BINDING];
  if (!db || typeof db.prepare !== 'function') {
    throw new GovernanceUnavailableError();
  }
  return db;
}

function getPacificDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeReportDate(value) {
  const date = String(value || '').trim();
  return isValidDate(date) ? date : null;
}

function resolveLocation(value, { squareId = false } = {}) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return squareId
    ? LOCATIONS_BY_SQUARE_ID.get(normalized) || null
    : LOCATIONS_BY_ID.get(normalized) || null;
}

function normalizeSessionId(value) {
  const sessionId = String(value || '').trim();
  return SESSION_PATTERN.test(sessionId) ? sessionId : null;
}

function getAuthHeaders(request) {
  const headers = new Headers();
  const reportToken = request.headers.get('x-report-token');
  const authorization = request.headers.get('authorization');

  if (reportToken) headers.set('x-report-token', reportToken);
  if (!reportToken && authorization) headers.set('authorization', authorization);

  return headers;
}

async function verifyPrincipal(request, proxyToOrigin) {
  const authHeaders = getAuthHeaders(request);
  if (!authHeaders.has('x-report-token') && !authHeaders.has('authorization')) {
    return {
      response: jsonResponse({
        error: 'Authentication required',
        code: 'NO_TOKEN',
      }, { status: 401 }),
    };
  }

  const verifyRequest = new Request(
    new URL('/api/reports/auth/verify', request.url),
    { method: 'GET', headers: authHeaders }
  );
  const response = await proxyToOrigin(verifyRequest);
  const body = await response.json().catch(() => null);

  if (response.status === 401) {
    return {
      response: jsonResponse({
        error: body?.error || 'Authentication required',
        code: body?.code || 'INVALID_TOKEN',
      }, { status: 401 }),
    };
  }

  if (!response.ok || !body?.valid || !body?.user?.id || !body?.user?.username) {
    return {
      response: jsonResponse({
        error: 'Authentication service unavailable',
        code: 'AUTH_UNAVAILABLE',
      }, { status: 503 }),
    };
  }

  return {
    principal: {
      id: String(body.user.id),
      username: String(body.user.username),
      role: body.user.role ? String(body.user.role) : null,
    },
  };
}

async function parseJson(request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 16 * 1024) return null;
    const body = JSON.parse(rawBody);
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch (_error) {
    return null;
  }
}

function sectionGovernanceErrorResponse(error) {
  if (error instanceof SectionGovernanceError) {
    return jsonResponse({
      error: error.message,
      code: error.code,
      ...(error.details || {}),
    }, { status: error.status });
  }
  return governanceUnavailableResponse();
}

function originJsonResponse(originResponse, payload) {
  const headers = new Headers(originResponse.headers);
  headers.delete('content-length');
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return new Response(JSON.stringify(payload), {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers,
  });
}

function validationError(message, code = 'INVALID_REQUEST') {
  return jsonResponse({ error: message, code }, { status: 400 });
}

function governanceUnavailableResponse() {
  return jsonResponse({
    error: 'Audit service is temporarily unavailable. Please retry.',
    code: 'GOVERNANCE_UNAVAILABLE',
  }, { status: 503 });
}

async function recordLogin(env, user, now = new Date()) {
  const db = getDb(env);
  const loggedInAtUtc = now.toISOString();
  await db.prepare(`
    INSERT INTO governance_login_events
      (actor_id, username, role, logged_in_at_utc, event_date_pacific)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    String(user.id),
    String(user.username),
    user.role ? String(user.role) : null,
    loggedInAtUtc,
    getPacificDate(now)
  ).run();
}

async function recordView(env, principal, { reportDate, locationId, sessionId }, now = new Date()) {
  const db = getDb(env);
  const viewedAtUtc = now.toISOString();
  await db.prepare(`
    INSERT OR IGNORE INTO governance_report_views
      (report_date, location_id, actor_id, username, session_id, viewed_at_utc, event_date_pacific)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    reportDate,
    locationId,
    principal.id,
    principal.username,
    sessionId,
    viewedAtUtc,
    getPacificDate(now)
  ).run();
}

async function recordSignoff(env, principal, { reportDate, locationId }, now = new Date()) {
  const db = getDb(env);
  const signedAtUtc = now.toISOString();
  await db.prepare(`
    INSERT OR IGNORE INTO governance_signoffs
      (report_date, location_id, actor_id, username, signed_at_utc)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    reportDate,
    locationId,
    principal.id,
    principal.username,
    signedAtUtc
  ).run();

  return db.prepare(`
    SELECT report_date, location_id, actor_id, username, signed_at_utc
    FROM governance_signoffs
    WHERE report_date = ? AND location_id = ? AND actor_id = ?
  `).bind(reportDate, locationId, principal.id).first();
}

async function getMySignoff(env, principal, { reportDate, locationId }) {
  const db = getDb(env);
  return db.prepare(`
    SELECT report_date, location_id, actor_id, username, signed_at_utc
    FROM governance_signoffs
    WHERE report_date = ? AND location_id = ? AND actor_id = ?
  `).bind(reportDate, locationId, principal.id).first();
}

async function isAuditViewer(env, actorId) {
  const db = getDb(env);
  const viewer = await db.prepare(`
    SELECT actor_id
    FROM governance_audit_viewers
    WHERE actor_id = ? AND active = 1
  `).bind(actorId).first();
  return Boolean(viewer);
}

async function getAuditData(env, reportDate) {
  const db = getDb(env);
  const [
    requiredSigners,
    signoffs,
    sectionSignoffs,
    observedSectionSnapshots,
    logins,
    views,
  ] = await Promise.all([
    db.prepare(`
      SELECT actor_id, display_name, sort_order
      FROM governance_required_signers
      WHERE active = 1
      ORDER BY sort_order ASC, display_name ASC
    `).all(),
    db.prepare(`
      SELECT report_date, location_id, actor_id, username, signed_at_utc
      FROM governance_signoffs
      WHERE report_date = ?
      ORDER BY signed_at_utc ASC
      LIMIT ${MAX_AUDIT_ROWS}
    `).bind(reportDate).all(),
    getSectionAuditEvents(db, reportDate),
    getObservedSectionSnapshotsForAudit(db, reportDate),
    db.prepare(`
      SELECT actor_id, username, role, logged_in_at_utc, event_date_pacific
      FROM governance_login_events
      WHERE event_date_pacific = ?
      ORDER BY logged_in_at_utc DESC
      LIMIT ${MAX_AUDIT_ROWS}
    `).bind(reportDate).all(),
    db.prepare(`
      SELECT report_date, location_id, actor_id, username, session_id, viewed_at_utc, event_date_pacific
      FROM governance_report_views
      WHERE report_date = ?
      ORDER BY viewed_at_utc DESC
      LIMIT ${MAX_AUDIT_ROWS}
    `).bind(reportDate).all(),
  ]);

  return {
    reportDate,
    locations: LOCATIONS,
    requiredSigners: requiredSigners.results || [],
    signoffs: signoffs.results || [],
    sectionDefinitions: SECTION_DEFINITIONS,
    sectionSignoffs,
    observedSectionSnapshots,
    logins: logins.results || [],
    views: views.results || [],
  };
}

async function handleLogin(request, env, proxyToOrigin) {
  const originResponse = await proxyToOrigin(request);
  if (!originResponse.ok) return originResponse;

  const body = await originResponse.clone().json().catch(() => null);
  if (!body?.user?.id || !body?.user?.username || !body?.token) {
    return governanceUnavailableResponse();
  }

  try {
    await recordLogin(env, body.user);
  } catch (_error) {
    return governanceUnavailableResponse();
  }

  return originResponse;
}

async function handleFullReportView(request, env, proxyToOrigin) {
  const pathMatch = new URL(request.url).pathname.match(
    /^\/api\/reports\/full\/([^/]+)\/([^/]+)\/?$/
  );
  if (!pathMatch) return null;

  const reportDate = normalizeReportDate(decodePathSegment(pathMatch[1]));
  const location = resolveLocation(decodePathSegment(pathMatch[2]), { squareId: true });
  const sessionId = normalizeSessionId(request.headers.get('x-report-view-session'));

  if (!reportDate || !location || !sessionId) {
    return validationError('A valid report date, location, and view session are required.', 'VIEW_CONTEXT_REQUIRED');
  }

  const auth = await verifyPrincipal(request, proxyToOrigin);
  if (auth.response) return auth.response;

  const originResponse = await proxyToOrigin(request);
  if (!originResponse.ok) return originResponse;

  try {
    const report = await originResponse.clone().json();
    const snapshots = await buildFullReportSectionSnapshots(report, {
      secret: env.GOVERNANCE_FINGERPRINT_SECRET,
      actorId: auth.principal.id,
      reportDate,
      locationId: location.id,
    });
    const observedAtUtc = await persistObservedSnapshots(
      getDb(env),
      auth.principal,
      reportDate,
      { [location.id]: snapshots }
    );
    await recordView(env, auth.principal, {
      reportDate,
      locationId: location.id,
      sessionId,
    });
    return originJsonResponse(originResponse, {
      ...report,
      _governance: {
        version: 2,
        sectionSnapshots: snapshotsForClient(snapshots, observedAtUtc),
      },
    });
  } catch (_error) {
    return sectionGovernanceErrorResponse(_error);
  }
}

async function handleAllLocationsReport(request, env, proxyToOrigin) {
  const pathMatch = new URL(request.url).pathname.match(
    /^\/api\/reports\/all-locations\/([^/]+)\/?$/
  );
  if (!pathMatch) return null;

  const reportDate = normalizeReportDate(decodePathSegment(pathMatch[1]));
  if (!reportDate) {
    return validationError('A valid report date is required.');
  }

  const auth = await verifyPrincipal(request, proxyToOrigin);
  if (auth.response) return auth.response;

  const originResponse = await proxyToOrigin(request);
  if (!originResponse.ok) return originResponse;

  try {
    const report = await originResponse.clone().json();
    const duplicateSnapshots = await buildDuplicateSectionSnapshots(report, {
      secret: env.GOVERNANCE_FINGERPRINT_SECRET,
      actorId: auth.principal.id,
      reportDate,
      locations: LOCATIONS,
    });
    const snapshotsByLocation = Object.fromEntries(
      Object.entries(duplicateSnapshots).map(([locationId, snapshot]) => [
        locationId,
        { duplicates: snapshot },
      ])
    );
    const observedAtUtc = await persistObservedSnapshots(
      getDb(env),
      auth.principal,
      reportDate,
      snapshotsByLocation
    );
    const duplicateSnapshotsByLocation = Object.fromEntries(
      Object.entries(duplicateSnapshots).map(([locationId, snapshot]) => [
        locationId,
        snapshotsForClient({ duplicates: snapshot }, observedAtUtc).duplicates,
      ])
    );

    return originJsonResponse(originResponse, {
      ...report,
      _governance: {
        version: 2,
        duplicateSnapshotsByLocation,
      },
    });
  } catch (_error) {
    return sectionGovernanceErrorResponse(_error);
  }
}

async function handleGovernanceRoute(request, env, proxyToOrigin) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === '/api/reports/governance/sections' && request.method === 'GET') {
    const reportDate = normalizeReportDate(url.searchParams.get('date'));
    const location = resolveLocation(url.searchParams.get('locationId'));
    if (!reportDate || !location) {
      return validationError('A valid report date and location are required.');
    }

    const auth = await verifyPrincipal(request, proxyToOrigin);
    if (auth.response) return auth.response;

    try {
      return jsonResponse(await getMySectionState(getDb(env), auth.principal, {
        reportDate,
        locationId: location.id,
      }));
    } catch (_error) {
      return sectionGovernanceErrorResponse(_error);
    }
  }

  if (pathname === '/api/reports/governance/sections/signoffs' && request.method === 'POST') {
    const body = await parseJson(request);
    const reportDate = normalizeReportDate(body?.reportDate || body?.date);
    const location = resolveLocation(body?.locationId);
    const requestId = normalizeSessionId(body?.requestId);
    if (!reportDate || !location || !requestId) {
      return validationError('A valid report date, location, and review request ID are required.');
    }
    if (reportDate !== getPacificDate()) {
      return jsonResponse({
        error: 'Report sections can only be signed off for today in Pacific time.',
        code: 'SIGNOFF_TODAY_ONLY',
      }, { status: 422 });
    }

    const auth = await verifyPrincipal(request, proxyToOrigin);
    if (auth.response) return auth.response;

    try {
      const result = await recordSectionSignoff(getDb(env), auth.principal, {
        reportDate,
        locationId: location.id,
        sectionKey: body?.sectionKey,
        snapshotHash: body?.snapshotHash,
        requestId,
      });
      return jsonResponse({
        reportDate,
        locationId: location.id,
        ...result,
      }, { status: result.replayed ? 200 : 201 });
    } catch (_error) {
      return sectionGovernanceErrorResponse(_error);
    }
  }

  if (pathname === '/api/reports/governance/sections/acknowledgements' && request.method === 'POST') {
    const body = await parseJson(request);
    const reportDate = normalizeReportDate(body?.reportDate || body?.date);
    const location = resolveLocation(body?.locationId);
    if (!reportDate || !location) {
      return validationError('A valid report date and location are required.');
    }
    if (reportDate !== getPacificDate()) {
      return jsonResponse({
        error: 'Updates can only be acknowledged for today in Pacific time.',
        code: 'ACKNOWLEDGEMENT_TODAY_ONLY',
      }, { status: 422 });
    }

    const auth = await verifyPrincipal(request, proxyToOrigin);
    if (auth.response) return auth.response;

    try {
      const result = await acknowledgeSectionEntry(getDb(env), auth.principal, {
        reportDate,
        locationId: location.id,
        sectionKey: body?.sectionKey,
        snapshotHash: body?.snapshotHash,
        entryKey: body?.entryKey,
        contentVersion: body?.contentVersion,
      });
      return jsonResponse({ reportDate, locationId: location.id, ...result });
    } catch (_error) {
      return sectionGovernanceErrorResponse(_error);
    }
  }

  if (pathname === '/api/reports/governance/signoffs' && request.method === 'GET') {
    const reportDate = normalizeReportDate(url.searchParams.get('date'));
    const location = resolveLocation(url.searchParams.get('locationId'));
    if (!reportDate || !location) {
      return validationError('A valid report date and location are required.');
    }

    const auth = await verifyPrincipal(request, proxyToOrigin);
    if (auth.response) return auth.response;

    try {
      const signoff = await getMySignoff(env, auth.principal, {
        reportDate,
        locationId: location.id,
      });
      return jsonResponse({
        reportDate,
        locationId: location.id,
        signedOff: Boolean(signoff),
        signedAtUtc: signoff?.signed_at_utc || null,
      });
    } catch (_error) {
      return governanceUnavailableResponse();
    }
  }

  if (pathname === '/api/reports/governance/signoffs' && request.method === 'POST') {
    const body = await parseJson(request);
    const reportDate = normalizeReportDate(body?.reportDate || body?.date);
    const location = resolveLocation(body?.locationId);
    if (!reportDate || !location) {
      return validationError('A valid report date and location are required.');
    }

    if (reportDate !== getPacificDate()) {
      return jsonResponse({
        error: 'Reports can only be signed off for today in Pacific time.',
        code: 'SIGNOFF_TODAY_ONLY',
      }, { status: 422 });
    }

    const auth = await verifyPrincipal(request, proxyToOrigin);
    if (auth.response) return auth.response;

    try {
      const signoff = await recordSignoff(env, auth.principal, {
        reportDate,
        locationId: location.id,
      });
      if (!signoff) return governanceUnavailableResponse();

      return jsonResponse({
        reportDate,
        locationId: location.id,
        signedOff: true,
        signedAtUtc: signoff.signed_at_utc,
      }, { status: 201 });
    } catch (_error) {
      return governanceUnavailableResponse();
    }
  }

  if (pathname === '/api/reports/governance/audit' && request.method === 'GET') {
    const requestedDate = url.searchParams.get('date');
    const reportDate = requestedDate === null
      ? getPacificDate()
      : normalizeReportDate(requestedDate);
    if (!reportDate) {
      return validationError('A valid audit date is required.');
    }
    const auth = await verifyPrincipal(request, proxyToOrigin);
    if (auth.response) return auth.response;

    try {
      if (!(await isAuditViewer(env, auth.principal.id))) {
        return jsonResponse({
          error: 'Audit access is restricted to Katelyn.',
          code: 'AUDIT_FORBIDDEN',
        }, { status: 403 });
      }

      return jsonResponse(await getAuditData(env, reportDate));
    } catch (_error) {
      return governanceUnavailableResponse();
    }
  }

  return null;
}

export function createGovernanceHandler() {
  return async (request, env, { proxyToOrigin: proxy }) => {
    const url = new URL(request.url);

    if (url.pathname === '/api/reports/auth/login' && request.method === 'POST') {
      return handleLogin(request, env, proxy);
    }

    if (url.pathname.startsWith('/api/reports/governance/')) {
      return handleGovernanceRoute(request, env, proxy);
    }

    if (url.pathname.startsWith('/api/reports/full/') && request.method === 'GET') {
      return handleFullReportView(request, env, proxy);
    }

    if (url.pathname.startsWith('/api/reports/all-locations/') && request.method === 'GET') {
      return handleAllLocationsReport(request, env, proxy);
    }

    return null;
  };
}

export const _private = {
  DATE_PATTERN,
  LOCATIONS,
  SESSION_PATTERN,
  getPacificDate,
  isValidDate,
  normalizeReportDate,
  normalizeSessionId,
  resolveLocation,
};
