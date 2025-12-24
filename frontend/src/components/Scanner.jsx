import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../services/api';

const CameraIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const AlertIcon = () => (
  <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default function Scanner({ onScan, onLogout }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const html5QrcodeRef = useRef(null);

  // Verificar permisos de cámara al montar
  useEffect(() => {
    checkCameraPermission();
    return () => {
      stopScanner();
    };
  }, []);

  const checkCameraPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      setHasPermission(result.state === 'granted');

      // Auto-iniciar si ya tiene permiso y el usuario lo usó antes
      if (result.state === 'granted' && localStorage.getItem('autoStartScanner') === 'true') {
        setScanning(true);
      }

      // Escuchar cambios en el permiso
      result.onchange = () => {
        setHasPermission(result.state === 'granted');
      };
    } catch (e) {
      // Permissions API no soportada
      setHasPermission(null);
    }
  };

  // Iniciar scanner después de que el elemento esté en el DOM
  useEffect(() => {
    if (scanning && !html5QrcodeRef.current) {
      initScanner();
    }
  }, [scanning]);

  const initScanner = async () => {
    try {
      html5QrcodeRef.current = new Html5Qrcode('qr-reader');

      await html5QrcodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleQrSuccess,
        () => {}
      );

      // Guardar que el scanner se inició exitosamente
      localStorage.setItem('autoStartScanner', 'true');
      setHasPermission(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
      setScanning(false);
      localStorage.removeItem('autoStartScanner');
    }
  };

  const startScanner = () => {
    setError('');
    setScanning(true);
    // initScanner será llamado por el useEffect cuando el DOM esté listo
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
      } catch (e) {
        // Ignore stop errors
      }
      html5QrcodeRef.current = null;
    }
    setScanning(false);
  };

  // Vibración para feedback táctil
  const vibrate = (pattern) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const handleQrSuccess = async (decodedText) => {
    // Vibración corta al detectar QR
    vibrate([50, 30, 50]);

    await stopScanner();
    setLoading(true);
    setError('');

    try {
      const data = await api.scanQR(decodedText);
      // Vibración de éxito
      vibrate([100]);
      onScan(data, decodedText);
    } catch (err) {
      // Vibración de error (más larga)
      vibrate([200, 100, 200]);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100vh - 140px)'
    }}>
      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}

      {/* Main Scanner Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!scanning && !loading ? (
          /* Idle State - Big Scan Button */
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px'
          }}>
            <div style={{
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(37, 99, 235, 0.4)',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              color: 'white'
            }}
            onClick={startScanner}
            role="button"
            tabIndex={0}
            aria-label="Iniciar escaner"
            onKeyDown={(e) => e.key === 'Enter' && startScanner()}
            >
              <CameraIcon />
            </div>

            <h2 style={{
              marginTop: '24px',
              fontSize: '22px',
              fontWeight: '600',
              color: 'var(--text)'
            }}>
              Escanear QR
            </h2>

            <p style={{
              marginTop: '8px',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              fontSize: '15px'
            }}>
              Toca el botón para abrir la cámara
            </p>
          </div>
        ) : loading ? (
          /* Loading State */
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div className="spinner spinner-dark" style={{ width: '32px', height: '32px' }} />
            </div>
            <p style={{
              marginTop: '20px',
              fontSize: '17px',
              fontWeight: '500',
              color: 'var(--text)'
            }}>
              Procesando QR...
            </p>
            <p style={{
              marginTop: '8px',
              color: 'var(--text-muted)',
              fontSize: '14px'
            }}>
              Obteniendo información
            </p>
          </div>
        ) : (
          /* Scanning State */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card" style={{
              padding: '16px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div
                id="qr-reader"
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: '300px',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  background: '#000'
                }}
              />

              <p style={{
                textAlign: 'center',
                marginTop: '16px',
                color: 'var(--text-secondary)',
                fontSize: '14px'
              }}>
                Apunta la cámara al código QR
              </p>

              <button
                onClick={stopScanner}
                className="btn-secondary btn-large"
                style={{ marginTop: '16px' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logout Button - Always at bottom */}
      <div className="bottom-actions" style={{ marginTop: '20px' }}>
        <button
          onClick={onLogout}
          className="btn-ghost"
          style={{
            width: '100%',
            color: 'var(--text-muted)'
          }}
        >
          <LogoutIcon />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}
