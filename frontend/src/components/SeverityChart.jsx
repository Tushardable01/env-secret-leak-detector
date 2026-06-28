import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = {
  critical: '#ff4757',
  high:     '#ff6b35',
  medium:   '#ffa502',
  low:      '#2ed573',
};

export default function SeverityChart({ summary }) {
  const data = Object.entries(summary)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  if (data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div style={{
      background: '#1a1d2e',
      border: '1px solid #2d3148',
      borderRadius: 12,
      padding: '24px',
      marginBottom: 24,
    }}>
      <p style={{
        fontSize: 13, fontWeight: 600, color: '#8892a4',
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20,
      }}>
        Findings by severity
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div style={{ width: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1a1d2e',
                  border: '1px solid #2d3148',
                  borderRadius: 6,
                  color: '#e2e8f0',
                  fontSize: 13,
                }}
                formatter={(value, name) => [value, name.toUpperCase()]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ flex: 1 }}>
          {data.map((d) => (
            <div
              key={d.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div style={{
                width: 10, height: 10, borderRadius: 2,
                background: COLORS[d.name], flexShrink: 0,
              }} />
              <span style={{ flex: 1, fontSize: 13, color: '#a8b2c3', textTransform: 'capitalize' }}>
                {d.name}
              </span>
              <span style={{ fontSize: 22, fontWeight: 700, color: COLORS[d.name], minWidth: 30, textAlign: 'right' }}>
                {d.value}
              </span>
              <span style={{ fontSize: 12, color: '#4a5568', minWidth: 36 }}>
                {Math.round((d.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
