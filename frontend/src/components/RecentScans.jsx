import { scanHistory } from '../services/scanHistory';

const STATE_LABELS = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  under_repair: 'En reparación',
  ready: 'Listo',
  done: 'Hecho',
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

const ArrowIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export default function RecentScans() {
  const scans = scanHistory.getScans();

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
        Últimos escaneos
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
                #{scan.repairId}
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '2px'
              }}>
                {scanHistory.formatTime(scan.timestamp)}
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}>
              <span style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--border-light)',
                color: 'var(--text-secondary)'
              }}>
                {STATE_LABELS[scan.oldState] || scan.oldState}
              </span>

              <span style={{ color: 'var(--text-muted)' }}>
                <ArrowIcon />
              </span>

              <span style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                background: '#dcfce7',
                color: '#15803d',
                fontWeight: '500'
              }}>
                {STATE_LABELS[scan.newState] || scan.newState}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
