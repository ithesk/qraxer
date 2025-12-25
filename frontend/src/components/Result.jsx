import { useEffect, useState } from 'react';
import { scanHistory } from '../services/scanHistory';
import RecentScans from './RecentScans';
import { toast } from './Toast';

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

const SuccessIcon = () => (
  <svg
    width="80"
    height="80"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--success)"
    strokeWidth="2"
    className="success-icon"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" strokeWidth="2.5" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const CameraIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export default function Result({ result, onNewScan }) {
  const [refreshKey, setRefreshKey] = useState(0);

  // Save scan to history on mount
  useEffect(() => {
    console.log('[Result] useEffect, result:', result);
    if (result) {
      console.log('[Result] Saving scan to history...');
      scanHistory.addScan({
        repairId: result.repairId,
        repairName: result.repairName,
        oldState: result.oldState,
        newState: result.newState,
      });
      // Trigger refresh of RecentScans
      console.log('[Result] Triggering refreshKey update');
      setRefreshKey(prev => prev + 1);
      // Show success toast
      toast.success(`Reparación #${result.repairId} actualizada`);
    }
  }, [result]);

  return (
    <div className="fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100vh - 140px)'
    }}>
      {/* Success Card */}
      <div className="card" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 24px'
      }}>
        {/* Success Icon */}
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: '#f0fdf4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px'
        }}>
          <SuccessIcon />
        </div>

        {/* Success Message */}
        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: 'var(--text)',
          marginBottom: '8px'
        }}>
          Actualizado
        </h2>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '15px',
          marginBottom: '32px'
        }}>
          El estado se cambió correctamente
        </p>

        {/* State Transition */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '24px'
        }}>
          <span className={`state-badge state-${result.oldState}`}>
            {STATE_LABELS[result.oldState] || result.oldState}
          </span>

          <div style={{ color: 'var(--text-muted)' }}>
            <ArrowRightIcon />
          </div>

          <span className={`state-badge state-${result.newState}`}>
            {STATE_LABELS[result.newState] || result.newState}
          </span>
        </div>

        {/* Repair ID */}
        <p style={{
          fontSize: '13px',
          color: 'var(--text-muted)',
          background: 'var(--border-light)',
          padding: '8px 16px',
          borderRadius: 'var(--radius-full)'
        }}>
          Reparación #{result.repairId}
        </p>
      </div>

      {/* Recent Scans */}
      <RecentScans refreshKey={refreshKey} />

      {/* Action Button */}
      <div className="bottom-actions" style={{ marginTop: '20px' }}>
        <button
          onClick={onNewScan}
          className="btn-primary btn-large"
          autoFocus
        >
          <CameraIcon />
          <span>Escanear otro QR</span>
        </button>
      </div>
    </div>
  );
}
