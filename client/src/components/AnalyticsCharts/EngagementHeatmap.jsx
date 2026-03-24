export default function EngagementHeatmap({ data, deckId, slideCount }) {
  if (!data || data.length === 0) {
    return <p style={{ textAlign: 'center', padding: 24, color: 'var(--text)' }}>No data yet</p>;
  }

  const maxTime = Math.max(...data, 1);

  // Map engagement to a green-to-red gradient
  function getColor(seconds) {
    if (seconds === 0) return 'rgba(156, 163, 175, 0.3)'; // grey for no data
    const ratio = seconds / maxTime;
    // Green (high engagement) to Red (low engagement)
    // High = green, Low = red
    const r = Math.round(239 * (1 - ratio) + 16 * ratio);
    const g = Math.round(68 * (1 - ratio) + 185 * ratio);
    const b = Math.round(68 * (1 - ratio) + 129 * ratio);
    return `rgba(${r}, ${g}, ${b}, 0.6)`;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(100px, 1fr))`,
      gap: 8,
    }}>
      {Array.from({ length: slideCount }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'relative',
            aspectRatio: '16/9',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
          }}
        >
          <img
            src={`/api/decks/${deckId}/slides/${i}/image`}
            alt={`Slide ${i + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: getColor(data[i] || 0),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              background: 'rgba(0,0,0,0.6)', color: '#fff',
              padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
            }}>
              {data[i] || 0}s
            </span>
          </div>
          <div style={{
            position: 'absolute', bottom: 2, left: 4,
            fontSize: 10, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}>
            #{i + 1}
          </div>
        </div>
      ))}
    </div>
  );
}
