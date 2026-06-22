import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = api.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await api.verifyToken();
        setUser(data.user);
      } catch (err) {
        api.logout();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth expiry events
    const handleAuthExpired = () => {
      setUser(null);
      setError('Session expired. Please login again.');
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  const login = useCallback(async (pin) => {
    setError(null);
    setLoading(true);
    try {
      const data = await api.login(pin);
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  return {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
  };
}

export default useAuth;
