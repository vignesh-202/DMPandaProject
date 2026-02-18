import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsChartProps {
  data: any[];
  type: 'line' | 'bar';
  dataKey: string;
  xAxisKey: string;
  lineColor?: string;
  barColor?: string;
  gridStroke?: string;
  hideGrid?: boolean;
  hideYAxis?: boolean;
  hideLegend?: boolean;
}

const AnalyticsChart = React.memo(({
  data,
  type,
  dataKey,
  xAxisKey,
  lineColor,
  barColor,
  gridStroke,
  hideGrid,
  hideYAxis,
  hideLegend,
}: AnalyticsChartProps) => {
  const finalLineColor = lineColor || '#3b82f6'; // Blue default
  const finalBarColor = barColor || 'var(--chart-bar)';
  const finalGridStroke = gridStroke || 'var(--chart-grid)';

  return (
    <ResponsiveContainer width="100%" height={300}>
      {type === 'line' ? (
        <LineChart data={data}>
          <defs>
            <filter id="line-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={finalLineColor} floodOpacity="0.5" />
            </filter>
          </defs>
          {!hideGrid && <CartesianGrid strokeDasharray="3 3" stroke={finalGridStroke} vertical={false} />}
          <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
          {!hideYAxis && <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />}
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            itemStyle={{ color: '#fff' }}
          />
          {!hideLegend && <Legend />}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={finalLineColor}
            strokeWidth={5}
            dot={false}
            activeDot={{ r: 6, strokeWidth: 0 }}
            style={{ filter: 'url(#line-glow)' }}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </LineChart>
      ) : (
        <BarChart data={data}>
          {!hideGrid && <CartesianGrid strokeDasharray="3 3" stroke={finalGridStroke} />}
          <XAxis dataKey={xAxisKey} />
          {!hideYAxis && <YAxis />}
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }}
          />
          {!hideLegend && <Legend />}
          <Bar dataKey={dataKey} fill={finalBarColor} animationDuration={1500} animationEasing="ease-out" />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
});

export default AnalyticsChart;