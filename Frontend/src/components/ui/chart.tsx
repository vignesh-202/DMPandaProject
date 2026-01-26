import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartProps {
  data: any[];
  type: 'line' | 'bar';
  dataKey: string;
  xAxisKey: string;
  lineColor?: string;
  barColor?: string;
  hideYAxis?: boolean;
  hideLegend?: boolean;
}

const Chart = React.memo(({
  data,
  type,
  dataKey,
  xAxisKey,
  hideYAxis,
  hideLegend,
}: ChartProps) => {

  return (
    <ResponsiveContainer width="100%" height={300}>
      {type === 'line' ? (
        <LineChart data={data}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="50%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#86efac" />
            </linearGradient>
            <filter id="glow" height="300%" width="300%" x="-100%" y="-100%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
          <XAxis dataKey={xAxisKey} stroke="var(--text)" fontSize={12} tickLine={false} axisLine={false} />
          {!hideYAxis && <YAxis stroke="var(--text)" fontSize={12} tickLine={false} axisLine={false} />}
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '8px' }}
            itemStyle={{ color: 'var(--text)' }}
          />
          {!hideLegend && <Legend />}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="url(#colorValue)"
            strokeWidth={3}
            dot={{ r: 4, fill: 'var(--background)', strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            filter="url(#glow)"
          />
        </LineChart>
      ) : (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} vertical={false} />
          <XAxis dataKey={xAxisKey} stroke="var(--text)" fontSize={12} tickLine={false} axisLine={false} />
          {!hideYAxis && <YAxis stroke="var(--text)" fontSize={12} tickLine={false} axisLine={false} />}
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '8px' }}
            itemStyle={{ color: 'var(--text)' }}
            cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
          />
          {!hideLegend && <Legend />}
          <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => {
              // Dynamic color based on value relative to max in data
              // Or just use the same logic as gauge?
              // Let's assume higher is better (Green)
              // We need to find the max value in the dataset to normalize
              const maxValue = Math.max(...data.map(d => d[dataKey] || 0));
              const val = entry[dataKey] || 0;
              const percent = maxValue > 0 ? val / maxValue : 0;

              let color;
              if (percent <= 0.5) {
                // Red to Yellow
                // interpolateColor logic needed here or just simple thresholds
                // For simplicity in this block, let's use HSL
                // Red is 0, Green is 120.
                const hue = percent * 120;
                color = `hsl(${hue}, 80%, 60%)`;
              } else {
                const hue = percent * 120;
                color = `hsl(${hue}, 80%, 60%)`;
              }
              // Actually, let's stick to the specific palette: Red(#f87171) -> Yellow(#fde047) -> Green(#86efac)
              // But HSL is smoother for arbitrary values.

              return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Bar>
        </BarChart>
      )}
    </ResponsiveContainer>
  );
});

export default Chart;
