import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { ArrowLeft, Shield, User } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    api.get('/api/admin/users')
      .then(res => { setUsers(res.data); setLoading(false); })
      .catch(() => { setError('Failed to load users'); setLoading(false); });
  }, []);

  const setRole = async (userId, role) => {
    setUpdatingId(userId);
    try {
      const res = await api.patch(`/api/admin/users/${userId}`, { role });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: res.data.role } : u));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update role');
    }
    setUpdatingId(null);
  };

  return (
    <div className="container">
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to="/dashboard" style={{ color: 'var(--text)' }}><ArrowLeft size={20} /></Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <Shield size={20} color="var(--accent)" />
          <h1 style={{ fontSize: 22 }}>User Management</h1>
        </div>
      </header>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(220,53,69,0.12)', border: '1px solid var(--danger)', color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: 'inherit', padding: 0 }}>&times;</button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 64 }} />)}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Email', 'Decks', 'Proposals', 'Joined', 'Role'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {user.role === 'admin'
                        ? <Shield size={14} color="var(--accent)" />
                        : <User size={14} color="var(--text)" />}
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{user.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text)' }}>{user.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{user._count.decks}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{user._count.proposals}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${user.role === 'admin' ? 'badge-warning' : ''}`}
                        style={user.role !== 'admin' ? { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 11 } : { fontSize: 11 }}>
                        {user.role}
                      </span>
                      {user.role === 'admin' ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          disabled={updatingId === user.id}
                          onClick={() => setRole(user.id, 'user')}
                        >
                          {updatingId === user.id ? '...' : 'Remove admin'}
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          disabled={updatingId === user.id}
                          onClick={() => setRole(user.id, 'admin')}
                        >
                          {updatingId === user.id ? '...' : 'Make admin'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
