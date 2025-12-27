import { useState, useEffect } from 'react';
import { scanHistory } from '../services/scanHistory';

const STATE_LABELS = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  under_repair: 'En reparación',
  ready: 'Listo',
  done: 'Reparado',
  cancel: 'Cancelado',
  '2binvoiced': 'Por facturar',
  test: 'Prueba',
  handover: 'Entregado',
  guarantee: 'Garantía',
};

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export default function RecentScans({ refreshKey = 0 }) {
  const [scans, setScans] = useState(() => scanHistory.getScans());

  useEffect(() => {
    setScans(scanHistory.getScans());
  }, [refreshKey]);

  if (scans.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{
        fontSize: '14px',
        fontWeight: '600',
        color: 'var(--text-secondary)',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <ClockIcon />
        Ultimos 3
      </h3>

      <div style={{
        background: 'var(--card-bg)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        overflow: 'hidden'
      }}>
        {scans.map((scan, index) => (
          <div
            key={`${scan.repairId}-${scan.timestamp}`}
            style={{
              padding: '12px 16px',
              borderBottom: index < scans.length - 1 ? '1px solid var(--border-light)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {scan.repairName}
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '2px'
              }}>
                {scanHistory.formatTime(scan.timestamp)}
              </div>
            </div>

            <span className={`state-badge state-${scan.currentState}`} style={{
              fontSize: '11px',
              padding: '4px 10px',
              flexShrink: 0
            }}>
              {STATE_LABELS[scan.currentState] || scan.currentState}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
