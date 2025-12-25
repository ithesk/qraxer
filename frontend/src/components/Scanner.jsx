import { useState, useEffect, useRef } from 'react';
import QrScanner from 'qr-scanner';
import { api } from '../services/api';
import { toast } from './Toast';
import RecentScans from './RecentScans';
import { scanHistory } from '../services/scanHistory';

const CameraIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const AlertIcon = () => (
  <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default function Scanner({ onScan }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [showFlash, setShowFlash] = useState(false);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

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
    if (scanning && videoRef.current && !scannerRef.current) {
      // Pequeño delay para asegurar que el video esté montado
      const timer = setTimeout(() => {
        initScanner();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [scanning]);

  const initScanner = async () => {
    if (!videoRef.current) return;

    try {
      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        setError('No se detectó ninguna cámara en el dispositivo.');
        setScanning(false);
        return;
      }

      // Configurar atributos del video para iOS
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.muted = true;
      videoRef.current.autoplay = true;

      scannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          const data = result.data ?? result;
          handleQrSuccess(data);
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 12,
          inversionMode: 'original',
          calculateScanRegion: (video) => {
            const vw = video.videoWidth;
            const vh = video.videoHeight;

            // Área de escaneo más grande para mejor detección
            const width = Math.round(vw * 0.70);
            const height = Math.round(vh * 0.50);

            const x = Math.round((vw - width) / 2);
            const y = Math.round((vh - height) / 2);

            return {
              x,
              y,
              width,
              height,
              downScaledWidth: 640,
              downScaledHeight: 480
            };
          }
        }
      );

      // Establecer cámara trasera
      await scannerRef.current.setCamera('environment');
      await scannerRef.current.start();

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
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      } catch (e) {
        // Ignore stop errors
      }
      scannerRef.current = null;
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
    console.log('[Scanner] QR detectado:', decodedText);

    // Flash verde visual + vibración (feedback inmediato < 300ms)
    setShowFlash(true);
    vibrate(30);
    setTimeout(() => setShowFlash(false), 150);

    stopScanner();
    setLoading(true);
    setError('');

    try {
      console.log('[Scanner] Llamando API scanQR...');
      const data = await api.scanQR(decodedText);
      console.log('[Scanner] API respondió:', data);

      // Guardar en historial de escaneos
      console.log('[Scanner] Guardando en historial:', data.repair);
      scanHistory.addScan({
        repairId: data.repair.id,
        repairName: data.repair.name,
        currentState: data.repair.currentState,
      });
      console.log('[Scanner] Historial guardado');

      // Vibración de éxito
      vibrate(100);
      onScan(data, decodedText);
    } catch (err) {
      console.error('[Scanner] Error:', err.message);
      // Vibración de error (más larga)
      vibrate([200, 100, 200]);
      setError(err.message);
      toast.error(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100vh - 140px)'
    }}>
      {/* Flash verde al detectar QR */}
      {showFlash && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(34, 197, 94, 0.3)',
          zIndex: 9999,
          pointerEvents: 'none'
        }} />
      )}

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
            aria-label="Iniciar escáner"
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

            {/* Recent Scans in idle state */}
            <RecentScans />
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card" style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Camera container - aspect ratio 4:3 */}
              <div style={{
                width: '100%',
                aspectRatio: '4/3',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                background: '#000',
                position: 'relative'
              }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                />
              </div>

              {/* Recent Scans above instructions */}
              <RecentScans />

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

    </div>
  );
}
