import React, { useEffect, useState } from 'react';
import { getResult } from '../utils/api';

export default function ScanProgress({ scanId, onComplete }) {
  const [dots, setDots] = useState('');

  // Animate the dots
  useEffect(() => {
    const t = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => clearInterval(t);
  }, []);

  // Poll the backend every 2 seconds
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const { data } = await getResult(scanId);
        if (data.status === 'done' || data.status === 'error') {
          clearInterval(poll);
          onComplete(data);
        }
      } catch {
        // ignore network blips during polling
      }
    }, 2000);

    return () => clearInterval(poll);
  }, [scanId, onComplete]);

  return (
    <div style={{
      background: '#1a1d2e',
      border: '1px solid #2d3148',
      borderRadius: 12,
      padding: '40px 32px',
      textAlign: 'center',
      marginBottom: 24,
    }}>
      {/* Spinner */}
      <div style={{
        width: 48, height: 48, margin: '0 auto 20px',
        border: '3px solid #2d3148',
        borderTop: '3px solid #7c6fcd',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <p style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>
        Scanning git history{dots}
      </p>
      <p style={{ fontSize: 13, color: '#8892a4' }}>
        Walking every commit — this may take a minute for large repos
      </p>
    </div>
  );
}
