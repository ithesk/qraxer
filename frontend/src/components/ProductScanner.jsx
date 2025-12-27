import { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { api } from '../services/api';
import { toast } from './Toast';
import haptics from '../services/haptics';

// Barcode icon
const BarcodeIcon = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 5v14" />
    <path d="M6 5v14" />
    <path d="M10 5v14" />
    <path d="M13 5v14" />
    <path d="M17 5v14" />
    <path d="M21 5v14" />
    <path d="M8 5v14" strokeWidth="2" />
    <path d="M15 5v14" strokeWidth="2" />
    <path d="M19 5v14" strokeWidth="0.5" />
  </svg>
);

// Camera icon
const CameraIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export default function ProductScanner() {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [lastCode, setLastCode] = useState('');

  const videoRef = useRef(null);
  const readerRef = useRef(null);

  useEffect(() => {
    // Auto-iniciar cámara si ya tiene permiso
    checkCameraAndAutoStart();
    return () => {
      stopScanner();
    };
  }, []);

  const checkCameraAndAutoStart = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      if (result.state === 'granted') {
        startScanner();
      }
    } catch (e) {
      // Permissions API no soportada
    }
  };

  const initScanner = async () => {
    if (!videoRef.current) return;

    try {
      // Configure hints for barcode formats
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.QR_CODE,
      ]);

      readerRef.current = new BrowserMultiFormatReader(hints);

      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      };

      await readerRef.current.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, err) => {
          if (result) {
            const code = result.getText();
            handleBarcodeDetected(code);
          }
        }
      );

    } catch (err) {
      console.error('Camera error:', err);
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
      setScanning(false);
    }
  };

  const startScanner = () => {
    setError('');
    setProduct(null);
    setScanning(true);
    setTimeout(() => initScanner(), 150);
  };

  const stopScanner = () => {
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (e) {
        // Ignore
      }
      readerRef.current = null;
    }
    setScanning(false);
  };

  const handleBarcodeDetected = async (code) => {
    // Avoid duplicate scans
    if (code === lastCode) return;
    setLastCode(code);

    haptics.impact();
    stopScanner();
    setLoading(true);
    setError('');

    try {
      const data = await api.getProductByBarcode(code);

      if (data.found) {
        haptics.success();
        setProduct(data.product);
      } else {
        haptics.error();
        setError(`Producto no encontrado: ${code}`);
        toast.error('Producto no encontrado');
      }
    } catch (err) {
      haptics.error();
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNewScan = () => {
    setProduct(null);
    setError('');
    setLastCode('');
    startScanner();
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
    }).format(price);
  };

  // Show product result
  if (product) {
    return (
      <div className="fade-in">
        <h2 style={{
          fontSize: '22px',
          fontWeight: '700',
          marginBottom: '20px',
          color: 'var(--text)',
        }}>
          Producto Encontrado
        </h2>

        <div className="card" style={{ padding: '24px' }}>
          {/* Product name */}
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: '1.3',
          }}>
            {product.name}
          </h3>

          {/* Price - prominent */}
          <div style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '20px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.8)',
              marginBottom: '4px',
            }}>
              Precio de Venta
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: '700',
              color: 'white',
            }}>
              {formatPrice(product.list_price)}
            </div>
          </div>

          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {product.default_code && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--border-light)',
              }}>
                <span style={{ color: 'var(--text-muted)' }}>Referencia</span>
                <span style={{ fontWeight: '600' }}>{product.default_code}</span>
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: '1px solid var(--border-light)',
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Código de Barras</span>
              <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>{product.barcode}</span>
            </div>

            {product.qty_available !== undefined && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--border-light)',
              }}>
                <span style={{ color: 'var(--text-muted)' }}>Stock Disponible</span>
                <span style={{
                  fontWeight: '600',
                  color: product.qty_available > 0 ? 'var(--success)' : 'var(--error)',
                }}>
                  {product.qty_available} unidades
                </span>
              </div>
            )}

            {product.categ_name && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 0',
              }}>
                <span style={{ color: 'var(--text-muted)' }}>Categoría</span>
                <span style={{ fontWeight: '500' }}>{product.categ_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* New scan button */}
        <button
          onClick={handleNewScan}
          className="btn-primary btn-large"
          style={{ width: '100%', marginTop: '20px' }}
        >
          <BarcodeIcon size={20} />
          Escanear otro producto
        </button>
      </div>
    );
  }

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
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div className="spinner spinner-dark" style={{ width: '32px', height: '32px' }} />
        </div>
        <p style={{
          marginTop: '20px',
          fontSize: '17px',
          fontWeight: '500',
          color: 'var(--text)',
        }}>
          Buscando producto...
        </p>
      </div>
    );
  }

  // Scanning state
  if (scanning) {
    return (
      <div className="fade-in">
        <div className="card" style={{ padding: '16px' }}>
          {/* Camera view - wider for barcodes */}
          <div style={{
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            background: '#000',
            position: 'relative',
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
                display: 'block',
              }}
            />
            {/* Scan line overlay */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '10%',
              right: '10%',
              height: '2px',
              background: 'rgba(34, 197, 94, 0.8)',
              boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)',
              animation: 'pulse 1.5s infinite',
            }} />
          </div>

          <p style={{
            textAlign: 'center',
            marginTop: '16px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
          }}>
            Apunta la cámara al código de barras
          </p>

          <button
            onClick={stopScanner}
            className="btn-secondary btn-large"
            style={{ marginTop: '16px', width: '100%' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // Idle state
  return (
    <div className="fade-in">
      <h2 style={{
        fontSize: '22px',
        fontWeight: '700',
        marginBottom: '20px',
        color: 'var(--text)',
      }}>
        Consultar Producto
      </h2>

      {/* Error alert */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          <span>{error}</span>
        </div>
      )}

      {/* Main card */}
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        borderRadius: 'var(--radius)',
        padding: '40px 24px',
        textAlign: 'center',
        color: 'white',
      }}>
        {/* Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 20px',
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <BarcodeIcon size={40} />
        </div>

        <h3 style={{
          fontSize: '24px',
          fontWeight: '700',
          marginBottom: '8px',
        }}>
          Escanear Código
        </h3>

        <p style={{
          fontSize: '14px',
          opacity: 0.8,
          marginBottom: '24px',
        }}>
          Escanea el código de barras para ver precio y stock
        </p>

        <button
          onClick={startScanner}
          style={{
            background: 'white',
            color: '#059669',
            padding: '14px 32px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '16px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            minHeight: '52px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <CameraIcon />
          Escanear
        </button>
      </div>

      {/* Supported formats info */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        background: 'var(--card-bg)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-light)',
      }}>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}>
          Formatos soportados: EAN-13, EAN-8, UPC-A, Code 128, Code 39, QR
        </p>
      </div>
    </div>
  );
}
