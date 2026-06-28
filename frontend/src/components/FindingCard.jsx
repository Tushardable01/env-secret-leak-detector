import React, { useState } from 'react';
import SeverityBadge from './SeverityBadge';

const s = {
  card: {
    background: '#1a1d2e',
    border: '1px solid #2d3148',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    transition: 'border-color 0.2s',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  type: {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  meta: {
    fontSize: 12,
    color: '#8892a4',
    fontFamily: 'monospace',
  },
  chevron: {
    color: '#4a5568',
    fontSize: 18,
    transition: 'transform 0.2s',
  },
  body: {
    borderTop: '1px solid #2d3148',
    padding: '16px 18px',
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: '#4a5568',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 14,
  },
  code: {
    background: '#0f1117',
    border: '1px solid #2d3148',
    borderRadius: 6,
    padding: '10px 14px',
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#a8b2c3',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    lineHeight: 1.6,
  },
  hint: {
    background: 'rgba(124,111,205,0.08)',
    border: '1px solid rgba(124,111,205,0.2)',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: 13,
    color: '#a99de0',
    lineHeight: 1.5,
  },
  commitRow: {
    display: 'flex',
    gap: 24,
    flexWrap: 'wrap',
  },
  commitItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
};

export default function FindingCard({ finding }) {
  const [open, setOpen] = useState(false);

  const date = finding.commitDate
    ? new Date(finding.commitDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';

  return (
    <div
      style={{
        ...s.card,
        borderColor: open ? '#3d4168' : '#2d3148',
      }}
    >
      <div style={s.header} onClick={() => setOpen(!open)}>
        <SeverityBadge severity={finding.severity} />
        <span style={s.type}>{finding.type}</span>
        <span style={s.meta}>{finding.commitHash?.substring(0, 7)}</span>
        <span style={s.meta}>{date}</span>
        <span style={{ ...s.chevron, transform: open ? 'rotate(180deg)' : 'none' }}>
          ▾
        </span>
      </div>

      {open && (
        <div style={s.body}>
          <div style={s.commitRow}>
            <div style={s.commitItem}>
              <span style={s.label}>Commit hash</span>
              <code style={{ fontFamily: 'monospace', fontSize: 13, color: '#7c6fcd' }}>
                {finding.commitHash}
              </code>
            </div>
            {finding.authorName && (
              <div style={s.commitItem}>
                <span style={s.label}>Author</span>
                <span style={{ fontSize: 13, color: '#a8b2c3' }}>{finding.authorName}</span>
              </div>
            )}
            <div style={s.commitItem}>
              <span style={s.label}>Date</span>
              <span style={{ fontSize: 13, color: '#a8b2c3' }}>{date}</span>
            </div>
          </div>

          <p style={s.label}>Secret preview (redacted)</p>
          <div style={s.code}>{finding.preview}</div>

          {finding.lineContext && (
            <>
              <p style={s.label}>Code context</p>
              <div style={s.code}>{finding.lineContext}</div>
            </>
          )}

          {finding.hint && (
            <>
              <p style={{ ...s.label, marginTop: 14 }}>How to fix</p>
              <div style={s.hint}>🔧 {finding.hint}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
