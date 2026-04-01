import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.js';

export function useProposals() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/proposals');
      setProposals(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch proposals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  const createProposal = async ({ title, client, deckId }) => {
    const res = await api.post('/api/proposals', { title, client, deckId });
    setProposals((prev) => [res.data, ...prev]);
    return res.data;
  };

  const deleteProposal = async (proposalId) => {
    await api.delete(`/api/proposals/${proposalId}`);
    setProposals((prev) => prev.filter((p) => p.id !== proposalId));
  };

  return { proposals, loading, error, fetchProposals, createProposal, deleteProposal };
}

export function useProposal(proposalId) {
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProposal = useCallback(async () => {
    if (!proposalId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/proposals/${proposalId}`);
      setProposal(res.data);
    } catch {
      setProposal(null);
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => { fetchProposal(); }, [fetchProposal]);

  const updateProposal = async (data) => {
    const res = await api.patch(`/api/proposals/${proposalId}`, data);
    setProposal(prev => ({ ...prev, ...res.data }));
    return res.data;
  };

  const updateSlides = async (slides) => {
    const res = await api.put(`/api/proposals/${proposalId}/slides`, slides);
    setProposal(prev => prev ? { ...prev, slides: res.data } : prev);
    return res.data;
  };

  return { proposal, loading, refetch: fetchProposal, updateProposal, updateSlides };
}
