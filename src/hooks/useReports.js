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

// In-memory cache for reports (persists across tab switches)
const reportCache = new Map();

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
  // Cached report contents are not rendered until the governance view event is
  // confirmed. This keeps a D1 outage from bypassing the audited-view gate.
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(locationId && date));
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Track current location to detect changes
  const currentContextRef = useRef(`${locationId || ''}|${date || ''}|${viewerId || ''}`);

  // Track current request to handle race conditions
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);

  // When location changes, immediately check cache
  useEffect(() => {
    const contextKey = `${locationId || ''}|${date || ''}|${viewerId || ''}`;
    if (currentContextRef.current !== contextKey) {
      currentContextRef.current = contextKey;
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

  const fetchReport = useCallback(async (forceRefresh = false) => {
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
        setLastUpdated(new Date(cached.timestamp));
        setError(null);
        setLoading(false);
        return;
      }
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const location = LOCATIONS.find(l => l.id === locationId || l.squareId === locationId);
      const squareId = location?.squareId || locationId;
      const report = await api.getFullReport(date, squareId);

      // Only update if this is still the current request
      if (currentRequestId === requestIdRef.current) {
        const now = Date.now();

        // Cache the result
        reportCache.set(cacheKey, {
          data: report,
          timestamp: now
        });

        setData(report);
        setLastUpdated(new Date(now));
      }
    } catch (err) {
      // Only update error if this is still the current request
      if (currentRequestId === requestIdRef.current && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
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

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchReport(true), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchReport]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh: () => fetchReport(true),
  };
}

// Legacy hook for basic reports
export function useReports(locationId, date) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchReport = useCallback(async () => {
    if (!locationId || !date) return;

    setLoading(true);
    setError(null);

    try {
      const location = LOCATIONS.find(l => l.id === locationId || l.squareId === locationId);
      const squareId = location?.squareId || locationId;

      const report = await api.getManagerReport(date, squareId);
      setData(report);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [locationId, date]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    const interval = setInterval(fetchReport, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchReport]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh: fetchReport,
  };
}

export function useAllLocationsReport(date) {
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAllReports = useCallback(async () => {
    if (!date) return;

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        LOCATIONS.map(async (location) => {
          try {
            const report = await api.getDailyReport(date, location.squareId);
            return { locationId: location.id, report, error: null };
          } catch (err) {
            return { locationId: location.id, report: null, error: err.message };
          }
        })
      );

      const reportsMap = {};
      results.forEach(({ locationId, report, error }) => {
        reportsMap[locationId] = { data: report, error };
      });

      setReports(reportsMap);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchAllReports();
  }, [fetchAllReports]);

  useEffect(() => {
    const interval = setInterval(fetchAllReports, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllReports]);

  return {
    reports,
    loading,
    error,
    lastUpdated,
    refresh: fetchAllReports,
  };
}

// Hook for fetching all appointments across all locations for a date
// Used for cross-location duplicate detection
export function useAllLocationAppointments(date) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAppointments = useCallback(async () => {
    if (!date) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.getAllLocationAppointments(date);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

export default useReports;
