import React, { useState } from 'react';
import { startScan } from '../utils/api';

const styles = {
  wrapper: {
    background: '#1a1d2e',
    border: '1px solid #2d3148',
    borderRadius: 12,
    padding: '28px 32px',
    marginBottom: 32,
  },
  heading: {
    fontSize: 13, fontWeight: 600, color: '#8892a4',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16,
  },
  tabs: {
    display: 'flex', gap: 8, marginBottom: 16,
  },
  tab: {
    fontSize: 12, fontWeight: 600, padding: '6px 14px',
    borderRadius: 6, cursor: 'pointer', border: '1px solid #2d3148',
    transition: 'all 0.2s',
  },
  row: { display: 'flex', gap: 12, alignItems: 'stretch' },
  input: {
    flex: 1, background: '#0f1117', border: '1px solid #2d3148',
    borderRadius: 8, padding: '12px 16px', color: '#e2e8f0',
    fontSize: 14, fontFamily: 'monospace', outline: 'none',
  },
  btn: {
    background: '#7c6fcd', color: '#fff', border: 'none',
    borderRadius: 8, padding: '12px 24px', fontSize: 14,
    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  hint: { fontSize: 12, color: '#4a5568', marginTop: 10 },
  error: {
    marginTop: 10, padding: '10px 14px',
    background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)',
    borderRadius: 6, color: '#ff4757', fontSize: 13,
  },
  exampleBox: {
    marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap',
  },
  exampleBtn: {
    fontSize: 11, color: '#7c6fcd', background: 'rgba(124,111,205,0.08)',
    border: '1px solid rgba(124,111,205,0.2)', borderRadius: 4,
    padding: '4px 10px', cursor: 'pointer',
  },
};

const EXAMPLES = [
  'https://github.com/mathworks/MATLAB-Simulink-Challenge-Project-Hub',
  'https://github.com/facebook/react',
  'https://github.com/torvalds/linux',
];

export default function ScanForm({ onScanStarted }) {
  const [mode, setMode]       = useState('github'); // 'github' | 'local'
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleScan() {
    if (!input.trim()) {
      setError('Please enter a value');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload = mode === 'github'
        ? { githubUrl: input.trim() }
        : { repoPath: input.trim() };

      const { data } = await startScan(payload);
      onScanStarted(data.scanId);
      setInput('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start scan. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleScan();
  }

  return (
    <div style={styles.wrapper}>
      <p style={styles.heading}>Scan a repository</p>

      {/* Mode tabs */}
      <div style={styles.tabs}>
        {[
          { key: 'github', label: '🌐 GitHub URL' },
          { key: 'local',  label: '💻 Local Path' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setMode(key); setInput(''); setError(''); }}
            style={{
              ...styles.tab,
              background: mode === key ? '#7c6fcd' : '#0f1117',
              color:      mode === key ? '#fff'    : '#8892a4',
              borderColor: mode === key ? '#7c6fcd' : '#2d3148',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div style={styles.row}>
        <input
          style={styles.input}
          type="text"
          placeholder={
            mode === 'github'
              ? 'https://github.com/username/repo'
              : 'C:\\Users\\you\\projects\\my-repo'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onFocus={(e) => (e.target.style.borderColor = '#7c6fcd')}
          onBlur={(e)  => (e.target.style.borderColor = '#2d3148')}
        />
        <button
          style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
          onClick={handleScan}
          disabled={loading}
        >
          {loading ? 'Starting…' : 'Scan repo'}
        </button>
      </div>

      {/* Hint */}
      <p style={styles.hint}>
        {mode === 'github'
          ? 'Paste any public GitHub repo URL. The server clones it, scans the history, then deletes it.'
          : 'Paste the absolute path to a local git repository on your PC.'}
      </p>

      {/* Quick examples for GitHub mode */}
      {mode === 'github' && (
        <div style={styles.exampleBox}>
          <span style={{ fontSize: 11, color: '#4a5568', alignSelf: 'center' }}>Try:</span>
          {EXAMPLES.map((url) => (
            <button
              key={url}
              style={styles.exampleBtn}
              onClick={() => setInput(url)}
            >
              {url.split('/').slice(-2).join('/')}
            </button>
          ))}
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}
