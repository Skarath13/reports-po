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

    await expect(api.getLocations()).rejects.toThrow('Token expired');

    expect(authExpired).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('reportToken')).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('/api/reports/locations', expect.objectContaining({
      headers: expect.objectContaining({
        'x-report-token': 'stale-token',
      }),
    }));

    window.removeEventListener('auth-expired', authExpired);
  });
});
