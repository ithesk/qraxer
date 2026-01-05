// Compact Check-in bar for Scanner page
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from './Toast';
import haptics from '../services/haptics';
import { isNativePlatform, scanOnce } from '../services/nativeScanner';

const BellIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const ScanIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
  </svg>
);

const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CloseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function CheckInBar() {
  const [notifications, setNotifications] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [responding, setResponding] = useState(null);

  const isNative = isNativePlatform();

  // Polling for notifications
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    console.log('[CheckIn] Fetching notifications...');
    try {
      const data = await api.getPendingCheckins();
      console.log('[CheckIn] Notifications received:', data);
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('[CheckIn] Error fetching notifications:', err.message, err);
    }
  };

  const startCheckin = async () => {
    console.log('[CheckIn] Starting check-in scan...');
    haptics.impact();
    setLoading(true);

    try {
      if (isNative) {
        console.log('[CheckIn] Using native scanner');
        const code = await scanOnce();
        console.log('[CheckIn] Scanned code:', code);
        if (code) {
          await doCheckin(code);
        }
      } else {
        // For web, just show a simple prompt (or could open a modal)
        const code = prompt('Ingresa el código de la reparación:');
        console.log('[CheckIn] Manual code entered:', code);
        if (code) {
          await doCheckin(code);
        }
      }
    } catch (err) {
      console.error('[CheckIn] Scan error:', err.message, err);
      if (!err.message?.includes('cancel')) {
        toast.error(err.message || 'Error al escanear');
      }
    } finally {
      setLoading(false);
    }
  };

  const doCheckin = async (qrContent) => {
    console.log('[CheckIn] Registering check-in for:', qrContent);
    try {
      const result = await api.checkin(qrContent);
      console.log('[CheckIn] Check-in registered:', result);
      haptics.success();
      toast.success('Check-in registrado');
      fetchNotifications();
    } catch (err) {
      console.error('[CheckIn] Check-in error:', err.message, err);
      haptics.error();
      toast.error(err.message);
    }
  };

  const handleResponse = async (checkinId, responseType) => {
    setResponding(checkinId);
    try {
      await api.respondToCheckin(checkinId, responseType);
      haptics.success();
      toast.success('Respuesta enviada');
      fetchNotifications();
    } catch (err) {
      haptics.error();
      toast.error(err.message);
    } finally {
      setResponding(null);
    }
  };

  const formatTime = (timestamp) => {
    try {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        console.warn('[CheckIn] Invalid timestamp:', timestamp);
        return '';
      }
      // Simple format to avoid locale issues
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (err) {
      console.error('[CheckIn] formatTime error:', err.message);
      return '';
    }
  };

  const pendingCount = notifications.filter(n => !n.response).length;

  return (
    <>
      {/* Compact bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
      }}>
        {/* Check-in button - Minimal enterprise style */}
        <button
          onClick={startCheckin}
          disabled={loading}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--text)',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
          ) : (
            <>
              <BellIcon size={18} />
              Check-in Cliente
            </>
          )}
        </button>

        {/* Notifications badge/button */}
        {pendingCount > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              position: 'relative',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: expanded ? 'var(--text)' : 'white',
              border: expanded ? 'none' : '1px solid var(--border)',
              borderRadius: '12px',
              cursor: 'pointer',
              color: expanded ? 'white' : 'var(--text)',
            }}
          >
            <BellIcon size={20} />
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              width: '20px',
              height: '20px',
              background: 'var(--text)',
              color: 'white',
              borderRadius: '50%',
              fontSize: '11px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {pendingCount}
            </span>
          </button>
        )}
      </div>

      {/* Expanded notifications panel */}
      {expanded && notifications.length > 0 && (
        <div style={{
          background: 'white',
          borderRadius: '16px',
          marginBottom: '16px',
          border: '1px solid var(--border-light)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-light)',
            background: 'var(--bg)',
          }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
              Clientes esperando
            </span>
            <button
              onClick={() => setExpanded(false)}
              style={{
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              <CloseIcon size={16} />
            </button>
          </div>

          {/* Notifications list */}
          <div style={{ maxHeight: '280px', overflow: 'auto' }}>
            {notifications.map((notif, idx) => (
              <div
                key={notif.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: idx < notifications.length - 1 ? '1px solid var(--border-light)' : 'none',
                }}
              >
                {/* Info row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>
                      {notif.clientName}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {notif.repairCode}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {formatTime(notif.timestamp)}
                  </div>
                </div>

                {/* Response or buttons */}
                {notif.response ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    background: '#dcfce7',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#166534',
                  }}>
                    <CheckIcon />
                    {notif.response.message}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleResponse(notif.id, 'coming')}
                      disabled={responding === notif.id}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        opacity: responding === notif.id ? 0.5 : 1,
                      }}
                    >
                      Voy
                    </button>
                    <button
                      onClick={() => handleResponse(notif.id, 'ready')}
                      disabled={responding === notif.id}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: '#dcfce7',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#166534',
                        cursor: 'pointer',
                        opacity: responding === notif.id ? 0.5 : 1,
                      }}
                    >
                      Listo
                    </button>
                    <button
                      onClick={() => handleResponse(notif.id, 'need_time')}
                      disabled={responding === notif.id}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: '#fef3c7',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '500',
                        color: '#92400e',
                        cursor: 'pointer',
                        opacity: responding === notif.id ? 0.5 : 1,
                      }}
                    >
                      10 min
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
