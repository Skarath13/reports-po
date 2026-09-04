import { act, renderHook } from '@testing-library/react';
import {
  dashboardPreferencesKey,
  useDashboardPreferences,
  validateDashboardPreferences,
} from './useDashboardPreferences';

const user = { id: 'preferences-test', username: 'Preferences' };
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

test('migrates existing choices, persists new preferences and restores them after remount', () => {
  localStorage.setItem('reports_hideNames_Preferences', 'false');
  localStorage.setItem('reports_location_Preferences', 'irvine');
  const first = renderHook(() => useDashboardPreferences(user));
  expect(first.result.current[0]).toMatchObject({
    location: 'irvine',
    hideNames: false,
    scheduleView: 'grouped',
  });
  act(() =>
    first.result.current[1]({
      theme: 'light',
      scheduleView: 'list',
      activeSection: 'notes',
      dateMode: 'tomorrow',
    }),
  );
  expect(document.documentElement.dataset.theme).toBe('light');
  first.unmount();
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  const second = renderHook(() =>
    useDashboardPreferences({ ...user, username: 'Renamed' }),
  );
  expect(second.result.current[0]).toMatchObject({
    theme: 'light',
    scheduleView: 'list',
    activeSection: 'notes',
    dateMode: 'tomorrow',
    hideNames: false,
  });
});

test('rejects malformed settings and ignores arbitrary client data', () => {
  expect(
    validateDashboardPreferences({
      location: 'fake',
      theme: 'bad',
      hideNames: 'false',
      sorting: [{ id: 'secret', desc: false }],
      query: 'client name',
    }),
  ).toMatchObject({
    location: 'tustin',
    theme: 'dark',
    hideNames: true,
    sorting: [{ id: 'appointmentTime', desc: false }],
  });
  expect(
    validateDashboardPreferences({ query: 'client name' }),
  ).not.toHaveProperty('query');
  localStorage.setItem(dashboardPreferencesKey(user), '{invalid');
  const { result } = renderHook(() => useDashboardPreferences(user));
  expect(result.current[0].scheduleView).toBe('grouped');
});

test('continues to work when local storage is blocked and does not create a shared anonymous preference', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const setItem = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('blocked');
    });
  const { result } = renderHook(() => useDashboardPreferences(user));
  act(() => result.current[1]({ theme: 'light' }));
  expect(result.current[0].theme).toBe('light');
  setItem.mockClear();
  renderHook(() => useDashboardPreferences(null));
  expect(setItem).not.toHaveBeenCalled();
});

test('only synchronizes preference events for the same user', () => {
  const { result } = renderHook(() => useDashboardPreferences(user));
  act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'reports_preferences_v1:id:someone-else',
        newValue: JSON.stringify({ theme: 'light' }),
      }),
    ),
  );
  expect(result.current[0].theme).toBe('dark');
  act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: dashboardPreferencesKey(user),
        newValue: JSON.stringify({ theme: 'light' }),
      }),
    ),
  );
  expect(result.current[0].theme).toBe('light');
});
