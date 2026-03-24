import { useParams, Link } from 'react-router-dom';
import { useAnalytics } from '../hooks/useAnalytics.js';
import { ArrowLeft, Link2, Users, Clock, Eye, TrendingDown } from 'lucide-react';
import TimePerSlideChart from '../components/AnalyticsCharts/TimePerSlideChart.jsx';
import DropOffFunnel from '../components/AnalyticsCharts/DropOffFunnel.jsx';
import EngagementHeatmap from '../components/AnalyticsCharts/EngagementHeatmap.jsx';
import ViewerTable from '../components/ViewerTable.jsx';

export default function DeckDetail() {
  const { deckId } = useParams();
  const { data, loading, error, refetch } = useAnalytics(deckId);

  if (loading) {
    return (
      <div className="container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container">
        <p style={{ color: 'var(--danger)' }}>{error || 'Deck not found'}</p>
        <Link to="/dashboard">&larr; Back to dashboard</Link>
      </div>
    );
  }

  const { deck, summary, sessions } = data;

  return (
    <div className="container">
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to="/dashboard" style={{ color: 'var(--text)' }}><ArrowLeft size={20} /></Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24 }}>{deck.title}</h1>
          <p style={{ fontSize: 13, marginTop: 2 }}>{deck.slideCount} slides</p>
        </div>
        <Link to={`/dashboard/decks/${deckId}/links`} className="btn btn-secondary btn-sm">
          <Link2 size={14} /> Manage Links
        </Link>
        <button className="btn btn-secondary btn-sm" onClick={refetch}>Refresh</button>
      </header>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <Eye size={20} color="var(--accent)" />
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-h)', marginTop: 4 }}>{summary.totalViews}</div>
          <div style={{ fontSize: 13 }}>Total Views</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Users size={20} color="var(--accent)" />
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-h)', marginTop: 4 }}>{summary.uniqueViewers}</div>
          <div style={{ fontSize: 13 }}>Unique Viewers</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Clock size={20} color="var(--accent)" />
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-h)', marginTop: 4 }}>
            {Math.floor(summary.avgTotalTimeSec / 60)}m {summary.avgTotalTimeSec % 60}s
          </div>
          <div style={{ fontSize: 13 }}>Avg. Time on Deck</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <TrendingDown size={20} color="var(--accent)" />
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-h)', marginTop: 4 }}>
            Slide {summary.mostViewedSlide + 1}
          </div>
          <div style={{ fontSize: 13 }}>Most Viewed Slide</div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Average Time Per Slide</h3>
          <TimePerSlideChart data={summary.avgTimePerSlide} />
        </div>
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Drop-Off Funnel</h3>
          <DropOffFunnel data={summary.dropOffFunnel} totalViews={summary.totalViews} />
        </div>
      </div>

      {/* Engagement Heatmap */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Slide Engagement Heatmap</h3>
        <EngagementHeatmap data={summary.avgTimePerSlide} deckId={deckId} slideCount={deck.slideCount} />
      </div>

      {/* Viewer sessions table */}
      <div className="card">
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Viewer Sessions</h3>
        {sessions.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 24, color: 'var(--text)' }}>No viewing sessions yet.</p>
        ) : (
          <ViewerTable sessions={sessions} />
        )}
      </div>
    </div>
  );
}
