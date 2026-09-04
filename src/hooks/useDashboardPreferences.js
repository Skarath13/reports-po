import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { LOCATIONS } from './useReports';
import { REPORT_SECTION_KEYS } from '../constants/reportSections';

export function dashboardUserKey(user) {
  if (user?.id) return `id:${user.id}`;
  return user?.username ? `username:${user.username}` : null;
}

export function dashboardPreferencesKey(user) {
  const identity = dashboardUserKey(user);
  return identity ? `reports_preferences_v1:${identity}` : null;
}

const defaults = {
  location: 'tustin',
  hideNames: false,
  showPrices: true,
  activeSection: 'overview',
  dateMode: 'today',
  scheduleView: 'grouped',
  sorting: [{ id: 'appointmentTime', desc: false }],
  technicians: {},
  theme: 'dark',
};

export function validateDashboardPreferences(value) {
  const source = value && typeof value === 'object' ? value : {};
  const sort = Array.isArray(source.sorting) && source.sorting[0];
  return {
    location: LOCATIONS.some((location) => location.id === source.location)
      ? source.location
      : defaults.location,
    hideNames:
      typeof source.hideNames === 'boolean'
        ? source.hideNames
        : defaults.hideNames,
    showPrices:
      typeof source.showPrices === 'boolean'
        ? source.showPrices
        : defaults.showPrices,
    activeSection: ['overview', ...REPORT_SECTION_KEYS].includes(
      source.activeSection,
    )
      ? source.activeSection
      : defaults.activeSection,
    dateMode: source.dateMode === 'tomorrow' ? 'tomorrow' : 'today',
    scheduleView: source.scheduleView === 'list' ? 'list' : 'grouped',
    sorting:
      sort &&
      [
        'appointmentTime',
        'customerName',
        'serviceName',
        'technicianName',
      ].includes(sort.id) &&
      typeof sort.desc === 'boolean'
        ? [{ id: sort.id, desc: sort.desc }]
        : defaults.sorting,
    technicians: Object.fromEntries(
      LOCATIONS.flatMap(({ id }) => {
        const name = source.technicians?.[id];
        return typeof name === 'string' &&
          name.length > 0 &&
          name.length <= 200
          ? [[id, name]]
          : [];
      }),
    ),
    theme: source.theme === 'light' ? 'light' : 'dark',
  };
}

function readPreferences(user, key) {
  try {
    if (!key) return validateDashboardPreferences(null);
    const saved = localStorage.getItem(key);
    if (saved !== null)
      return validateDashboardPreferences(JSON.parse(saved));
    // Migrate the three existing username-scoped choices without reading a shared default.
    const username = user?.username;
    if (username) {
      const hideNames = localStorage.getItem(`reports_hideNames_${username}`);
      const showPrices = localStorage.getItem(
        `reports_showPrices_${username}`,
      );
      return validateDashboardPreferences({
        location: localStorage.getItem(`reports_location_${username}`),
        hideNames:
          hideNames === 'true'
            ? true
            : hideNames === 'false'
              ? false
              : undefined,
        showPrices:
          showPrices === 'true'
            ? true
            : showPrices === 'false'
              ? false
              : undefined,
      });
    }
  } catch {
    // Storage can be unavailable or contain an older/invalid value.
  }
  return validateDashboardPreferences(null);
}

// The dashboard is keyed by identity so one user's state is never written to another key.
export function useDashboardPreferences(user) {
  const key = dashboardPreferencesKey(user);
  const [preferences, setPreferences] = useState(() =>
    readPreferences(user, key),
  );
  const updatePreferences = useCallback((update) => {
    setPreferences((current) =>
      validateDashboardPreferences({
        ...current,
        ...(typeof update === 'function' ? update(current) : update),
      }),
    );
  }, []);

  useEffect(() => {
    if (!key) return;
    try {
      const serialized = JSON.stringify(preferences);
      if (localStorage.getItem(key) !== serialized)
        localStorage.setItem(key, serialized);
    } catch {
      // Choices still work for this session when storage is blocked or full.
    }
  }, [key, preferences]);

  useEffect(() => {
    const sync = (event) => {
      if (event.key !== key || !key) return;
      try {
        setPreferences(
          validateDashboardPreferences(JSON.parse(event.newValue)),
        );
      } catch {
        // Ignore malformed writes from another tab.
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle(
      'dark',
      preferences.theme === 'dark',
    );
    document.documentElement.dataset.theme = preferences.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        'content',
        preferences.theme === 'light' ? '#f6f6f8' : '#09090b',
      );
    return () => {
      document.documentElement.classList.add('dark');
      delete document.documentElement.dataset.theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', '#09090b');
    };
  }, [preferences.theme]);

  return [preferences, updatePreferences];
}
