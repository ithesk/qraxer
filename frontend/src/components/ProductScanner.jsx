import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { toast } from './Toast';
import haptics from '../services/haptics';
import { isNativePlatform, scanOnce, stopNativeScan, startNativeScan } from '../services/nativeScanner';
import { Skeleton } from './Skeleton';

// Icons
const BarcodeIcon = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 5v14" /><path d="M6 5v14" /><path d="M10 5v14" /><path d="M13 5v14" />
    <path d="M17 5v14" /><path d="M21 5v14" /><path d="M8 5v14" strokeWidth="2" />
    <path d="M15 5v14" strokeWidth="2" /><path d="M19 5v14" strokeWidth="0.5" />
  </svg>
);

const CameraIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const InventoryIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 12h6" /><path d="M9 16h6" />
  </svg>
);

const LocationIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const PlusIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const MinusIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3,6 5,6 21,6" />
    <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6" />
  </svg>
);

const CheckIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

const CloseIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ClockIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
  </svg>
);

export default function ProductScanner() {
  const [mode, setMode] = useState('normal'); // 'normal' | 'inventory'
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const HISTORY_KEY = 'product_scan_history_v1';

  // Inventory state
  const [inventoryItems, setInventoryItems] = useState(new Map());
  const [productCache, setProductCache] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);

  // Location state
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const isNative = isNativePlatform();
  const videoRef = useRef(null);
  const readerRef = useRef(null);

  // Refs for scanner callback (to avoid stale closures)
  const lastScannedRef = useRef({ code: null, time: 0 });
  const productCacheRef = useRef({});
  const loadingRef = useRef(false);
  const scannerControlRef = useRef(null); // For stopping native scanner

  // Keep refs in sync with state
  useEffect(() => {
    productCacheRef.current = productCache;
  }, [productCache]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerControlRef.current) {
        scannerControlRef.current.stop();
      }
      stopNativeScan();
      if (readerRef.current) {
        try { readerRef.current.reset(); } catch (e) {}
      }
    };
  }, []);

  const loadLocations = async () => {
    setLoadingLocations(true);
    try {
      const data = await api.getInventoryLocations();
      setLocations(data.locations || []);
    } catch (err) {
      toast.error(err.message);
      setLocations([]);
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleModeToggle = () => {
    if (mode === 'normal') {
      loadLocations();
      setShowLocationPicker(true);
    } else {
      if (inventoryItems.size > 0 && !confirm('¿Descartar conteo actual?')) return;
      stopInventoryScanner();
      setMode('normal');
      setInventoryItems(new Map());
      setProductCache({});
      setSelectedLocation(null);
      lastScannedRef.current = { code: null, time: 0 };
      productCacheRef.current = {};
    }
  };

  const handleSelectLocation = (location) => {
    setSelectedLocation(location);
    setShowLocationPicker(false);
    setMode('inventory');
    toast.success(`Ubicación: ${location.name}`);
  };

  // Start inventory scanner when entering inventory mode
  useEffect(() => {
    if (mode === 'inventory') {
      const timer = setTimeout(() => {
        startInventoryScanner();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  // Handle inventory barcode scan - using refs to avoid stale closure
  const handleInventoryScan = async (code) => {
    // Debounce: ignore same code within 1.5 seconds
    const last = lastScannedRef.current;
    if (last.code === code && Date.now() - last.time < 1500) {
      return;
    }

    // Prevent concurrent API calls
    if (loadingRef.current) return;

    lastScannedRef.current = { code, time: Date.now() };
    haptics.impact();

    // Check cache first - instant add
    const cached = productCacheRef.current[code];
    if (cached) {
      addToInventory(cached);
      haptics.success();
      return;
    }

    // Fetch from API
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await api.getProductByBarcode(code);
      if (data.found) {
        haptics.success();
        const productData = { ...data.product, barcode: code };
        // Update both ref and state
        productCacheRef.current[code] = productData;
        setProductCache(prev => ({ ...prev, [code]: productData }));
        addToInventory(productData);
      } else {
        haptics.error();
        toast.error(`No encontrado: ${code}`);
      }
    } catch (err) {
      haptics.error();
      toast.error(err.message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const startInventoryScanner = async () => {
    // Use MLKit native scanner for continuous scanning
    if (isNative) {
      try {
        const control = await startNativeScan(
          (code) => handleInventoryScan(code),
          (err) => {
            console.error('Scan error:', err);
            toast.error(err.message || 'Error al escanear');
            setScannerReady(false);
          }
        );
        scannerControlRef.current = control;
        setScannerReady(true);
      } catch (err) {
        toast.error('No se pudo iniciar el escáner');
        setScannerReady(false);
      }
    } else {
      // Fallback to web scanner (zxing) for browser testing
      await startWebInventoryScanner();
    }
  };

  const startWebInventoryScanner = async () => {
    const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } = await import('@zxing/library');

    // Wait for video element
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!videoRef.current) return;

    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
      ]);

      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      await reader.decodeFromConstraints(
        { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current,
        (result) => {
          if (result) handleInventoryScan(result.getText());
        }
      );
      setScannerReady(true);
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('No se pudo acceder a la cámara');
      setScannerReady(false);
    }
  };

  const stopInventoryScanner = () => {
    // Stop native scanner
    if (scannerControlRef.current) {
      scannerControlRef.current.stop();
      scannerControlRef.current = null;
    }
    stopNativeScan();

    // Stop web scanner
    if (readerRef.current) {
      try { readerRef.current.reset(); } catch (e) {}
      readerRef.current = null;
    }
    setScannerReady(false);
  };

  const addToHistory = (prod) => {
    setHistory(prev => {
      if (prev.length > 0 && prev[0].barcode === prod.barcode) return prev;
      return [{ ...prod, _scannedAt: Date.now() }, ...prev].slice(0, 12);
    });
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (saved.length > 0) {
        setHistory(saved);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 12)));
    } catch (e) {}
  }, [history]);

  const startScanner = async () => {
    setError('');
    setProduct(null);
    setScanning(true);
    haptics.light();

    if (isNative) {
      try {
        const code = await scanOnce();
        if (code) await handleBarcodeDetected(code);
        else setScanning(false);
      } catch (err) {
        setError(err.message || 'Error al escanear');
        setScanning(false);
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
        BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.QR_CODE,
      ]);

      readerRef.current = new BrowserMultiFormatReader(hints);
      await readerRef.current.decodeFromConstraints(
        { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current,
        (result) => { if (result) handleBarcodeDetected(result.getText()); }
      );
    } catch (err) {
      setError('No se pudo acceder a la cámara.');
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (isNative) stopNativeScan();
    else if (readerRef.current) {
      try { readerRef.current.reset(); } catch (e) {}
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
        const productData = { ...data.product, barcode: code };
        setProduct(productData);
        addToHistory(productData);
      } else {
        haptics.error();
        setError(`No encontrado: ${code}`);
        toast.error('Producto no encontrado');
      }
    } catch (err) {
      haptics.error();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addToInventory = (product) => {
    setInventoryItems(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(product.barcode);
      if (existing) {
        newMap.set(product.barcode, { ...existing, countedQty: existing.countedQty + 1 });
      } else {
        newMap.set(product.barcode, {
          productId: product.id,
          barcode: product.barcode,
          productName: product.name,
          countedQty: 1,
          currentStock: product.qty_available || 0,
        });
      }
      return newMap;
    });
  };

  const updateItemQty = (barcode, delta) => {
    setInventoryItems(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(barcode);
      if (item) {
        const newQty = item.countedQty + delta;
        if (newQty <= 0) newMap.delete(barcode);
        else newMap.set(barcode, { ...item, countedQty: newQty });
      }
      return newMap;
    });
  };

  const removeItem = (barcode) => {
    setInventoryItems(prev => {
      const newMap = new Map(prev);
      newMap.delete(barcode);
      return newMap;
    });
  };

  const handleSubmitInventory = async () => {
    if (inventoryItems.size === 0) return toast.error('No hay productos');
    if (!selectedLocation) return toast.error('Selecciona ubicación');

    stopInventoryScanner();
    setSubmitting(true);
    try {
      const items = Array.from(inventoryItems.values()).map(item => ({
        productId: item.productId,
        barcode: item.barcode,
        countedQty: item.countedQty,
      }));

      await api.submitInventoryCount(items, selectedLocation.id);
      haptics.success();
      toast.success(`Conteo enviado: ${items.length} productos`);
      setInventoryItems(new Map());
      setProductCache({});
      productCacheRef.current = {};
      // Restart scanner after submit
      setTimeout(() => startInventoryScanner(), 500);
    } catch (err) {
      haptics.error();
      toast.error(err.message);
      // Restart scanner on error too
      setTimeout(() => startInventoryScanner(), 500);
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price) => new Intl.NumberFormat('es-DO', {
    style: 'currency', currency: 'DOP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(price);

  const getTotalItems = () => {
    let total = 0;
    inventoryItems.forEach(item => { total += item.countedQty; });
    return total;
  };

  // ========== LOCATION PICKER ==========
  if (showLocationPicker) {
    return (
      <div className="fade-in">
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Seleccionar Ubicación</h3>
            <button onClick={() => setShowLocationPicker(false)} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer' }}>
              <CloseIcon size={20} />
            </button>
          </div>

          {loadingLocations ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 0' }}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg)' }}>
                  <Skeleton width="20px" height="20px" radius="6px" />
                  <div style={{ flex: 1 }}>
                    <Skeleton width="60%" height="14px" style={{ marginBottom: '6px' }} />
                    <Skeleton width="40%" height="12px" />
                  </div>
                </div>
              ))}
            </div>
          ) : locations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <LocationIcon size={40} />
              <p style={{ marginTop: '12px' }}>No hay ubicaciones disponibles</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {locations.map(loc => (
                <button key={loc.id} onClick={() => handleSelectLocation(loc)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--bg)', border: '1px solid var(--border-light)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left' }}>
                  <LocationIcon size={20} />
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '500' }}>{loc.name}</div>
                    {loc.warehouse && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{loc.warehouse}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== INVENTORY MODE ==========
  // MLKit solo funciona a pantalla completa, así que:
  // - Mostramos la lista de productos
  // - Botón grande para escanear (abre MLKit fullscreen)
  // - Al escanear, vuelve aquí y muestra el producto agregado
  if (mode === 'inventory') {
    // Función para escanear un producto en modo inventario (nativo)
  const scanInventoryProduct = async () => {
    if (isNative) {
      try {
        haptics.light();
        const code = await scanOnce(); // MLKit fullscreen
          if (code) {
            await handleInventoryScan(code);
          }
        } catch (err) {
          if (err.message !== 'scan canceled') {
            toast.error(err.message || 'Error al escanear');
          }
        }
      } else {
        // Web: iniciar scanner continuo
        if (!scannerReady) {
          await startWebInventoryScanner();
        }
      }
    };

    return (
      <div className="fade-in">
        {/* Header con ubicación */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '16px', padding: '12px 16px',
          background: 'white', borderRadius: '12px', border: '1px solid var(--border-light)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <LocationIcon size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ubicación</div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>{selectedLocation?.name}</div>
            </div>
          </div>
          <button onClick={handleModeToggle} style={{
            padding: '8px 14px', background: 'var(--bg)', border: '1px solid var(--border-light)',
            borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <CloseIcon size={16} />
            Salir
          </button>
        </div>

        {/* Botón de escanear - GRANDE y prominente */}
        <button onClick={scanInventoryProduct} disabled={loading} style={{
          width: '100%', padding: '20px', marginBottom: '16px',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: 'white', border: 'none', borderRadius: '16px',
          fontSize: '17px', fontWeight: '700', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
          opacity: loading ? 0.7 : 1
        }}>
          {loading ? (
            <>
              <div className="spinner" style={{ width: '24px', height: '24px' }} />
              Buscando producto...
            </>
          ) : (
            <>
              <CameraIcon size={24} />
              Escanear Producto
            </>
          )}
        </button>

        {/* Web: Video scanner (solo si no es nativo) */}
        {!isNative && scannerReady && (
          <div style={{
            marginBottom: '16px', borderRadius: '12px', overflow: 'hidden',
            border: '1px solid var(--border-light)', position: 'relative'
          }}>
            <video ref={videoRef} playsInline muted autoPlay style={{
              width: '100%', height: '160px', objectFit: 'cover', background: '#000'
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: '10%', right: '10%',
              height: '2px', background: 'rgba(37, 99, 235, 0.8)',
              boxShadow: '0 0 8px rgba(37, 99, 235, 0.5)'
            }} />
            <button onClick={stopInventoryScanner} style={{
              position: 'absolute', top: '8px', right: '8px',
              padding: '6px 12px', background: 'rgba(0,0,0,0.6)', color: 'white',
              border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer'
            }}>
              Pausar
            </button>
          </div>
        )}

        {/* Resumen de conteo */}
        <div style={{
          display: 'flex', gap: '12px', marginBottom: '16px'
        }}>
          <div style={{
            flex: 1, padding: '16px', background: 'white', borderRadius: '12px',
            border: '1px solid var(--border-light)', textAlign: 'center'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--primary)' }}>{inventoryItems.size}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Productos</div>
          </div>
          <div style={{
            flex: 1, padding: '16px', background: 'white', borderRadius: '12px',
            border: '1px solid var(--border-light)', textAlign: 'center'
          }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)' }}>{getTotalItems()}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Unidades</div>
          </div>
        </div>

        {/* Lista de productos */}
        <div style={{
          background: 'white', borderRadius: '16px', border: '1px solid var(--border-light)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '15px', fontWeight: '600' }}>Productos Escaneados</span>
            {inventoryItems.size > 0 && (
              <button onClick={() => { setInventoryItems(new Map()); setProductCache({}); productCacheRef.current = {}; }}
                style={{ fontSize: '12px', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Limpiar todo
              </button>
            )}
          </div>

          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {inventoryItems.size === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <BarcodeIcon size={40} />
                <p style={{ marginTop: '12px', fontSize: '14px' }}>Escanea productos para agregarlos al conteo</p>
              </div>
            ) : (
              <div style={{ padding: '8px' }}>
                {Array.from(inventoryItems.values()).reverse().map(item => (
                  <div key={item.barcode} style={{
                    padding: '12px', marginBottom: '8px', background: 'var(--bg)',
                    borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px', fontWeight: '500',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {item.productName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                        {item.barcode}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => updateItemQty(item.barcode, -1)} style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        border: '1px solid var(--border-light)', background: 'white',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <MinusIcon size={16} />
                      </button>
                      <span style={{
                        minWidth: '36px', textAlign: 'center',
                        fontSize: '17px', fontWeight: '700'
                      }}>
                        {item.countedQty}
                      </span>
                      <button onClick={() => updateItemQty(item.barcode, 1)} style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        border: '1px solid var(--border-light)', background: 'white',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <PlusIcon size={16} />
                      </button>
                      <button onClick={() => removeItem(item.barcode)} style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        border: 'none', background: '#fef2f2', color: '#dc2626',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginLeft: '4px'
                      }}>
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Botón enviar */}
        {inventoryItems.size > 0 && (
          <button onClick={handleSubmitInventory} disabled={submitting} style={{
            width: '100%', marginTop: '16px', padding: '16px',
            background: '#16a34a', color: 'white', border: 'none',
            borderRadius: '14px', fontSize: '16px', fontWeight: '700',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            opacity: submitting ? 0.7 : 1,
            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
          }}>
            {submitting ? (
              <div className="spinner" style={{ width: '20px', height: '20px' }} />
            ) : (
              <CheckIcon size={22} />
            )}
            Enviar Conteo ({getTotalItems()} unidades)
          </button>
        )}
      </div>
    );
  }

  // ========== NORMAL MODE - PRODUCT RESULT ==========
  if (product) {
    return (
      <div className="fade-in">
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px' }}>{formatPrice(product.list_price)}</div>
          <h3 style={{ fontSize: '17px', fontWeight: '500', marginBottom: '20px', lineHeight: '1.4' }}>{product.name}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Código</div>
              <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>{product.barcode}</div>
            </div>
            {product.qty_available !== undefined && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Stock</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: product.qty_available > 0 ? 'var(--text)' : 'var(--error)' }}>{product.qty_available} uds</div>
              </div>
            )}
          </div>
        </div>

        <button onClick={() => { setProduct(null); startScanner(); }}
          style={{ width: '100%', marginTop: '16px', padding: '16px', background: 'var(--text)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <CameraIcon size={18} />
          Escanear otro
        </button>

        {history.length > 1 && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ClockIcon size={14} />Anteriores
            </div>
            {history.slice(1).map((item, idx) => (
              <button key={`${item.barcode}-${idx}`} onClick={() => setProduct(item)}
                style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'white', border: '1px solid var(--border-light)', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', marginBottom: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.barcode}</div>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', marginLeft: '12px' }}>{formatPrice(item.list_price)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ========== NORMAL MODE - LOADING ==========
  if (loading) {
    return (
      <div className="fade-in" style={{ padding: '20px' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border-light)' }}>
          <Skeleton width="40%" height="24px" style={{ marginBottom: '12px' }} />
          <Skeleton width="80%" height="16px" style={{ marginBottom: '20px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
            <div>
              <Skeleton width="40%" height="12px" style={{ marginBottom: '6px' }} />
              <Skeleton width="70%" height="14px" />
            </div>
            <div>
              <Skeleton width="40%" height="12px" style={{ marginBottom: '6px' }} />
              <Skeleton width="50%" height="14px" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== NORMAL MODE - SCANNING (Web only) ==========
  if (scanning && !isNative) {
    return (
      <div className="fade-in">
        <div style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid var(--border-light)' }}>
          <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: '12px', overflow: 'hidden', background: '#000', position: 'relative' }}>
            <video ref={videoRef} playsInline muted autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: '2px', background: 'rgba(255,255,255,0.6)' }} />
          </div>
          <button onClick={stopScanner} style={{ width: '100%', marginTop: '16px', padding: '14px', background: 'var(--bg)', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ========== NORMAL MODE - SCANNING (Native) ==========
  if (scanning && isNative) {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
        <div className="spinner spinner-dark" style={{ width: '32px', height: '32px' }} />
        <p style={{ marginTop: '16px', fontSize: '15px', color: 'var(--text-muted)' }}>Escaneando...</p>
      </div>
    );
  }

  // ========== NORMAL MODE - IDLE ==========
  return (
    <div className="fade-in">
      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', marginBottom: '16px', fontSize: '14px', color: '#dc2626' }}>
          {error}
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '16px', padding: '40px 24px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', margin: '0 auto 20px', background: 'var(--bg)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarcodeIcon size={32} />
        </div>
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>Consultar Producto</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>Escanea el código de barras</p>
        <button onClick={startScanner} style={{ background: 'var(--text)', color: 'white', padding: '14px 32px', borderRadius: '12px', fontSize: '15px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '8px', border: 'none', cursor: 'pointer' }}>
          <CameraIcon size={18} />
          Escanear
        </button>
      </div>

      {history.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ClockIcon size={14} />Recientes
          </div>
          {history.map((item, idx) => (
            <button key={`${item.barcode}-${idx}`} onClick={() => setProduct(item)}
              style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'white', border: '1px solid var(--border-light)', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', marginBottom: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.barcode}</div>
              </div>
              <div style={{ fontSize: '15px', fontWeight: '600', marginLeft: '12px' }}>{formatPrice(item.list_price)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
