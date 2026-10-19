import api from './client';

describe('ReportsAPIClient auth failures', () => {
  beforeEach(() => {
    api.setToken(null);
    localStorage.clear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    api.setToken(null);
    delete global.fetch;
  });

  test('passes report cancellation through to fetch', async () => {
    const controller = new AbortController();
    global.fetch.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const request = api.getFullReport('2026-09-04', 'tustin', { signal: controller.signal });
    const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(global.fetch).toHaveBeenCalledWith('/api/reports/full/2026-09-04/tustin', expect.objectContaining({ signal: controller.signal }));
  });

  test('login 401 surfaces invalid credentials without auth-expired event', async () => {
    const authExpired = vi.fn();
    window.addEventListener('auth-expired', authExpired);

    global.fetch.mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      }),
    });

    await expect(api.login('0000')).rejects.toThrow('Invalid credentials');

    expect(authExpired).not.toHaveBeenCalled();
    expect(localStorage.getItem('reportToken')).toBeNull();

    window.removeEventListener('auth-expired', authExpired);
  });

  test('protected route 401 clears token and emits auth-expired event', async () => {
    const authExpired = vi.fn();
    window.addEventListener('auth-expired', authExpired);
    api.setToken('stale-token');

    global.fetch.mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      }),
    });

    await expect(api.getFullReport('2026-09-05', 'test-location')).rejects.toThrow('Token expired');

    expect(authExpired).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('reportToken')).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('/api/reports/full/2026-09-05/test-location', expect.objectContaining({
      headers: expect.objectContaining({
        'x-report-token': 'stale-token',
      }),
    }));

    window.removeEventListener('auth-expired', authExpired);
  });
});

describe('Reports principal revocation and session races', () => {
  beforeEach(() => { api.setToken('synthetic-old-session'); global.fetch = vi.fn(); });
  afterEach(() => { api.setToken(null); delete global.fetch; });
  test.each([[403, 'AUDIT_FORBIDDEN'], [503, 'AUTH_UNAVAILABLE']])('%s %s preserves the authenticated session', async (status, code) => {
    global.fetch.mockResolvedValue({ status, ok: false, json: async () => ({ error: code, code }) });
    await expect(api.verifyToken()).rejects.toMatchObject({ code, status });
    expect(api.getToken()).toBe('synthetic-old-session');
  });
  test('explicit revoked access clears the token and emits the denial', async () => {
    const listener = vi.fn(); window.addEventListener('auth-expired', listener);
    try {
      global.fetch.mockResolvedValue({ status: 403, ok: false, json: async () => ({ error: 'Reports access is no longer available', code: 'REPORT_ACCESS_REVOKED' }) });
      await expect(api.verifyToken()).rejects.toThrow('Reports access is no longer available');
      expect(api.getToken()).toBeNull(); expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].detail.message).toBe('Reports access is no longer available');
    } finally { window.removeEventListener('auth-expired', listener); }
  });
  test.each([200, 401])('old session response %s cannot replace or clear the next session', async status => {
    let resolve; global.fetch.mockImplementation(() => new Promise(r => { resolve = r; }));
    const request = api.verifyToken(); const rejected = expect(request).rejects.toMatchObject({ code: 'AUTH_CONTEXT_CHANGED' });
    api.logout(); api.setToken('synthetic-new-session');
    resolve({ status, ok: status === 200, json: async () => ({ valid: true }) }); await rejected;
    expect(api.getToken()).toBe('synthetic-new-session');
  });
});
