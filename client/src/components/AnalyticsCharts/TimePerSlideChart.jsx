import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function TimePerSlideChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ textAlign: 'center', padding: 24, color: 'var(--text)' }}>No data yet</p>;
  }

  const maxVal = Math.max(...data);
  const chartData = data.map((seconds, i) => ({
    name: `${i + 1}`,
    seconds,
    isMax: seconds === maxVal && maxVal > 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 12 }} label={{ value: 'Slide', position: 'insideBottom', offset: -2 }} />
        <YAxis tick={{ fontSize: 12 }} label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }} />
        <Tooltip formatter={(value) => [`${value}s`, 'Avg. Time']} />
        <Bar dataKey="seconds" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.isMax ? '#6366f1' : '#a5b4fc'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
