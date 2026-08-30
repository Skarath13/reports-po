import assert from 'node:assert/strict';
import test from 'node:test';

import { createAppWorker } from '../shared/gateway.mjs';
import { createGovernanceHandler, _private } from '../reports/governance.mjs';

const ROSS_ID = '97b9678a-8f18-484e-98ea-0011eea42c72';
const TONET_ID = 'b6d1a09d-9fb2-4aac-bdfa-de75d5272ddf';
const ARCHIE_ID = '62726a00-21a7-41a1-8f5a-23c3b7203d2d';
const KATELYN_ID = '9dee6da3-789a-46de-88f2-128385b2a4c0';

const USERS = {
  'ross-token': { id: ROSS_ID, username: 'Ross', role: 'admin' },
  'tonet-token': { id: TONET_ID, username: 'Tonet', role: 'admin' },
  'archie-token': { id: ARCHIE_ID, username: 'Archie', role: 'admin' },
  'katelyn-token': { id: KATELYN_ID, username: 'Katelyn', role: 'admin' },
  'other-token': { id: 'other-id', username: 'Other', role: 'staff' },
};

const LOCATIONS = [
  { id: 'tustin', name: 'Tustin', squareId: 'G0X353MBKGTCW' },
  { id: 'costa-mesa', name: 'Costa Mesa', squareId: 'LVMKS7ERWS3KP' },
  { id: 'santa-ana', name: 'Santa Ana', squareId: 'LZMX8CTA69S7E' },
  { id: 'irvine', name: 'Irvine', squareId: 'LC0CZ4AZ7TKXS' },
  { id: 'newport-beach', name: 'Newport Beach', squareId: 'LR7WA061BB4KA' },
];

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, ' ').trim();
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async ensureAvailable() {
    if (this.db.fail) throw new Error('D1 unavailable');
  }

  async run() {
    await this.ensureAvailable();

    if (this.sql.includes('INSERT INTO governance_login_events')) {
      const [actorId, username, role, loggedInAtUtc, eventDatePacific] = this.params;
      this.db.logins.push({
        actor_id: actorId,
        username,
        role,
        logged_in_at_utc: loggedInAtUtc,
        event_date_pacific: eventDatePacific,
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (this.sql.includes('INSERT OR IGNORE INTO governance_report_views')) {
      const [reportDate, locationId, actorId, username, sessionId, viewedAtUtc, eventDatePacific] = this.params;
      const duplicate = this.db.views.some((view) => (
        view.report_date === reportDate &&
        view.location_id === locationId &&
        view.actor_id === actorId &&
        view.session_id === sessionId
      ));
      if (!duplicate) {
        this.db.views.push({
          report_date: reportDate,
          location_id: locationId,
          actor_id: actorId,
          username,
          session_id: sessionId,
          viewed_at_utc: viewedAtUtc,
          event_date_pacific: eventDatePacific,
        });
      }
      return { success: true, meta: { changes: duplicate ? 0 : 1 } };
    }

    if (this.sql.includes('INSERT OR IGNORE INTO governance_signoffs')) {
      const [reportDate, locationId, actorId, username, signedAtUtc] = this.params;
      const duplicate = this.db.signoffs.some((signoff) => (
        signoff.report_date === reportDate &&
        signoff.location_id === locationId &&
        signoff.actor_id === actorId
      ));
      if (!duplicate) {
        this.db.signoffs.push({
          report_date: reportDate,
          location_id: locationId,
          actor_id: actorId,
          username,
          signed_at_utc: signedAtUtc,
        });
      }
      return { success: true, meta: { changes: duplicate ? 0 : 1 } };
    }

    return { success: true, meta: { changes: 0 } };
  }

  async first() {
    await this.ensureAvailable();

    if (this.sql.includes('FROM governance_audit_viewers')) {
      const [actorId] = this.params;
      return this.db.viewerIds.has(actorId) ? { actor_id: actorId } : null;
    }

    if (this.sql.includes('FROM governance_signoffs')) {
      const [reportDate, locationId, actorId] = this.params;
      return this.db.signoffs.find((signoff) => (
        signoff.report_date === reportDate &&
        signoff.location_id === locationId &&
        signoff.actor_id === actorId
      )) || null;
    }

    return null;
  }

  async all() {
    await this.ensureAvailable();

    if (this.sql.includes('FROM governance_required_signers')) {
      return { results: this.db.requiredSigners };
    }
    if (this.sql.includes('FROM governance_signoffs')) {
      const [reportDate] = this.params;
      return { results: this.db.signoffs.filter((signoff) => signoff.report_date === reportDate) };
    }
    if (this.sql.includes('FROM governance_login_events')) {
      const [eventDatePacific] = this.params;
      return { results: this.db.logins.filter((login) => login.event_date_pacific === eventDatePacific) };
    }
    if (this.sql.includes('FROM governance_report_views')) {
      const [reportDate] = this.params;
      return { results: this.db.views.filter((view) => view.report_date === reportDate) };
    }
    return { results: [] };
  }
}

class FakeD1 {
  constructor({ fail = false } = {}) {
    this.fail = fail;
    this.logins = [];
    this.views = [];
    this.signoffs = [];
    this.viewerIds = new Set([KATELYN_ID]);
    this.requiredSigners = [
      { actor_id: ROSS_ID, display_name: 'Ross', sort_order: 1 },
      { actor_id: TONET_ID, display_name: 'Tonet', sort_order: 2 },
      { actor_id: ARCHIE_ID, display_name: 'Archie', sort_order: 3 },
    ];
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

function makeOriginFetcher() {
  return async (request) => {
    const url = new URL(request.url);
    const token = request.headers.get('x-report-token');

    if (url.pathname === '/api/reports/auth/verify') {
      const user = USERS[token];
      return new Response(JSON.stringify(user ? { valid: true, user } : {
        valid: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      }), {
        status: user ? 200 : 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/api/reports/auth/login') {
      const user = USERS['ross-token'];
      return new Response(JSON.stringify({ token: 'ross-token', user }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname.startsWith('/api/reports/full/')) {
      return new Response(JSON.stringify({ report: 'protected' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

function makeWorker() {
  return createAppWorker({
    appName: 'checkin-reports-test',
    customHandler: createGovernanceHandler(),
    fetcher: makeOriginFetcher(),
  });
}

function makeRequest(path, { method = 'GET', token, body, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (token) requestHeaders.set('x-report-token', token);
  if (body !== undefined) requestHeaders.set('content-type', 'application/json');

  return new Request(`https://reports.example.com${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function makeEnv(db) {
  return {
    ORIGIN_BASE_URL: 'https://origin.example.com',
    REPORTS_GOVERNANCE_DB: db,
  };
}

function today() {
  return _private.getPacificDate(new Date());
}

async function json(response) {
  return response.json();
}

test('public PIN login is still origin-backed and records a successful login', async () => {
  const db = new FakeD1();
  const response = await makeWorker().fetch(
    makeRequest('/api/reports/auth/login', { method: 'POST', body: { pin: '1234' } }),
    makeEnv(db)
  );

  assert.equal(response.status, 200);
  assert.equal((await json(response)).token, 'ross-token');
  assert.equal(db.logins.length, 1);
  assert.equal(db.logins[0].username, 'Ross');
  assert.equal(db.logins[0].event_date_pacific, today());
});

test('governance endpoints require the existing report token', async () => {
  const response = await makeWorker().fetch(
    makeRequest(`/api/reports/governance/signoffs?date=${today()}&locationId=tustin`),
    makeEnv(new FakeD1())
  );

  assert.equal(response.status, 401);
  assert.equal((await json(response)).code, 'NO_TOKEN');
});

test('audit access is Katelyn-only', async () => {
  const worker = makeWorker();
  const db = new FakeD1();

  const denied = await worker.fetch(
    makeRequest(`/api/reports/governance/audit?date=${today()}`, { token: 'ross-token' }),
    makeEnv(db)
  );
  assert.equal(denied.status, 403);

  const allowed = await worker.fetch(
    makeRequest(`/api/reports/governance/audit?date=${today()}`, { token: 'katelyn-token' }),
    makeEnv(db)
  );
  assert.equal(allowed.status, 200);
  const body = await json(allowed);
  assert.deepEqual(body.requiredSigners.map((signer) => signer.display_name), ['Ross', 'Tonet', 'Archie']);
  assert.deepEqual(body.locations.map((location) => location.name), [
    'Tustin', 'Costa Mesa', 'Santa Ana', 'Irvine', 'Newport Beach',
  ]);
});

test('sign-offs are self-only, required completion is represented, and duplicates stay immutable', async () => {
  const worker = makeWorker();
  const db = new FakeD1();
  const reportDate = today();

  const rossSignoff = await worker.fetch(
    makeRequest('/api/reports/governance/signoffs', {
      method: 'POST',
      token: 'ross-token',
      body: { reportDate, locationId: 'tustin', actorId: 'archie-id' },
    }),
    makeEnv(db)
  );
  assert.equal(rossSignoff.status, 201);
  const firstTimestamp = (await json(rossSignoff)).signedAtUtc;
  assert.equal(db.signoffs[0].actor_id, ROSS_ID);

  const duplicate = await worker.fetch(
    makeRequest('/api/reports/governance/signoffs', {
      method: 'POST',
      token: 'ross-token',
      body: { reportDate, locationId: 'tustin' },
    }),
    makeEnv(db)
  );
  assert.equal(duplicate.status, 201);
  assert.equal((await json(duplicate)).signedAtUtc, firstTimestamp);
  assert.equal(db.signoffs.length, 1);

  const tonetSignoff = await worker.fetch(
    makeRequest('/api/reports/governance/signoffs', {
      method: 'POST',
      token: 'tonet-token',
      body: { reportDate, locationId: 'tustin' },
    }),
    makeEnv(db)
  );
  const archieSignoff = await worker.fetch(
    makeRequest('/api/reports/governance/signoffs', {
      method: 'POST',
      token: 'archie-token',
      body: { reportDate, locationId: 'tustin' },
    }),
    makeEnv(db)
  );
  assert.equal(tonetSignoff.status, 201);
  assert.equal(archieSignoff.status, 201);

  const tonetOwnStatus = await worker.fetch(
    makeRequest(`/api/reports/governance/signoffs?date=${reportDate}&locationId=tustin`, { token: 'tonet-token' }),
    makeEnv(db)
  );
  assert.equal((await json(tonetOwnStatus)).signedOff, true);
  assert.equal(db.signoffs.every((signoff) => signoff.username !== 'Other'), true);

  const audit = await worker.fetch(
    makeRequest(`/api/reports/governance/audit?date=${reportDate}`, { token: 'katelyn-token' }),
    makeEnv(db)
  );
  assert.equal((await json(audit)).signoffs.length, 3);
});

test('sign-offs are restricted to the current Pacific date', async () => {
  const worker = makeWorker();
  const db = new FakeD1();
  const past = '2020-01-01';
  const future = '2099-01-01';

  for (const reportDate of [past, future]) {
    const response = await worker.fetch(
      makeRequest('/api/reports/governance/signoffs', {
        method: 'POST',
        token: 'ross-token',
        body: { reportDate, locationId: 'tustin' },
      }),
      makeEnv(db)
    );
    assert.equal(response.status, 422);
    assert.equal((await json(response)).code, 'SIGNOFF_TODAY_ONLY');
  }
});

test('automatic refreshes deduplicate first report views by browser session', async () => {
  const worker = makeWorker();
  const db = new FakeD1();
  const reportDate = today();
  const requestOptions = {
    token: 'ross-token',
    headers: { 'x-report-view-session': 'browser-session-123456' },
  };

  const first = await worker.fetch(
    makeRequest(`/api/reports/full/${reportDate}/G0X353MBKGTCW`, requestOptions),
    makeEnv(db)
  );
  const refresh = await worker.fetch(
    makeRequest(`/api/reports/full/${reportDate}/G0X353MBKGTCW`, requestOptions),
    makeEnv(db)
  );
  const secondBrowser = await worker.fetch(
    makeRequest(`/api/reports/full/${reportDate}/G0X353MBKGTCW`, {
      token: 'ross-token',
      headers: { 'x-report-view-session': 'browser-session-654321' },
    }),
    makeEnv(db)
  );

  assert.equal(first.status, 200);
  assert.equal(refresh.status, 200);
  assert.equal(secondBrowser.status, 200);
  assert.equal(db.views.length, 2);
  assert.deepEqual([...new Set(db.views.map((view) => view.session_id))], [
    'browser-session-123456', 'browser-session-654321',
  ]);
});

test('Pacific date conversion follows the business timezone at UTC midnight boundaries', () => {
  assert.equal(_private.getPacificDate(new Date('2026-08-18T06:59:59.000Z')), '2026-08-17');
  assert.equal(_private.getPacificDate(new Date('2026-08-18T07:00:00.000Z')), '2026-08-18');
});

test('an unavailable governance D1 blocks login, report view, and sign-off', async () => {
  const worker = makeWorker();
  const db = new FakeD1({ fail: true });
  const reportDate = today();

  const login = await worker.fetch(
    makeRequest('/api/reports/auth/login', { method: 'POST', body: { pin: '1234' } }),
    makeEnv(db)
  );
  assert.equal(login.status, 503);
  assert.equal((await json(login)).code, 'GOVERNANCE_UNAVAILABLE');

  const view = await worker.fetch(
    makeRequest(`/api/reports/full/${reportDate}/G0X353MBKGTCW`, {
      token: 'ross-token',
      headers: { 'x-report-view-session': 'browser-session-123456' },
    }),
    makeEnv(db)
  );
  assert.equal(view.status, 503);

  const signoff = await worker.fetch(
    makeRequest('/api/reports/governance/signoffs', {
      method: 'POST',
      token: 'ross-token',
      body: { reportDate, locationId: 'tustin' },
    }),
    makeEnv(db)
  );
  assert.equal(signoff.status, 503);
});

test('audit rejects malformed dates instead of silently falling back to today', async () => {
  const response = await makeWorker().fetch(
    makeRequest('/api/reports/governance/audit?date=not-a-date', { token: 'katelyn-token' }),
    makeEnv(new FakeD1())
  );

  assert.equal(response.status, 400);
});
