import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function DropOffFunnel({ data, totalViews }) {
  if (!data || data.length === 0 || totalViews === 0) {
    return <p style={{ textAlign: 'center', padding: 24, color: 'var(--text)' }}>No data yet</p>;
  }

  const chartData = data.map((viewers, i) => ({
    name: `Slide ${i + 1}`,
    viewers,
    pct: Math.round((viewers / totalViews) * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value, _name, props) => [
            `${value} viewers (${props.payload.pct}%)`,
            'Reached',
          ]}
        />
        <Bar dataKey="viewers" fill="#818cf8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
