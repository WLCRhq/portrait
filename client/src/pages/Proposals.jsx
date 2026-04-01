import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProposals } from '../hooks/useProposals.js';
import { useDecks } from '../hooks/useDecks.js';
import { Plus, Trash2, FileText, ArrowLeft } from 'lucide-react';

export default function Proposals() {
  const navigate = useNavigate();
  const { proposals, loading, createProposal, deleteProposal } = useProposals();
  const { decks } = useDecks();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [deckId, setDeckId] = useState('');
  const [creating, setCreating] = useState(false);

  const readyDecks = decks.filter(d => d.exportStatus === 'done');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const proposal = await createProposal({ title: title.trim(), client: client.trim() || undefined, deckId: deckId || undefined });
      navigate(`/dashboard/proposals/${proposal.id}`);
    } catch {
      setCreating(false);
    }
  };

  const statusColors = { draft: 'badge-warning', active: 'badge-success', archived: 'badge' };

  return (
    <div className="container">
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to="/dashboard" style={{ color: 'var(--text)' }}><ArrowLeft size={20} /></Link>
        <h1 style={{ fontSize: 24, flex: 1 }}>Proposals</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={14} /> New Proposal
        </button>
      </header>

      {showCreate && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>Create Proposal</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 4 }}>Project title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Website Redesign" required />
              </div>
              <div>
                <label style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 4 }}>Client name</label>
                <input value={client} onChange={e => setClient(e.target.value)} placeholder="e.g. Acme Corp" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 4 }}>Link a presentation (optional)</label>
              <select value={deckId} onChange={e => setDeckId(e.target.value)} style={{ width: '100%' }}>
                <option value="">No deck</option>
                {readyDecks.map(d => (
                  <option key={d.id} value={d.id}>{d.title} ({d.slideCount} slides)</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : proposals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <FileText size={32} color="var(--text)" style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ color: 'var(--text)' }}>No proposals yet. Create one to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {proposals.map(p => (
            <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontSize: 16 }}>{p.title}</h3>
                  <span className={`badge ${statusColors[p.status] || 'badge'}`}>{p.status}</span>
                </div>
                <p style={{ fontSize: 13 }}>
                  {p.client && `${p.client} \u00b7 `}
                  {p._count?.slides || 0} slides
                  {p._count?.links > 0 && ` \u00b7 ${p._count.links} link${p._count.links > 1 ? 's' : ''}`}
                  {p.deck && ` \u00b7 Deck: ${p.deck.title}`}
                  {' \u00b7 '}{new Date(p.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to={`/dashboard/proposals/${p.id}`} className="btn btn-primary btn-sm">
                  Edit
                </Link>
                <button className="btn btn-danger btn-sm" onClick={() => deleteProposal(p.id)}>
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
