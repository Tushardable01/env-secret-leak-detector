import React, { useState } from 'react';
import ScanForm from './components/ScanForm';
import ScanProgress from './components/ScanProgress';
import ReportView from './components/ReportView';

export default function App() {
  const [state,  setState]  = useState('idle');
  const [scanId, setScanId] = useState(null);
  const [result, setResult] = useState(null);

  function handleScanStarted(id) { setScanId(id); setState('scanning'); }
  function handleScanComplete(data) { setResult(data); setState('done'); }
  function handleNewScan() { setState('idle'); setScanId(null); setResult(null); }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117' }}>

      {/* ── Navbar ── */}
      <nav style={{
        borderBottom: '1px solid #1e2235', padding: '0 32px',
        height: 56, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>🔍</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
          Env Leak Detector
        </span>
        <span style={{
          fontSize: 11, color: '#4a5568', fontWeight: 500,
          background: '#1a1d2e', border: '1px solid #2d3148',
          borderRadius: 4, padding: '2px 8px', marginLeft: 4,
        }}>
          v1.0
        </span>

        {/* Author — right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#4a5568' }}>Built by</span>
          <a
            href="https://github.com/Tushardable01"
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 12, fontWeight: 600, color: '#7c6fcd',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            Tushar Dable
          </a>
        </div>
      </nav>

      {/* ── Main ── */}
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>

        {/* Hero */}
        {state === 'idle' && (
          <div style={{ marginBottom: 36 }}>
            <h1 style={{
              fontSize: 32, fontWeight: 800, color: '#e2e8f0',
              letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.2,
            }}>
              Find secrets leaked in{' '}
              <span style={{ color: '#7c6fcd' }}>git history</span>
            </h1>
            <p style={{ fontSize: 15, color: '#8892a4', lineHeight: 1.6, maxWidth: 560 }}>
              Scans every commit — including ones where secrets were later deleted.
              Finds API keys, passwords, tokens, and connection strings before attackers do.
            </p>
          </div>
        )}

        {state === 'idle'     && <ScanForm onScanStarted={handleScanStarted} />}
        {state === 'scanning' && <ScanProgress scanId={scanId} onComplete={handleScanComplete} />}
        {state === 'done' && result && <ReportView result={result} onNewScan={handleNewScan} />}

        {/* What it detects */}
        {state === 'idle' && (
          <div style={{
            background: '#1a1d2e', border: '1px solid #2d3148',
            borderRadius: 12, padding: '24px 28px',
          }}>
            <p style={{
              fontSize: 13, fontWeight: 600, color: '#8892a4',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18,
            }}>
              What it detects
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px 24px' }}>
              {[
                'AWS Access & Secret Keys', 'GitHub / GitLab Tokens',
                'Stripe & Razorpay Keys',   'Google API Keys',
                'MongoDB / PostgreSQL URLs', 'JWT Secrets',
                'Slack & Twilio Tokens',     'SendGrid / Mailgun Keys',
                'SSH Private Keys',          'Hardcoded Passwords',
                'Azure Connection Strings',  '.env files committed',
              ].map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#7c6fcd', fontSize: 14 }}>▸</span>
                  <span style={{ fontSize: 13, color: '#a8b2c3' }}>{item}</span>
                </div>
              ))}
            </div>

            {/* Footer credit */}
            <div style={{
              marginTop: 24, paddingTop: 16, borderTop: '1px solid #2d3148',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 12, color: '#4a5568' }}>
                Made with ❤️ by
              </span>
              <a
                href="https://github.com/Tushardable01"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, fontWeight: 600, color: '#7c6fcd', textDecoration: 'none' }}
              >
                Tushar Dable
              </a>
              <span style={{ fontSize: 12, color: '#4a5568' }}>
                · github.com/Tushardable01
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
