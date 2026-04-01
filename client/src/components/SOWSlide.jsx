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

export default function SOWSlide({ categoryId, content, bgColor }) {
  const cat = CATS[categoryId] || { label: categoryId, color: '#6366f1' };
  const rows = content?.rows?.filter(r => r.name) || [];
  const light = isLight(bgColor);
  const textColor = light ? '#1e293b' : '#f1f5f9';
  const subtleColor = light ? '#64748b' : '#94a3b8';
  const borderColor = light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
  const headerBg = light ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)';

  const subtotal = rows.reduce((acc, r) => {
    const t = parseFloat(r.qty) * parseFloat(r.rate);
    return isNaN(t) ? acc : acc + t;
  }, 0);

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center', padding: '5% 8%',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      color: textColor,
    }}>
      {/* Category header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, alignSelf: 'flex-start' }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
        <span style={{ fontSize: 28, fontWeight: 600 }}>{cat.label}</span>
      </div>

      {/* Line items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16 }}>
        <thead>
          <tr style={{ background: headerBg }}>
            {['Line Item', 'Unit', 'Qty', 'Rate', 'Frequency', 'Total'].map(h => (
              <th key={h} style={{
                padding: '10px 14px', textAlign: h === 'Qty' || h === 'Rate' || h === 'Total' ? 'right' : 'left',
                fontSize: 13, fontWeight: 500, color: subtleColor, borderBottom: `1px solid ${borderColor}`,
                whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const total = parseFloat(row.qty) * parseFloat(row.rate);
            return (
              <tr key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                  {row.name}
                  {row.passThrough && (
                    <span style={{
                      fontSize: 11, marginLeft: 8, background: 'rgba(29,158,117,0.15)',
                      color: '#1D9E75', padding: '2px 7px', borderRadius: 10,
                    }}>pass-through</span>
                  )}
                </td>
                <td style={{ padding: '10px 14px', color: subtleColor }}>{row.unit}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.qty || '\u2014'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>{fmtCurrency(row.rate)}</td>
                <td style={{ padding: '10px 14px', color: subtleColor }}>{row.freq}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                  {isNaN(total) ? '\u2014' : fmtCurrency(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Subtotal */}
      {subtotal > 0 && (
        <div style={{
          alignSelf: 'flex-end', marginTop: 20, display: 'flex', gap: 24,
          fontSize: 18, fontWeight: 600, padding: '12px 14px',
          borderTop: `2px solid ${cat.color}40`,
        }}>
          <span style={{ color: subtleColor }}>Section Total</span>
          <span>{fmtCurrency(subtotal)}</span>
        </div>
      )}
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
