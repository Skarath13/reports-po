import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';

export function useWeeklyDuplicateBookings(date, enabled) {
  const [state, setState] = useState({ date: null, data: null, loading: false, error: null });
  const sequence = useRef(0);
  const controller = useRef(null);
  const refresh = useCallback(async () => {
    if (!enabled || !date) return;
    const requestId = ++sequence.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setState((previous) => ({ date, data: previous.date === date ? previous.data : null, loading: true, error: null }));
    try {
      const data = await api.getWeeklyDuplicateBookings(date, { signal: controller.current.signal });
      if (data?.date !== date || !Array.isArray(data.groups) || !data.endDate || !data.refreshedAt) {
        throw new Error('The weekly booking check returned incomplete data.');
      }
      if (requestId === sequence.current) setState({ date, data, loading: false, error: null });
    } catch (error) {
      if (requestId === sequence.current && error.name !== 'AbortError') {
        setState((previous) => ({ date, data: previous.date === date ? previous.data : null, loading: false, error: error.message }));
      }
    }
  }, [date, enabled]);

  useEffect(() => {
    refresh();
    const interval = enabled ? setInterval(refresh, 2 * 60 * 1000) : null;
    return () => {
      if (interval) clearInterval(interval);
      sequence.current += 1;
      controller.current?.abort();
    };
  }, [enabled, refresh]);

  return { ...(state.date === date ? state : { data: null, loading: enabled, error: null }), refresh };
}
