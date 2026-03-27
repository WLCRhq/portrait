import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.js';

export function useAnalytics(deckId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    if (!deckId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/analytics/${deckId}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  return { data, loading, error, refetch: fetchAnalytics };
}
