import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { setCsrfToken } from '../lib/api.js';
import { useDecks } from '../hooks/useDecks.js';
import { Plus, Trash2, RefreshCw, BarChart3, Link2, LogOut, Loader, FileText } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { decks, loading, fetchDecks, importDeck, deleteDeck } = useDecks();
  const [user, setUser] = useState(null);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [refreshingId, setRefreshingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => {
        setUser(res.data);
        if (res.data.csrfToken) setCsrfToken(res.data.csrfToken);
      })
      .catch(() => navigate('/'));
  }, [navigate]);

  // Poll for processing decks (slower interval to reduce flashing)
  useEffect(() => {
    const processing = decks.filter((d) => d.exportStatus === 'processing');
    if (processing.length === 0) return;

    const interval = setInterval(() => fetchDecks(), 4000);
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

  const handleReexport = async (deckId) => {
    setRefreshingId(deckId);
    try {
      await api.post(`/api/decks/${deckId}/reexport`);
      await fetchDecks();
    } catch {
      // handle silently
    }
    setRefreshingId(null);
  };

  const handleLogout = async () => {
    await api.post('/auth/logout');
    navigate('/');
  };

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <img src="/portrait-logo.png" alt="Portrait" style={{ height: 72 }} />
          {user && <p style={{ fontSize: 14, marginTop: 6 }}>Welcome, {user.name}</p>}
        </div>
        <Link to="/dashboard/proposals" className="btn btn-primary btn-sm">
          <FileText size={14} /> Proposals
        </Link>
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
            <div key={deck.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Processing progress bar */}
              {deck.exportStatus === 'processing' && (
                <div style={{ height: 3, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    background: 'var(--accent)',
                    width: '40%',
                    animation: 'progressSlide 1.5s ease-in-out infinite',
                  }} />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 16 }}>{deck.title}</h3>
                    {deck.exportStatus === 'done' && (
                      <span className="badge badge-success">Ready</span>
                    )}
                    {deck.exportStatus === 'error' && (
                      <span className="badge badge-danger">Error</span>
                    )}
                    {deck.exportStatus === 'processing' && (
                      <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Loader size={10} style={{ animation: 'spin 1s linear infinite' }} />
                        Exporting slides...
                      </span>
                    )}
                    {deck.exportStatus === 'pending' && (
                      <span className="badge badge-warning">Pending</span>
                    )}
                  </div>
                  <p style={{ fontSize: 13 }}>
                    {deck.slideCount} slides
                    {deck.user?.name && ` \u00b7 by ${deck.user.name}`}
                    {' \u00b7 '}{new Date(deck.createdAt).toLocaleDateString()}
                    {deck._count?.links > 0 && ` \u00b7 ${deck._count.links} link${deck._count.links > 1 ? 's' : ''}`}
                  </p>
                  {deck.exportStatus === 'processing' && (
                    <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>
                      Exporting high-resolution slides from Google. This may take a minute...
                    </p>
                  )}
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
                    </>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleReexport(deck.id)}
                    disabled={refreshingId === deck.id}
                    title={deck.exportStatus === 'processing' ? 'Cancel and re-sync' : 'Re-sync from Google Slides'}
                  >
                    <RefreshCw size={14} style={refreshingId === deck.id ? { animation: 'spin 1s linear infinite' } : {}} />
                    {refreshingId === deck.id ? 'Syncing...' : deck.exportStatus === 'processing' ? 'Restart' : 'Refresh'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteDeck(deck.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes progressSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
