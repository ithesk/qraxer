import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { toast } from './Toast';
import haptics from '../services/haptics';
import { isNativePlatform, scanOnce, stopNativeScan } from '../services/nativeScanner';

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

// Clock icon for history
const ClockIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

export default function ProductScanner() {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]); // Últimos 3 scans

  const isNative = isNativePlatform();

  useEffect(() => {
    return () => {
      if (isNative) {
        stopNativeScan();
      }
    };
  }, []);

  const addToHistory = (prod) => {
    setHistory(prev => {
      // Evitar duplicados consecutivos
      if (prev.length > 0 && prev[0].barcode === prod.barcode) {
        return prev;
      }
      // Mantener solo los últimos 3
      const newHistory = [{ ...prod, _scannedAt: Date.now() }, ...prev].slice(0, 3);
      return newHistory;
    });
  };

  const startScanner = async () => {
    setError('');
    setProduct(null);
    setScanning(true);

    if (isNative) {
      try {
        const code = await scanOnce();
        if (code) {
          await handleBarcodeDetected(code);
        } else {
          setScanning(false);
        }
      } catch (err) {
        console.error('Native scan error:', err);
        setError(err.message || 'Error al escanear');
        setScanning(false);
      }
    } else {
      initWebScanner();
    }
  };

  const videoRef = useRef(null);
  const readerRef = useRef(null);

  const initWebScanner = async () => {
    const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } = await import('@zxing/library');

    if (!videoRef.current) return;

    try {
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

      await readerRef.current.decodeFromConstraints(
        {
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }
        },
        videoRef.current,
        (result) => {
          if (result) {
            handleBarcodeDetected(result.getText());
          }
        }
      );
    } catch (err) {
      console.error('Camera error:', err);
      setError('No se pudo acceder a la cámara.');
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (isNative) {
      stopNativeScan();
    } else if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (e) {}
      readerRef.current = null;
    }
    setScanning(false);
  };

  const handleBarcodeDetected = async (code) => {
    haptics.impact();
    stopScanner();
    setLoading(true);
    setError('');

    try {
      const data = await api.getProductByBarcode(code);

      if (data.found) {
        haptics.success();
        setProduct(data.product);
        addToHistory(data.product);
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
    startScanner();
  };

  const selectFromHistory = (prod) => {
    setProduct(prod);
    setError('');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Show product result - diseño minimalista
  if (product) {
    return (
      <div className="fade-in">
        {/* Product Card - Minimalista */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-light)',
        }}>
          {/* Precio destacado */}
          <div style={{
            fontSize: '36px',
            fontWeight: '700',
            color: 'var(--text)',
            marginBottom: '8px',
          }}>
            {formatPrice(product.list_price)}
          </div>

          {/* Nombre del producto */}
          <h3 style={{
            fontSize: '17px',
            fontWeight: '500',
            color: 'var(--text)',
            marginBottom: '20px',
            lineHeight: '1.4',
          }}>
            {product.name}
          </h3>

          {/* Detalles en grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-light)',
          }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Código
              </div>
              <div style={{ fontSize: '14px', fontFamily: 'monospace', color: 'var(--text)' }}>
                {product.barcode}
              </div>
            </div>

            {product.qty_available !== undefined && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Stock
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: product.qty_available > 0 ? 'var(--text)' : 'var(--error)',
                }}>
                  {product.qty_available} uds
                </div>
              </div>
            )}

            {product.default_code && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Referencia
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                  {product.default_code}
                </div>
              </div>
            )}

            {product.categ_name && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Categoría
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                  {product.categ_name}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botón escanear */}
        <button
          onClick={handleNewScan}
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
          <CameraIcon size={18} />
          Escanear otro
        </button>

        {/* Historial */}
        {history.length > 1 && (
          <div style={{ marginTop: '24px' }}>
            <div style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <ClockIcon size={14} />
              Anteriores
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.slice(1).map((item, idx) => (
                <button
                  key={`${item.barcode}-${idx}`}
                  onClick={() => selectFromHistory(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: 'white',
                    border: '1px solid var(--border-light)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {item.barcode}
                    </div>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginLeft: '12px' }}>
                    {formatPrice(item.list_price)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
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
        <div className="spinner spinner-dark" style={{ width: '32px', height: '32px' }} />
        <p style={{
          marginTop: '16px',
          fontSize: '15px',
          color: 'var(--text-muted)',
        }}>
          Buscando...
        </p>
      </div>
    );
  }

  // Scanning state - solo para web
  if (scanning && !isNative) {
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
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '10%',
              right: '10%',
              height: '2px',
              background: 'rgba(255, 255, 255, 0.6)',
              zIndex: 10,
            }} />
          </div>

          <button
            onClick={stopScanner}
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

  // Scanning state nativo
  if (scanning && isNative) {
    return (
      <div className="fade-in" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
      }}>
        <div className="spinner spinner-dark" style={{ width: '32px', height: '32px' }} />
        <p style={{
          marginTop: '16px',
          fontSize: '15px',
          color: 'var(--text-muted)',
        }}>
          Escaneando...
        </p>
      </div>
    );
  }

  // Idle state - diseño minimalista
  return (
    <div className="fade-in">
      {/* Error alert */}
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

      {/* Main scan card - minimalista */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '40px 24px',
        border: '1px solid var(--border-light)',
        textAlign: 'center',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 20px',
          background: 'var(--bg)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <BarcodeIcon size={32} />
        </div>

        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: 'var(--text)',
          marginBottom: '8px',
        }}>
          Consultar Producto
        </h3>

        <p style={{
          fontSize: '14px',
          color: 'var(--text-muted)',
          marginBottom: '24px',
        }}>
          Escanea el código de barras
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
          <CameraIcon size={18} />
          Escanear
        </button>
      </div>

      {/* Historial si existe */}
      {history.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <ClockIcon size={14} />
            Recientes
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.map((item, idx) => (
              <button
                key={`${item.barcode}-${idx}`}
                onClick={() => selectFromHistory(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'white',
                  border: '1px solid var(--border-light)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px',
                    color: 'var(--text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {item.barcode}
                  </div>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginLeft: '12px' }}>
                  {formatPrice(item.list_price)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
