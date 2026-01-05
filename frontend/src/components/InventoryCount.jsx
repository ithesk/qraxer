import { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { api } from '../services/api';
import { toast } from './Toast';
import haptics from '../services/haptics';
import audio from '../services/audio';

// Icons
const BarcodeIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 5v14" />
    <path d="M6 5v14" />
    <path d="M10 5v14" />
    <path d="M13 5v14" />
    <path d="M17 5v14" />
    <path d="M21 5v14" />
    <path d="M8 5v14" strokeWidth="2" />
    <path d="M15 5v14" strokeWidth="2" />
  </svg>
);

const CameraIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const TrashIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const SendIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const LocationIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export default function InventoryCount() {
  // States
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [lastCode, setLastCode] = useState('');

  const videoRef = useRef(null);
  const readerRef = useRef(null);

  // Load locations on mount
  useEffect(() => {
    loadLocations();
    return () => stopScanner();
  }, []);

  const loadLocations = async () => {
    try {
      setLoadingLocations(true);
      const locs = await api.getInventoryLocations();
      setLocations(locs);

      // Set first location as default
      if (locs.length > 0) {
        setSelectedLocation(locs[0]);
      }
    } catch (err) {
      toast.error('Error al cargar ubicaciones');
      console.error(err);
    } finally {
      setLoadingLocations(false);
    }
  };

  const initScanner = async () => {
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
        (result) => {
          if (result) {
            handleBarcodeDetected(result.getText());
          }
        }
      );
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('No se pudo acceder a la cámara');
      setScanning(false);
    }
  };

  const startScanner = () => {
    audio.init();
    setScanning(true);
    setTimeout(() => initScanner(), 150);
  };

  const stopScanner = () => {
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (e) {}
      readerRef.current = null;
    }
    setScanning(false);
  };

  const handleBarcodeDetected = async (code) => {
    if (code === lastCode) return;
    setLastCode(code);

    haptics.impact();
    audio.scan();

    // Check if already in list
    const existing = items.find(i => i.barcode === code);
    if (existing) {
      // Increment quantity
      setItems(items.map(i =>
        i.barcode === code ? { ...i, qty: i.qty + 1 } : i
      ));
      haptics.success();
      toast.success(`+1 ${existing.name.substring(0, 30)}...`);
      // Reset lastCode after delay to allow rescanning
      setTimeout(() => setLastCode(''), 1500);
      return;
    }

    // Search product
    setLoading(true);
    try {
      const data = await api.getProductByBarcode(code);

      if (data.found) {
        haptics.success();
        audio.success();
        setItems([...items, {
          barcode: code,
          productId: data.product.id,
          name: data.product.name,
          qty: 1,
          currentStock: data.product.qty_available || 0,
        }]);
        toast.success(`Agregado: ${data.product.name.substring(0, 30)}...`);
      } else {
        haptics.error();
        audio.error();
        toast.error(`Producto no encontrado: ${code}`);
      }
    } catch (err) {
      haptics.error();
      audio.error();
      toast.error(err.message);
    } finally {
      setLoading(false);
      setTimeout(() => setLastCode(''), 1500);
    }
  };

  const updateQty = (barcode, newQty) => {
    if (newQty < 0) return;
    setItems(items.map(i =>
      i.barcode === barcode ? { ...i, qty: newQty } : i
    ));
  };

  const removeItem = (barcode) => {
    haptics.impact();
    setItems(items.filter(i => i.barcode !== barcode));
  };

  const clearAll = () => {
    haptics.impact();
    setItems([]);
    toast.info('Lista limpiada');
  };

  const submitCount = async () => {
    if (items.length === 0) {
      toast.error('Agrega productos para enviar');
      return;
    }

    if (!selectedLocation) {
      toast.error('Selecciona una ubicación');
      return;
    }

    setSending(true);
    try {
      const payload = items.map(i => ({
        barcode: i.barcode,
        productId: i.productId,
        productName: i.name,
        countedQty: i.qty,
      }));

      const result = await api.submitInventoryCount(payload, selectedLocation.id, '');

      if (result.success) {
        haptics.success();
        audio.success();
        toast.success(`Conteo enviado: ${result.processed} productos`);
        setItems([]);
      } else {
        throw new Error(result.message || 'Error al enviar conteo');
      }
    } catch (err) {
      haptics.error();
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  // Loading locations
  if (loadingLocations) {
    return (
      <div className="fade-in" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
      }}>
        <div className="spinner spinner-dark" style={{ width: '32px', height: '32px' }} />
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>
          Cargando ubicaciones...
        </p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <h2 style={{
        fontSize: '22px',
        fontWeight: '700',
        marginBottom: '16px',
        color: 'var(--text)',
      }}>
        Conteo de Inventario
      </h2>

      {/* Location Selector */}
      <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <LocationIcon />
          <span style={{ fontWeight: '600', color: 'var(--text)' }}>Ubicación</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {locations.map(loc => (
            <button
              key={loc.id}
              onClick={() => {
                haptics.selection();
                setSelectedLocation(loc);
              }}
              style={{
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm)',
                border: selectedLocation?.id === loc.id
                  ? '2px solid var(--primary)'
                  : '1px solid var(--border-light)',
                background: selectedLocation?.id === loc.id
                  ? 'var(--primary-bg)'
                  : 'white',
                color: selectedLocation?.id === loc.id
                  ? 'var(--primary)'
                  : 'var(--text)',
                fontWeight: selectedLocation?.id === loc.id ? '600' : '400',
                fontSize: '14px',
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Scanning area */}
      {scanning ? (
        <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
          <div style={{
            width: '100%',
            aspectRatio: '4/3',
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
              }}
            />
            {/* Scan line */}
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
            {loading && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div className="spinner" style={{ width: '40px', height: '40px' }} />
              </div>
            )}
          </div>

          <button
            onClick={stopScanner}
            className="btn-secondary btn-large"
            style={{ marginTop: '12px', width: '100%' }}
          >
            Cerrar Cámara
          </button>
        </div>
      ) : (
        <button
          onClick={startScanner}
          className="btn-primary btn-large"
          style={{
            width: '100%',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          <CameraIcon />
          Escanear Producto
        </button>
      )}

      {/* Items list */}
      {items.length > 0 && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-light)',
          }}>
            <span style={{ fontWeight: '600' }}>
              {items.length} producto{items.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={clearAll}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--error)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              Limpiar todo
            </button>
          </div>

          {items.map(item => (
            <div
              key={item.barcode}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-light)',
              }}
            >
              {/* Product info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {item.name}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  fontFamily: 'monospace',
                }}>
                  {item.barcode}
                </div>
              </div>

              {/* Quantity controls */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <button
                  onClick={() => updateQty(item.barcode, item.qty - 1)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'white',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  −
                </button>

                <input
                  type="number"
                  value={item.qty}
                  onChange={(e) => updateQty(item.barcode, parseInt(e.target.value) || 0)}
                  style={{
                    width: '50px',
                    height: '32px',
                    textAlign: 'center',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                  }}
                />

                <button
                  onClick={() => updateQty(item.barcode, item.qty + 1)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'white',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  +
                </button>
              </div>

              {/* Delete button */}
              <button
                onClick={() => removeItem(item.barcode)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--error-bg)',
                  color: 'var(--error)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Submit button */}
      {items.length > 0 && (
        <button
          onClick={submitCount}
          disabled={sending}
          className="btn-primary btn-large"
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          {sending ? (
            <>
              <div className="spinner" style={{ width: '20px', height: '20px' }} />
              Enviando...
            </>
          ) : (
            <>
              <SendIcon />
              Enviar Conteo a {selectedLocation?.name || 'Almacén'}
            </>
          )}
        </button>
      )}

      {/* Empty state */}
      {items.length === 0 && !scanning && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--text-muted)',
        }}>
          <BarcodeIcon size={48} />
          <p style={{ marginTop: '16px' }}>
            Escanea productos para agregarlos al conteo
          </p>
          <p style={{ fontSize: '13px', marginTop: '8px' }}>
            Ubicación: <strong>{selectedLocation?.name || 'No seleccionada'}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
