import React, { useState } from 'react';
import SeverityChart from './SeverityChart';
import FindingCard from './FindingCard';
import SeverityBadge from './SeverityBadge';

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function ReportView({ result, onNewScan }) {
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');

  if (result.status === 'error') {
    return (
      <div style={{
        background: 'rgba(255,71,87,0.08)',
        border: '1px solid rgba(255,71,87,0.3)',
        borderRadius: 12,
        padding: '28px 32px',
      }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#ff4757', marginBottom: 8 }}>
          Scan failed
        </p>
        <p style={{ fontSize: 13, color: '#a8b2c3' }}>{result.errorMessage}</p>
        <button
          onClick={onNewScan}
          style={{
            marginTop: 20, background: '#7c6fcd', color: '#fff',
            border: 'none', borderRadius: 8, padding: '10px 20px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  const summary = result.summary || { critical: 0, high: 0, medium: 0, low: 0 };
  const findings = [...(result.findings || [])].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  // Apply filter + search
  const visible = findings.filter((f) => {
    const matchFilter = filter === 'all' || f.severity === filter;
    const matchSearch = !search || f.type.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const cleanPath = result.repoPath || '';
  const repoName  = result.repoName || cleanPath.split(/[/\\]/).pop();

  return (
    <div>
      {/* Header */}
      <div style={{
        background: '#1a1d2e', border: '1px solid #2d3148',
        borderRadius: 12, padding: '24px 28px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 11, color: '#4a5568', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Scan complete
            </p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
              {repoName}
            </p>
            <p style={{ fontSize: 12, color: '#4a5568', fontFamily: 'monospace' }}>{cleanPath}</p>
          </div>
          <button
            onClick={onNewScan}
            style={{
              background: 'transparent', color: '#8892a4',
              border: '1px solid #2d3148', borderRadius: 8,
              padding: '8px 16px', fontSize: 13, cursor: 'pointer',
            }}
          >
            New scan
          </button>
        </div>

        {/* Stat row */}
        <div style={{ display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Commits scanned',  value: result.totalCommitsScanned ?? '—' },
            { label: 'Total findings',    value: findings.length },
            { label: 'Critical',          value: summary.critical, color: '#ff4757' },
            { label: 'High',              value: summary.high,     color: '#ff6b35' },
            { label: 'Medium',            value: summary.medium,   color: '#ffa502' },
            { label: 'Low',               value: summary.low,      color: '#2ed573' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p style={{ fontSize: 11, color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                {label}
              </p>
              <p style={{ fontSize: 24, fontWeight: 700, color: color || '#e2e8f0' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {findings.length === 0 ? (
        <div style={{
          background: 'rgba(46,213,115,0.06)',
          border: '1px solid rgba(46,213,115,0.2)',
          borderRadius: 12, padding: '40px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>✅</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#2ed573', marginBottom: 8 }}>
            No secrets found
          </p>
          <p style={{ fontSize: 13, color: '#8892a4' }}>
            Scanned {result.totalCommitsScanned} commits — clean history
          </p>
        </div>
      ) : (
        <>
          <SeverityChart summary={summary} />

          {/* Filter bar */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center',
          }}>
            {['all', 'critical', 'high', 'medium', 'low'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  background: filter === s ? '#7c6fcd' : '#1a1d2e',
                  color: filter === s ? '#fff' : '#8892a4',
                  border: `1px solid ${filter === s ? '#7c6fcd' : '#2d3148'}`,
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {s === 'all' ? `All (${findings.length})` : (
                  <>
                    {s} ({summary[s] ?? 0})
                  </>
                )}
              </button>
            ))}

            <input
              placeholder="Search by type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                marginLeft: 'auto',
                background: '#1a1d2e',
                border: '1px solid #2d3148',
                borderRadius: 6,
                padding: '6px 12px',
                color: '#e2e8f0',
                fontSize: 13,
                outline: 'none',
                width: 180,
              }}
            />
          </div>

          {/* Findings list */}
          {visible.length === 0 ? (
            <p style={{ color: '#4a5568', fontSize: 14, textAlign: 'center', padding: 32 }}>
              No findings match your filter
            </p>
          ) : (
            visible.map((f, i) => <FindingCard key={i} finding={f} />)
          )}
        </>
      )}
    </div>
  );
}
