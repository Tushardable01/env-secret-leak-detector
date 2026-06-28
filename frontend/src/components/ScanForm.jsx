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
    fontSize: 13,
    fontWeight: 600,
    color: '#8892a4',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  row: {
    display: 'flex',
    gap: 12,
    alignItems: 'stretch',
  },
  input: {
    flex: 1,
    background: '#0f1117',
    border: '1px solid #2d3148',
    borderRadius: 8,
    padding: '12px 16px',
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: 'monospace',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  btn: {
    background: '#7c6fcd',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.2s',
  },
  hint: {
    fontSize: 12,
    color: '#4a5568',
    marginTop: 10,
  },
  error: {
    marginTop: 10,
    padding: '10px 14px',
    background: 'rgba(255,71,87,0.1)',
    border: '1px solid rgba(255,71,87,0.3)',
    borderRadius: 6,
    color: '#ff4757',
    fontSize: 13,
  },
};

export default function ScanForm({ onScanStarted }) {
  const [repoPath, setRepoPath] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleScan() {
    if (!repoPath.trim()) {
      setError('Please enter a repository path');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await startScan(repoPath.trim());
      onScanStarted(data.scanId);
      setRepoPath('');
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
      <div style={styles.row}>
        <input
          style={styles.input}
          type="text"
          placeholder="/Users/tushar/projects/my-repo  or  C:\Users\tushar\projects\my-repo"
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
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
      <p style={styles.hint}>
        Paste the absolute path to any local git repository. The scanner reads git history only — no files are uploaded.
      </p>
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}
