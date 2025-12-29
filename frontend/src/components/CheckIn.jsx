import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { toast } from './Toast';
import haptics from '../services/haptics';
import { isNativePlatform, scanOnce } from '../services/nativeScanner';

// Icons
const ScanIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <line x1="7" y1="12" x2="17" y2="12" />
  </svg>
);

const BellIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const CheckIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const UserIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ClockIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

export default function CheckIn() {
  const [view, setView] = useState('idle'); // idle | scanning | result | notifications
  const [loading, setLoading] = useState(false);
  const [checkinResult, setCheckinResult] = useState(null);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [responding, setResponding] = useState(null);

  const isNative = isNativePlatform();
  const videoRef = useRef(null);
  const readerRef = useRef(null);

  // Polling para notificaciones (cada 10 segundos)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await api.getPendingCheckins();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const startScanner = async () => {
    setError('');
    setView('scanning');

    if (isNative) {
      try {
        const code = await scanOnce();
        if (code) {
          await handleScan(code);
        } else {
          setView('idle');
        }
      } catch (err) {
        console.error('Native scan error:', err);
        setError(err.message || 'Error al escanear');
        setView('idle');
      }
    } else {
      initWebScanner();
    }
  };

  const initWebScanner = async () => {
    const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } = await import('@zxing/library');

    if (!videoRef.current) return;

    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
      ]);

      readerRef.current = new BrowserMultiFormatReader(hints);

      await readerRef.current.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        (result) => {
          if (result) {
            handleScan(result.getText());
          }
        }
      );
    } catch (err) {
      console.error('Camera error:', err);
      setError('No se pudo acceder a la cámara.');
      setView('idle');
    }
  };

  const stopScanner = () => {
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (e) {}
      readerRef.current = null;
    }
  };

  const handleScan = async (qrContent) => {
    haptics.impact();
    stopScanner();
    setLoading(true);
    setView('idle');

    try {
      const data = await api.checkin(qrContent);
      haptics.success();
      setCheckinResult(data);
      setView('result');
      toast.success('Check-in registrado');
      // Refrescar notificaciones
      fetchNotifications();
    } catch (err) {
      haptics.error();
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
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

  const handleNewCheckin = () => {
    setCheckinResult(null);
    setError('');
    setView('idle');
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
  };

  // Loading state
  if (loading) {
    return (
      <div className="fade-in" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
      }}>
        <div className="spinner spinner-dark" style={{ width: '32px', height: '32px' }} />
        <p style={{ marginTop: '16px', fontSize: '15px', color: 'var(--text-muted)' }}>
          Registrando check-in...
        </p>
      </div>
    );
  }

  // Scanner web view
  if (view === 'scanning' && !isNative) {
    return (
      <div className="fade-in">
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid var(--border-light)',
        }}>
          <div style={{
            width: '100%',
            aspectRatio: '4/3',
            borderRadius: '12px',
            overflow: 'hidden',
            background: '#000',
          }}>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <button
            onClick={() => { stopScanner(); setView('idle'); }}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '14px',
              background: 'var(--bg)',
              color: 'var(--text)',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // Result view
  if (view === 'result' && checkinResult) {
    return (
      <div className="fade-in">
        {/* Success card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-light)',
          textAlign: 'center',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 16px',
            background: '#dcfce7',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#16a34a',
          }}>
            <CheckIcon size={32} />
          </div>

          <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>
            Check-in Registrado
          </h3>

          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            El técnico ha sido notificado
          </p>

          {/* Repair info */}
          <div style={{
            background: 'var(--bg)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'left',
          }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Reparación
              </div>
              <div style={{ fontSize: '16px', fontWeight: '600', fontFamily: 'monospace' }}>
                {checkinResult.repair?.name}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Cliente
              </div>
              <div style={{ fontSize: '15px', fontWeight: '500' }}>
                {checkinResult.repair?.partner || 'N/A'}
              </div>
            </div>

            {checkinResult.repair?.technician && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Técnico asignado
                </div>
                <div style={{ fontSize: '15px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserIcon size={16} />
                  {checkinResult.repair.technician.name}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleNewCheckin}
          style={{
            width: '100%',
            marginTop: '16px',
            padding: '16px',
            background: 'var(--text)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <ScanIcon size={18} />
          Otro Check-in
        </button>
      </div>
    );
  }

  // Main view (idle + notifications)
  return (
    <div className="fade-in">
      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          marginBottom: '16px',
          fontSize: '14px',
          color: '#dc2626',
        }}>
          {error}
        </div>
      )}

      {/* Scan card */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px 24px',
        border: '1px solid var(--border-light)',
        textAlign: 'center',
        marginBottom: '20px',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 16px',
          background: '#fef3c7',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#d97706',
        }}>
          <BellIcon size={32} />
        </div>

        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>
          Check-in Cliente
        </h3>

        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Escanea el QR cuando el cliente llegue a recoger
        </p>

        <button
          onClick={startScanner}
          style={{
            background: 'var(--text)',
            color: 'white',
            padding: '14px 32px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <ScanIcon size={18} />
          Escanear
        </button>
      </div>

      {/* Notifications section */}
      {notifications.length > 0 && (
        <div>
          <h4 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <BellIcon size={18} />
            Clientes esperando ({notifications.length})
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notifications.map((notif) => (
              <div
                key={notif.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid var(--border-light)',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600' }}>
                      {notif.clientName}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {notif.repairCode}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ClockIcon size={14} />
                    {formatTime(notif.timestamp)}
                  </div>
                </div>

                {/* Response or buttons */}
                {notif.response ? (
                  <div style={{
                    background: '#dcfce7',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '14px',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <CheckIcon size={16} />
                    {notif.response.message}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleResponse(notif.id, 'coming')}
                      disabled={responding === notif.id}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        opacity: responding === notif.id ? 0.5 : 1,
                      }}
                    >
                      Voy de camino
                    </button>
                    <button
                      onClick={() => handleResponse(notif.id, 'ready')}
                      disabled={responding === notif.id}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        background: '#dcfce7',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
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
                        padding: '10px 8px',
                        background: '#fef3c7',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
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

      {/* Empty state when no notifications */}
      {notifications.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}>
          No hay clientes esperando
        </div>
      )}
    </div>
  );
}
