import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [restoreError, setRestoreError] = useState(null);
  const authAttemptRef = useRef(0);

  const restoreSession = useCallback(async () => {
      const attempt = ++authAttemptRef.current;
      setRestoreError(null);
      setLoading(true);
      const token = api.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await api.verifyToken();
        if (attempt === authAttemptRef.current) setUser(data.user);
      } catch (err) {
        if (attempt !== authAttemptRef.current || err.code === 'AUTH_CONTEXT_CHANGED') return;
        if (api.getToken()) setRestoreError(err.message);
      } finally {
        if (attempt === authAttemptRef.current) setLoading(false);
      }
  }, []);

  // Restore only after the server confirms current access. A temporary failure
  // offers retry without discarding the credential or showing cached reports.
  useEffect(() => {
    restoreSession();

    // Listen for auth expiry events
    const handleAuthExpired = (event) => {
      authAttemptRef.current += 1;
      setLoading(false);
      setRestoreError(null);
      setUser(null);
      setError(event.detail?.message || 'Session expired. Please login again.');
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, [restoreSession]);

  const login = useCallback(async (pin) => {
    const attempt = ++authAttemptRef.current;
    setRestoreError(null);
    setError(null);
    // Login owns pending-entry feedback; keep it mounted until authentication
    // succeeds. Global loading is only for restoring an existing session.
    try {
      const data = await api.login(pin);
      if (attempt === authAttemptRef.current) setUser(data.user);
      return data;
    } catch (err) {
      if (attempt === authAttemptRef.current) setError(err.message);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    authAttemptRef.current += 1;
    setLoading(false);
    setRestoreError(null);
    api.logout();
    setUser(null);
  }, []);

  return {
    user,
    loading,
    restoreError,
    restoreSession,
    error,
    login,
    logout,
    isAuthenticated: !!user,
  };
}

export default useAuth;
