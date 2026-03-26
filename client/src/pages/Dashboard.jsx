import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDecks } from '../hooks/useDecks.js';
import { Plus, Trash2, RefreshCw, BarChart3, Link2, LogOut } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { decks, loading, fetchDecks, importDeck, deleteDeck } = useDecks();
  const [user, setUser] = useState(null);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('/auth/me', { withCredentials: true })
      .then((res) => setUser(res.data))
      .catch(() => navigate('/'));
  }, [navigate]);

  // Poll for processing decks
  useEffect(() => {
    const processing = decks.filter((d) => d.exportStatus === 'processing');
    if (processing.length === 0) return;

    const interval = setInterval(() => fetchDecks(), 2000);
    return () => clearInterval(interval);
  }, [decks, fetchDecks]);

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importUrl.trim()) return;

    setImporting(true);
    setError(null);
    try {
      await importDeck(importUrl.trim());
      setImportUrl('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import');
    }
    setImporting(false);
  };

  const handleLogout = async () => {
    await axios.get('/auth/logout', { withCredentials: true });
    navigate('/');
  };

  const statusBadge = (status) => {
    const map = {
      done: { cls: 'badge-success', label: 'Ready' },
      processing: { cls: 'badge-warning', label: 'Processing...' },
      pending: { cls: 'badge-warning', label: 'Pending' },
      error: { cls: 'badge-danger', label: 'Error' },
    };
    const s = map[status] || map.pending;
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <img src="/portrait-logo.png" alt="Portrait" style={{ height: 36 }} />
          {user && <p style={{ fontSize: 14, marginTop: 6 }}>Welcome, {user.name}</p>}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
          <LogOut size={14} /> Logout
        </button>
      </header>

      {/* Import form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Import a Presentation</h3>
        <form onSubmit={handleImport} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="Paste Google Slides URL or presentation ID..."
            style={{ flex: 1 }}
            disabled={importing}
          />
          <button type="submit" className="btn btn-primary" disabled={importing}>
            <Plus size={16} /> {importing ? 'Importing...' : 'Import'}
          </button>
        </form>
        {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginTop: 8 }}>{error}</p>}
      </div>

      {/* Decks list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 80 }} />
          ))}
        </div>
      ) : decks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text)' }}>No presentations yet. Import one above to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {decks.map((deck) => (
            <div key={deck.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontSize: 16 }}>{deck.title}</h3>
                  {statusBadge(deck.exportStatus)}
                </div>
                <p style={{ fontSize: 13 }}>
                  {deck.slideCount} slides &middot; Imported {new Date(deck.createdAt).toLocaleDateString()}
                  {deck._count?.links > 0 && ` \u00b7 ${deck._count.links} link${deck._count.links > 1 ? 's' : ''}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {deck.exportStatus === 'done' && (
                  <>
                    <Link to={`/dashboard/decks/${deck.id}`} className="btn btn-secondary btn-sm">
                      <BarChart3 size={14} /> Analytics
                    </Link>
                    <Link to={`/dashboard/decks/${deck.id}/links`} className="btn btn-secondary btn-sm">
                      <Link2 size={14} /> Links
                    </Link>
                    <button className="btn btn-secondary btn-sm" onClick={async () => {
                      await axios.post(`/api/decks/${deck.id}/reexport`, {}, { withCredentials: true });
                      fetchDecks();
                    }} title="Re-sync from Google Slides">
                      <RefreshCw size={14} /> Refresh
                    </button>
                  </>
                )}
                <button className="btn btn-danger btn-sm" onClick={() => deleteDeck(deck.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
