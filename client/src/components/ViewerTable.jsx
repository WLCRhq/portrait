import { useState } from 'react';
import { ChevronDown, ChevronRight, User, Globe, Monitor, Clock, ExternalLink } from 'lucide-react';

export default function ViewerTable({ sessions }) {
  const [expandedIp, setExpandedIp] = useState(null);
  const [expandedSession, setExpandedSession] = useState(null);

  const formatDuration = (seconds) => {
    if (seconds == null) return 'Active';
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const formatLocation = (session) => {
    const parts = [];
    if (session.city) parts.push(session.city);
    if (session.region) parts.push(session.region);
    if (session.country) parts.push(session.country);
    return parts.join(', ') || '-';
  };

  const formatDevice = (session) => {
    if (session.browser && session.os) return `${session.browser} / ${session.os}`;
    if (session.browser) return session.browser;
    if (session.device) return session.device;
    if (/mobile/i.test(session.userAgent)) return 'Mobile';
    if (/tablet|ipad/i.test(session.userAgent)) return 'Tablet';
    return 'Desktop';
  };

  const formatReferrer = (ref) => {
    if (!ref) return null;
    try {
      const url = new URL(ref);
      return url.hostname + (url.pathname !== '/' ? url.pathname : '');
    } catch {
      return ref.slice(0, 60);
    }
  };

  // Group sessions by anonymized IP
  const viewerMap = {};
  for (const s of sessions) {
    const key = s.viewerIp;
    if (!viewerMap[key]) {
      viewerMap[key] = {
        ip: s.viewerIp,
        location: formatLocation(s),
        device: formatDevice(s),
        isp: s.isp,
        sessions: [],
        totalSessions: 0,
        totalSeconds: 0,
        lastSeen: s.startedAt,
      };
    }
    const viewer = viewerMap[key];
    viewer.sessions.push(s);
    viewer.totalSessions++;
    if (s.totalSeconds) viewer.totalSeconds += s.totalSeconds;
    if (new Date(s.startedAt) > new Date(viewer.lastSeen)) {
      viewer.lastSeen = s.startedAt;
      viewer.location = formatLocation(s);
      viewer.device = formatDevice(s);
      if (s.isp) viewer.isp = s.isp;
    }
  }

  const viewers = Object.values(viewerMap).sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  );

  const thStyle = {
    padding: '8px 12px', textAlign: 'left',
    fontSize: 12, fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap', userSelect: 'none',
  };

  const tdStyle = {
    padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--border)',
  };

  const detailLabel = { fontSize: 11, color: 'var(--text)', fontWeight: 500 };
  const detailValue = { fontSize: 12, color: 'var(--text-h)' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 30 }} />
            <th style={thStyle}>Viewer</th>
            <th style={thStyle}>Location</th>
            <th style={thStyle}>Organization</th>
            <th style={thStyle}>Device</th>
            <th style={thStyle}>Sessions</th>
            <th style={thStyle}>Total Time</th>
            <th style={thStyle}>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {viewers.map((viewer) => {
            const isExpanded = expandedIp === viewer.ip;
            return (
              <>{/* Viewer row */}
                <tr
                  key={viewer.ip}
                  onClick={() => {
                    setExpandedIp(isExpanded ? null : viewer.ip);
                    setExpandedSession(null);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={tdStyle}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <User size={14} color="var(--accent)" />
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{viewer.ip}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{viewer.location}</td>
                  <td style={tdStyle}>
                    {viewer.isp ? (
                      <span style={{ fontSize: 12 }}>{viewer.isp}</span>
                    ) : (
                      <span style={{ color: 'var(--text)', opacity: 0.5, fontSize: 12 }}>-</span>
                    )}
                  </td>
                  <td style={tdStyle}>{viewer.device}</td>
                  <td style={tdStyle}>
                    <span className="badge badge-warning" style={{ fontSize: 12 }}>{viewer.totalSessions}</span>
                  </td>
                  <td style={tdStyle}>{formatDuration(viewer.totalSeconds || null)}</td>
                  <td style={tdStyle}>{new Date(viewer.lastSeen).toLocaleString()}</td>
                </tr>

                {/* Expanded: individual sessions */}
                {isExpanded && viewer.sessions
                  .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                  .map((session) => {
                    const sessionExpanded = expandedSession === session.id;
                    const ref = formatReferrer(session.referrer);
                    return (
                      <>{/* Session row */}
                        <tr
                          key={session.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSession(sessionExpanded ? null : session.id);
                          }}
                          style={{ cursor: 'pointer', background: 'var(--bg-secondary)' }}
                        >
                          <td style={{ ...tdStyle, paddingLeft: 32 }}>
                            {sessionExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text)' }} colSpan={2}>
                            Session — {new Date(session.startedAt).toLocaleString()}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text)' }}>
                            {session.isp || '-'}
                          </td>
                          <td style={tdStyle}>{formatDevice(session)}</td>
                          <td style={tdStyle}>{session.slideEvents?.length || 0} slides</td>
                          <td style={tdStyle}>{formatDuration(session.totalSeconds)}</td>
                          <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text)' }}>
                            {ref && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ExternalLink size={10} /> {ref}
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Session detail */}
                        {sessionExpanded && (
                          <tr key={`${session.id}-detail`}>
                            <td colSpan={8} style={{ padding: '12px 12px 16px 56px', background: 'var(--bg-secondary)' }}>
                              {/* Detail grid */}
                              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
                                {session.browser && (
                                  <div>
                                    <div style={detailLabel}>Browser</div>
                                    <div style={detailValue}>{session.browser}</div>
                                  </div>
                                )}
                                {session.os && (
                                  <div>
                                    <div style={detailLabel}>OS</div>
                                    <div style={detailValue}>{session.os}</div>
                                  </div>
                                )}
                                {session.device && (
                                  <div>
                                    <div style={detailLabel}>Device Type</div>
                                    <div style={detailValue}>{session.device}</div>
                                  </div>
                                )}
                                {session.screenRes && (
                                  <div>
                                    <div style={detailLabel}>Screen</div>
                                    <div style={detailValue}>{session.screenRes}</div>
                                  </div>
                                )}
                                {session.timezone && (
                                  <div>
                                    <div style={detailLabel}>Timezone</div>
                                    <div style={detailValue}>{session.timezone}</div>
                                  </div>
                                )}
                                {session.isp && (
                                  <div>
                                    <div style={detailLabel}>ISP / Org</div>
                                    <div style={detailValue}>{session.isp}</div>
                                  </div>
                                )}
                                {session.referrer && (
                                  <div>
                                    <div style={detailLabel}>Referrer</div>
                                    <div style={detailValue}>{formatReferrer(session.referrer)}</div>
                                  </div>
                                )}
                                <div>
                                  <div style={detailLabel}>Location</div>
                                  <div style={detailValue}>{formatLocation(session)}</div>
                                </div>
                              </div>

                              {/* Slide events */}
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
                    );
                  })}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
