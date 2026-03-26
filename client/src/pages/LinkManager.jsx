import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Plus, Copy, Trash2, ToggleLeft, ToggleRight, Check, LayoutDashboard, BarChart3 } from 'lucide-react';

const api = axios.create({ withCredentials: true });

export default function LinkManager() {
  const { deckId } = useParams();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await api.get(`/api/decks/${deckId}/links`);
      setLinks(res.data);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const createLink = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post(`/api/decks/${deckId}/links`, {
        label: label || undefined,
        expiresAt: expiresAt || undefined,
      });
      setLinks((prev) => [res.data, ...prev]);
      setLabel('');
      setExpiresAt('');
    } catch {
      // handle silently
    }
    setCreating(false);
  };

  const toggleLink = async (linkId, currentActive) => {
    await api.patch(`/api/decks/${deckId}/links/${linkId}`, { active: !currentActive });
    setLinks((prev) => prev.map((l) => l.id === linkId ? { ...l, active: !currentActive } : l));
  };

  const deleteLink = async (linkId) => {
    await api.delete(`/api/decks/${deckId}/links/${linkId}`);
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
  };

  const copyToClipboard = (link) => {
    const url = link.viewerUrl || `${window.location.origin}/view/${link.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="container">
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, flex: 1 }}>Share Links</h1>
        <Link to="/dashboard" className="btn btn-secondary btn-sm">
          <LayoutDashboard size={14} /> Dashboard
        </Link>
        <Link to={`/dashboard/decks/${deckId}`} className="btn btn-secondary btn-sm">
          <BarChart3 size={14} /> Analytics
        </Link>
      </header>

      {/* Create form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Create New Link</h3>
        <form onSubmit={createLink} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-h)' }}>Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Sent to Acme Corp"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: '0 1 220px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-h)' }}>Expiration Date</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            <Plus size={16} /> {creating ? 'Creating...' : 'Create Link'}
          </button>
        </form>
      </div>

      {/* Links list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}
        </div>
      ) : links.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p>No share links yet. Create one above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {links.map((link) => (
            <div key={link.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <code style={{ fontSize: 13, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>
                    /view/{link.slug}
                  </code>
                  {link.active ? (
                    <span className="badge badge-success">Active</span>
                  ) : (
                    <span className="badge badge-danger">Inactive</span>
                  )}
                  {link._count?.sessions > 0 && (
                    <span className="badge badge-warning">{link._count.sessions} views</span>
                  )}
                </div>
                <p style={{ fontSize: 13 }}>
                  {link.label || 'No label'}
                  {link.expiresAt && ` \u00b7 Expires ${new Date(link.expiresAt).toLocaleDateString()}`}
                  {' \u00b7 Created '}
                  {new Date(link.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(link)} title="Copy link">
                  {copiedId === link.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => toggleLink(link.id, link.active)}
                  title={link.active ? 'Deactivate' : 'Activate'}
                >
                  {link.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteLink(link.id)} title="Delete">
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
