import React from 'react';

const CONFIG = {
  critical: { color: '#ff4757', bg: 'rgba(255,71,87,0.12)',  label: 'CRITICAL' },
  high:     { color: '#ff6b35', bg: 'rgba(255,107,53,0.12)', label: 'HIGH' },
  medium:   { color: '#ffa502', bg: 'rgba(255,165,2,0.12)',  label: 'MEDIUM' },
  low:      { color: '#2ed573', bg: 'rgba(46,213,115,0.12)', label: 'LOW' },
};

export default function SeverityBadge({ severity, size = 'sm' }) {
  const c = CONFIG[severity] || CONFIG.low;
  const fontSize = size === 'lg' ? 13 : 11;
  const padding  = size === 'lg' ? '4px 12px' : '3px 8px';

  return (
    <span style={{
      display: 'inline-block',
      fontSize,
      fontWeight: 700,
      letterSpacing: '0.06em',
      color: c.color,
      background: c.bg,
      border: `1px solid ${c.color}33`,
      borderRadius: 4,
      padding,
    }}>
      {c.label}
    </span>
  );
}
