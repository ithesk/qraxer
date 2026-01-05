import { useState, useEffect, useRef } from 'react';
import QrScanner from 'qr-scanner';
import { api } from '../services/api';
import { toast } from './Toast';
import RecentScans from './RecentScans';
import History from './History';
import CheckInBar from './CheckInBar';
import { scanHistory } from '../services/scanHistory';
import audio from '../services/audio';
import { isNativePlatform, scanOnce, stopNativeScan } from '../services/nativeScanner';
import haptics from '../services/haptics';

const CameraIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

const HistoryIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const QRIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="3" height="3" />
    <rect x="18" y="18" width="3" height="3" />
  </svg>
);

export default function Scanner({ onScan }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [showFlash, setShowFlash] = useState(false);
  const [useNative, setUseNative] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const nativeScannerRef = useRef(null);

  useEffect(() => {
    setUseNative(isNativePlatform());
  }, []);

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
      result.onchange = () => {
        setHasPermission(result.state === 'granted');
      };
    } catch (e) {
      setHasPermission(null);
    }
  };

  useEffect(() => {
    if (scanning && videoRef.current && !scannerRef.current) {
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
            const width = Math.round(vw * 0.70);
            const height = Math.round(vh * 0.50);
            const x = Math.round((vw - width) / 2);
            const y = Math.round((vh - height) / 2);
            return { x, y, width, height, downScaledWidth: 640, downScaledHeight: 480 };
          }
        }
      );

      await scannerRef.current.setCamera('environment');
      await scannerRef.current.start();
      localStorage.setItem('autoStartScanner', 'true');
      setHasPermission(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
      setScanning(false);
      localStorage.removeItem('autoStartScanner');
    }
  };

  const startScanner = async () => {
    audio.init();
    setError('');

    if (useNative) {
      setLoading(true);
      try {
        const result = await scanOnce();
        if (result) {
          handleQrSuccess(result);
        } else {
          setLoading(false);
          setError('No se detectó ningún código');
        }
      } catch (err) {
        setLoading(false);
        if (err.message.includes('permission')) {
          setError('Se requiere permiso de cámara. Actívalo en Configuración.');
        } else if (err.message.includes('canceled') || err.message.includes('cancelled')) {
          // Usuario canceló
        } else {
          setError(err.message || 'Error al escanear');
        }
      }
      return;
    }

    setScanning(true);
  };

  const stopScanner = async () => {
    if (useNative && nativeScannerRef.current) {
      try {
        await nativeScannerRef.current.stop();
      } catch (e) {}
      nativeScannerRef.current = null;
    }

    if (scannerRef.current) {
      try {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      } catch (e) {}
      scannerRef.current = null;
    }

    if (useNative) {
      await stopNativeScan();
    }

    setScanning(false);
  };

  const handleQrSuccess = async (decodedText) => {
    // QR detected - immediate feedback
    setShowFlash(true);
    haptics.scanDetected();
    audio.scan();
    setTimeout(() => setShowFlash(false), 150);

    stopScanner();
    setLoading(true);
    setError('');

    try {
      const data = await api.scanQR(decodedText);
      scanHistory.addScan({
        repairId: data.repair.id,
        repairName: data.repair.name,
        currentState: data.repair.currentState,
      });
      // Success - found in system
      haptics.success();
      audio.success();
      onScan(data, decodedText);
    } catch (err) {
      // Check if it's a "not found" error vs other errors
      const isNotFound = err.message?.toLowerCase().includes('no encontrad') ||
                         err.message?.toLowerCase().includes('not found');

      if (isNotFound) {
        // Not found - distinctive feedback
        haptics.notFound();
        audio.notFound();
      } else {
        // Error - operation failed
        haptics.error();
        audio.error();
      }
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
        <div className="alert alert-error" style={{ marginBottom: '12px' }}>
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!scanning && !loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Check-in bar at top */}
            <CheckInBar />

            {/* Compact Scan Card */}
            <div style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
              borderRadius: '16px',
              padding: '24px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}>
              {/* Icon */}
              <div style={{
                width: '56px',
                height: '56px',
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <QRIcon />
              </div>

              {/* Text */}
              <div style={{ flex: 1, color: 'white' }}>
                <h3 style={{ fontSize: '17px', fontWeight: '600', marginBottom: '4px' }}>
                  Escanear Reparacion
                </h3>
                <p style={{ fontSize: '13px', opacity: 0.8 }}>
                  Actualizar estado de orden
                </p>
              </div>

              {/* Scan button */}
              <button
                onClick={startScanner}
                style={{
                  width: '52px',
                  height: '52px',
                  background: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--primary)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  flexShrink: 0,
                }}
              >
                <CameraIcon size={24} />
              </button>
            </div>

            {/* Recent Scans */}
            <RecentScans />

            {/* History button */}
            <button
              onClick={() => {
                haptics.selection();
                setShowHistory(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '12px 16px',
                background: 'white',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <HistoryIcon />
              Ver historial completo
            </button>
          </div>
        ) : loading ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div className="spinner spinner-dark" style={{ width: '28px', height: '28px' }} />
            </div>
            <p style={{
              marginTop: '16px',
              fontSize: '16px',
              fontWeight: '500',
              color: 'var(--text)'
            }}>
              Procesando...
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card" style={{ padding: '16px' }}>
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

              <p style={{
                textAlign: 'center',
                marginTop: '12px',
                color: 'var(--text-muted)',
                fontSize: '13px'
              }}>
                Apunta al codigo QR
              </p>

              <button
                onClick={stopScanner}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '12px',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History View */}
      {showHistory && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--bg)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header with safe area - iOS style */}
          <div style={{
            background: 'white',
            borderBottom: '1px solid var(--border-light)',
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              minHeight: '44px',
            }}>
              {/* Back button - iOS style text */}
              <button
                onClick={() => {
                  haptics.light();
                  setShowHistory(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 4px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--primary)',
                  fontSize: '16px',
                  fontWeight: '400',
                }}
              >
                <BackIcon />
                <span>Atras</span>
              </button>

              {/* Title centered */}
              <span style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '17px',
                fontWeight: '600',
                color: 'var(--text)',
              }}>
                Historial
              </span>

              {/* Spacer for balance */}
              <div style={{ width: '60px' }} />
            </div>
          </div>

          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px',
            paddingBottom: '100px',
          }}>
            <History />
          </div>
        </div>
      )}
    </div>
  );
}
