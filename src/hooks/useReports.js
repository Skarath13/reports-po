import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

// Location configs with Square IDs
export const LOCATIONS = [
  { id: 'tustin', name: 'Tustin', squareId: 'G0X353MBKGTCW', color: '#3498db' },
  { id: 'costa-mesa', name: 'Costa Mesa', squareId: 'LVMKS7ERWS3KP', color: '#9b59b6' },
  { id: 'santa-ana', name: 'Santa Ana', squareId: 'LZMX8CTA69S7E', color: '#e74c3c' },
  { id: 'irvine', name: 'Irvine', squareId: 'LC0CZ4AZ7TKXS', color: '#2ecc71' },
  { id: 'newport-beach', name: 'Newport Beach', squareId: 'LR7WA061BB4KA', color: '#f39c12' },
];

export const REPORT_VERSION_POLL_MS = 20 * 1000;

// In-memory cache for reports (persists across tab switches)
const reportCache = new Map();

// Cache contents never survive logout, revocation or a new authenticated session.
window.addEventListener('report-auth-changed', () => reportCache.clear());

// Helper to get cache key
function getCacheKey(locationId, date, viewerId) {
  const location = LOCATIONS.find(l => l.id === locationId || l.squareId === locationId);
  const squareId = location?.squareId || locationId;
  return `${viewerId || 'anonymous'}-${squareId}-${date}`;
}

// Helper to get fresh cached data (returns null if stale/missing)
function getFreshCachedData(locationId, date, viewerId) {
  if (!locationId || !date) return null;
  const cacheKey = getCacheKey(locationId, date, viewerId);
  if (reportCache.has(cacheKey)) {
    const cached = reportCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 60000) {
      return cached;
    }
  }
  return null;
}

// Hook for fetching a single location's full report with caching
export function useFullReport(locationId, date, viewerId) {
  const contextKey = `${locationId || ''}|${date || ''}|${viewerId || ''}`;
  // Cached report contents are not rendered until the governance view event is
  // confirmed. This keeps a governance storage outage from bypassing the audited-view gate.
  const [data, setData] = useState(null);
  const [dataContext, setDataContext] = useState('');
  const [loading, setLoading] = useState(Boolean(locationId && date));
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Track current location to detect changes
  const currentContextRef = useRef(`${locationId || ''}|${date || ''}|${viewerId || ''}`);

  // Track current request to handle race conditions
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  // Version of the source rows the shown report was built from.
  const reportVersionRef = useRef(null);
  const fetchInFlightRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const shownContextRef = useRef('');

  // When location changes, immediately check cache
  useEffect(() => {
    const contextKey = `${locationId || ''}|${date || ''}|${viewerId || ''}`;
    if (currentContextRef.current !== contextKey) {
      currentContextRef.current = contextKey;
      reportVersionRef.current = null;
      const cached = getFreshCachedData(locationId, date, viewerId);
      if (cached) {
        // The cache entry was created only after the original full-report
        // request recorded its view.
        setData(null);
        setLastUpdated(null);
        setLoading(true);
        setError(null);
      } else {
        // No cache - will need to fetch, show loading
        setData(null);
        setLoading(true);
      }
    }
  }, [locationId, date, viewerId]);

  // background: refresh the shown report without blanking it (polls and timers).
  const fetchReport = useCallback(async (forceRefresh = false, { background = false } = {}) => {
    // Invalidate an older fetch even when the next location is served from cache.
    const currentRequestId = ++requestIdRef.current;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    // An aborted fetch never clears this itself; the newest request owns it.
    fetchInFlightRef.current = false;
    if (!locationId || !date) {
      setLoading(false);
      return;
    }

    const cacheKey = getCacheKey(locationId, date, viewerId);

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getFreshCachedData(locationId, date, viewerId);
      if (cached) {
        // The original full-report request already records this view. Cache
        // hits do not create a new audited action.
        setData(cached.data);
        setDataContext(`${locationId || ''}|${date || ''}|${viewerId || ''}`);
        setLastUpdated(new Date(cached.timestamp));
        reportVersionRef.current = cached.version ?? null;
        setError(null);
        setLoading(false);
        return;
      }
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    fetchInFlightRef.current = true;

    const contextKey = `${locationId || ''}|${date || ''}|${viewerId || ''}`;
    if (!(background && shownContextRef.current === contextKey)) setLoading(true);
    setError(null);

    try {
      const location = LOCATIONS.find(l => l.id === locationId || l.squareId === locationId);
      const squareId = location?.squareId || locationId;
      // Start the version read before the report so a change during the build
      // is seen on the next poll. It is never awaited: it cannot delay or fail
      // the report.
      const versionPromise = (typeof api.getReportVersion === 'function'
        ? Promise.resolve(api.getReportVersion(date, squareId, { signal: abortControllerRef.current.signal }))
        : Promise.resolve(null)
      ).catch(() => null);
      const report = await api.getFullReport(date, squareId, {
        signal: abortControllerRef.current.signal,
      });

      // Only update if this is still the current request
      if (currentRequestId === requestIdRef.current) {
        const now = Date.now();

        // Cache the result
        const entry = { data: report, timestamp: now, version: null };
        reportCache.set(cacheKey, entry);

        setData(report);
        setDataContext(contextKey);
        shownContextRef.current = contextKey;
        setLastUpdated(new Date(now));
        lastFetchAtRef.current = now;
        reportVersionRef.current = null;
        versionPromise.then((version) => {
          entry.version = version;
          if (currentRequestId === requestIdRef.current) reportVersionRef.current = version;
        });
      }
    } catch (err) {
      // Only update error if this is still the current request
      if (currentRequestId === requestIdRef.current && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        fetchInFlightRef.current = false;
        setLoading(false);
      }
    }
  }, [locationId, date, viewerId]);

  // Fetch on mount and when location/date changes
  useEffect(() => {
    fetchReport();

    // Cleanup: abort on unmount or when deps change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchReport]);

  // Every 20 seconds, a cheap version check rebuilds the report only when its
  // Square, Bloom or check-in rows changed. If the check is unavailable the
  // 2-minute refresh below still runs.
  useEffect(() => {
    if (!locationId || !date) return undefined;
    const location = LOCATIONS.find(l => l.id === locationId || l.squareId === locationId);
    const squareId = location?.squareId || locationId;
    let checking = false;
    let cancelled = false;
    const controller = new AbortController();
    const interval = setInterval(async () => {
      // Never interrupt a report that is still loading.
      if (checking || document.hidden || fetchInFlightRef.current || reportVersionRef.current === null) return;
      checking = true;
      try {
        const version = await api.getReportVersion(date, squareId, { signal: controller.signal });
        if (!cancelled && !fetchInFlightRef.current && version && version !== reportVersionRef.current) {
          fetchReport(true, { background: true });
        }
      } catch {
        // The 2-minute refresh covers a failed check.
      } finally {
        checking = false;
      }
    }, REPORT_VERSION_POLL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [locationId, date, fetchReport]);

  // Auto-refresh every 2 minutes, skipped right after a change-driven refresh.
  useEffect(() => {
    const interval = setInterval(() => {
      if (fetchInFlightRef.current || Date.now() - lastFetchAtRef.current < 60 * 1000) return;
      fetchReport(true, { background: true });
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchReport]);

  return {
    data: dataContext === contextKey ? data : null,
    loading: loading || (Boolean(locationId && date) && !error && dataContext !== contextKey),
    error,
    lastUpdated: dataContext === contextKey ? lastUpdated : null,
    refresh: () => fetchReport(true),
  };
}

// Hook for fetching all appointments across all locations for a date
// Used for cross-location duplicate detection
export function useAllLocationAppointments(date) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  const fetchAppointments = useCallback(async () => {
    if (!date) return;

    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setData((current) => current?.date === date ? current : null);

    try {
      const result = await api.getAllLocationAppointments(date);
      if (currentRequestId === requestIdRef.current) setData(result);
    } catch (err) {
      if (currentRequestId === requestIdRef.current) setError(err.message);
    } finally {
      if (currentRequestId === requestIdRef.current) setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchAppointments, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAppointments]);

  return {
    data,
    loading,
    error,
    refresh: fetchAppointments,
  };
}
