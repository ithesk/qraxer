import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const WifiIcon = ({ connected }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {connected ? (
      <>
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" fill="currentColor" />
      </>
    ) : (
      <>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle cx="12" cy="20" r="1" fill="currentColor" />
      </>
    )}
  </svg>
);

export default function ConnectionIndicator() {
  const [status, setStatus] = useState({ online: null, latency: 0 });
  const [checking, setChecking] = useState(false);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    const result = await api.checkConnection();
    setStatus(result);
    setChecking(false);
  }, []);

  useEffect(() => {
    // Check immediately
    checkConnection();

    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    // Also check when coming back online
    const handleOnline = () => checkConnection();
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleOnline);
    };
  }, [checkConnection]);

  const getStatusColor = () => {
    if (status.online === null) return 'var(--text-muted)';
    return status.online ? 'var(--success)' : 'var(--error)';
  };

  const getStatusText = () => {
    if (checking) return 'Verificando...';
    if (status.online === null) return 'Sin verificar';
    if (status.online) return `Conectado (${status.latency}ms)`;
    return 'Sin conexión';
  };

  return (
    <div
      onClick={checkConnection}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && checkConnection()}
      aria-label={`Estado de conexión: ${getStatusText()}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: 'var(--radius-full)',
        background: status.online === false ? '#fef2f2' : '#f0fdf4',
        color: getStatusColor(),
        fontSize: '12px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        opacity: checking ? 0.7 : 1,
      }}
    >
      <WifiIcon connected={status.online !== false} />
      <span>{getStatusText()}</span>
      {status.online === false && (
        <span style={{ fontSize: '10px', opacity: 0.8 }}>Toca para reintentar</span>
      )}
    </div>
  );
}
