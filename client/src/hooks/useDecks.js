import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.js';

export function useDecks() {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDecks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/decks');
      setDecks(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch decks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDecks(); }, [fetchDecks]);

  const importDeck = async (presentationId) => {
    const res = await api.post('/api/decks', { presentationId });
    setDecks((prev) => [res.data, ...prev]);
    return res.data;
  };

  const deleteDeck = async (deckId) => {
    await api.delete(`/api/decks/${deckId}`);
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
  };

  return { decks, loading, error, fetchDecks, importDeck, deleteDeck };
}

export function useDeck(deckId) {
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDeck = useCallback(async () => {
    if (!deckId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/decks/${deckId}`);
      setDeck(res.data);
    } catch {
      setDeck(null);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => { fetchDeck(); }, [fetchDeck]);

  return { deck, loading, refetch: fetchDeck };
}
