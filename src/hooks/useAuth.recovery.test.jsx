import { act, renderHook, waitFor } from '@testing-library/react';
import api from '../api/client';
import { useAuth } from './useAuth';
import { useFullReport } from './useReports';

beforeEach(() => { localStorage.clear(); api.setToken('synthetic-session'); global.fetch = vi.fn(); });
afterEach(() => { api.logout(); delete global.fetch; });
const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test('temporary restore outage preserves the token and retries before showing protected data', async () => {
  global.fetch.mockResolvedValueOnce(reply(503, { error: 'Authentication service unavailable', code: 'AUTH_UNAVAILABLE' }))
    .mockResolvedValueOnce(reply(200, { valid: true, user: { id: 'synthetic-user' } }));
  const hook = renderHook(() => useAuth());
  await waitFor(() => expect(hook.result.current.restoreError).toBe('Authentication service unavailable'));
  expect(hook.result.current.user).toBeNull(); expect(api.getToken()).toBe('synthetic-session');
  await act(() => hook.result.current.restoreSession());
  expect(hook.result.current.restoreError).toBeNull(); expect(hook.result.current.user.id).toBe('synthetic-user');
});

test('logout fences an older successful restore response', async () => {
  let resolve; global.fetch.mockImplementation(() => new Promise(r => { resolve = r; }));
  const hook = renderHook(() => useAuth());
  act(() => hook.result.current.logout());
  await act(async () => resolve(reply(200, { valid: true, user: { id: 'old-user' } })));
  expect(hook.result.current.user).toBeNull(); expect(hook.result.current.loading).toBe(false); expect(api.getToken()).toBeNull();
});

test('revoked loaded session is cleared with the actual denial message', async () => {
  global.fetch.mockResolvedValueOnce(reply(200, { valid: true, user: { id: 'synthetic-user' } }));
  const hook = renderHook(() => useAuth());
  await waitFor(() => expect(hook.result.current.user?.id).toBe('synthetic-user'));
  global.fetch.mockResolvedValueOnce(reply(403, { error: 'Reports access is no longer available', code: 'REPORT_ACCESS_REVOKED' }));
  await act(async () => { await api.getFullReport('2026-10-14', 'tustin').catch(() => {}); });
  expect(hook.result.current.user).toBeNull(); expect(api.getToken()).toBeNull();
  expect(hook.result.current.error).toBe('Reports access is no longer available');
});

test('same-user new session cannot reuse the report from the previous login', async () => {
  // Version checks are answered separately; the two report fetches stay in order.
  const reports = [reply(200, { marker: 'old-report' }), reply(200, { marker: 'new-report' })];
  global.fetch.mockImplementation(async (url) => (String(url).includes('/version/') ? reply(200, { version: 'v1' }) : reports.shift()));
  const first = renderHook(() => useFullReport('tustin', '2026-10-14', 'same-user'));
  await waitFor(() => expect(first.result.current.data?.marker).toBe('old-report')); first.unmount();
  act(() => { api.logout(); api.setToken('synthetic-new-session'); });
  const second = renderHook(() => useFullReport('tustin', '2026-10-14', 'same-user'));
  await waitFor(() => expect(second.result.current.data?.marker).toBe('new-report'));
  expect(global.fetch.mock.calls.filter(([url]) => String(url).includes('/full/'))).toHaveLength(2);
});
