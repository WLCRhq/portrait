import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function ViewerTable({ sessions }) {
  const [expandedId, setExpandedId] = useState(null);
  const [sortBy, setSortBy] = useState('startedAt');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = [...sessions].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    if (sortBy === 'startedAt') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const parseDevice = (ua) => {
    if (/mobile/i.test(ua)) return 'Mobile';
    if (/tablet|ipad/i.test(ua)) return 'Tablet';
    return 'Desktop';
  };

  const thStyle = {
    padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap', userSelect: 'none',
  };

  const tdStyle = {
    padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }} />
            <th style={thStyle} onClick={() => toggleSort('viewerIp')}>IP</th>
            <th style={thStyle}>Location</th>
            <th style={thStyle}>Device</th>
            <th style={thStyle} onClick={() => toggleSort('startedAt')}>Date/Time</th>
            <th style={thStyle} onClick={() => toggleSort('totalSeconds')}>Duration</th>
            <th style={thStyle}>Slides</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((session) => (
            <>
              <tr
                key={session.id}
                onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
                style={{ cursor: 'pointer' }}
              >
                <td style={tdStyle}>
                  {expandedId === session.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{session.viewerIp}</td>
                <td style={tdStyle}>
                  {session.city && session.country
                    ? `${session.city}, ${session.country}`
                    : session.country || '-'}
                </td>
                <td style={tdStyle}>{parseDevice(session.userAgent)}</td>
                <td style={tdStyle}>{new Date(session.startedAt).toLocaleString()}</td>
                <td style={tdStyle}>
                  {session.totalSeconds != null
                    ? `${Math.floor(session.totalSeconds / 60)}m ${session.totalSeconds % 60}s`
                    : 'Active'}
                </td>
                <td style={tdStyle}>{session.slideEvents?.length || 0}</td>
              </tr>
              {expandedId === session.id && (
                <tr key={`${session.id}-detail`}>
                  <td colSpan={7} style={{ padding: '8px 12px 16px 40px', background: 'var(--bg-secondary)' }}>
                    {session.slideEvents?.length > 0 ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {session.slideEvents.map((evt, i) => (
                          <div key={i} style={{
                            padding: '4px 8px', borderRadius: 4, fontSize: 12,
                            background: 'var(--bg)', border: '1px solid var(--border)',
                          }}>
                            <strong>Slide {evt.slideIndex + 1}:</strong>{' '}
                            {evt.durationMs != null ? `${(evt.durationMs / 1000).toFixed(1)}s` : '-'}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: 'var(--text)' }}>No slide events recorded</p>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
