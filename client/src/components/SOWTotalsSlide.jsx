const CATS = {
  strategy: { label: 'Strategy & Discovery', color: '#7F77DD' },
  design: { label: 'Design & Creative', color: '#D4537E' },
  marketing: { label: 'Marketing & Demand Gen', color: '#BA7517' },
  engineering: { label: 'Engineering & Development', color: '#378ADD' },
  infra: { label: 'Infrastructure & Hosting', color: '#1D9E75' },
  software: { label: 'Software Licenses & Tools', color: '#888780' },
  pm: { label: 'Project Management & Ops', color: '#D85A30' },
  retainer: { label: 'Retainer & Ongoing', color: '#639922' },
};

function fmtCurrency(v) {
  if (!v) return '\u2014';
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SOWTotalsSlide({ content, bgColor, client, sowMeta }) {
  const light = isLight(bgColor);
  const textColor = light ? '#1e293b' : '#f1f5f9';
  const subtleColor = light ? '#64748b' : '#94a3b8';
  const borderColor = light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

  // content is { categories: [{ categoryId, subtotal, passThrough }] }
  const categories = content?.categories || [];
  const grandTotal = categories.reduce((acc, c) => acc + (c.subtotal || 0), 0);
  const passThroughTotal = categories.reduce((acc, c) => acc + (c.passThrough || 0), 0);

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center', padding: '5% 10%',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      color: textColor,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 14, letterSpacing: '0.08em', color: subtleColor, textTransform: 'uppercase', marginBottom: 8 }}>
          Investment Summary
        </div>
        <div style={{ fontSize: 32, fontWeight: 600 }}>
          {client || 'Project'} Proposal
        </div>
        {sowMeta?.sowDate && (
          <div style={{ fontSize: 15, color: subtleColor, marginTop: 6 }}>{sowMeta.sowDate}</div>
        )}
      </div>

      {/* Category breakdown */}
      <div style={{ width: '100%', maxWidth: 600 }}>
        {categories.map(cat => {
          const info = CATS[cat.categoryId] || { label: cat.categoryId, color: '#6366f1' };
          return (
            <div key={cat.categoryId} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 0', borderBottom: `1px solid ${borderColor}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: info.color, flexShrink: 0 }} />
                <span style={{ fontSize: 17 }}>{info.label}</span>
              </div>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{fmtCurrency(cat.subtotal)}</span>
            </div>
          );
        })}

        {/* Pass-through subtotal */}
        {passThroughTotal > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '14px 0',
            fontSize: 15, color: subtleColor, borderBottom: `1px solid ${borderColor}`,
          }}>
            <span>Pass-through costs</span>
            <span>{fmtCurrency(passThroughTotal)}</span>
          </div>
        )}

        {/* Grand total */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', padding: '20px 0',
          fontSize: 24, fontWeight: 700, marginTop: 8,
        }}>
          <span>Estimated Total</span>
          <span>{grandTotal > 0 ? fmtCurrency(grandTotal) : '\u2014'}</span>
        </div>

        <div style={{ fontSize: 12, color: subtleColor, textAlign: 'right' }}>
          Totals reflect qty &times; rate for completed line items only
        </div>

        {/* SOW meta footer */}
        {(sowMeta?.preparedBy || sowMeta?.expiresDate || sowMeta?.version) && (
          <div style={{
            display: 'flex', gap: 24, justifyContent: 'center', marginTop: 32,
            fontSize: 13, color: subtleColor,
          }}>
            {sowMeta.preparedBy && <span>Prepared by {sowMeta.preparedBy}</span>}
            {sowMeta.version && <span>v{sowMeta.version}</span>}
            {sowMeta.expiresDate && <span>Expires {sowMeta.expiresDate}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function isLight(hex) {
  if (!hex) return false;
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}
