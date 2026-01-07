import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Ocr } from '@jcesarmobile/capacitor-ocr';
import haptics from '../services/haptics';
import { api } from '../services/api';

const isNative = Capacitor.isNativePlatform();

const luhnCheck = (value) => {
  let sum = 0;
  let shouldDouble = false;
  for (let i = value.length - 1; i >= 0; i -= 1) {
    let digit = Number(value[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
};

const normalizeDigits = (value) => (value || '').replace(/\D/g, '');

const extractImeis = (text) => {
  if (!text) return [];
  const patterns = [
    /(\d{2})\s+(\d{6})\s+(\d{6})\s+(\d{1})/g,
    /(\d{2})\s*(\d{6})\s*(\d{6})\s*(\d{1})/g,
    /\b\d{15}\b/g,
    /(\d{2})-?(\d{6})-?(\d{6})-?(\d{1})/g,
    /(?:IMEI|ΙΜΕΙ|IME1)[:\s]+(\d[\d\s]{14,18})/ig,
    /(?:IMEI2|IME12)[:\s]+(\d[\d\s]{14,18})/ig,
    /IMEI\s*(\d{15})/ig,
    /IMEI2\s*(\d{15})/ig,
    /MEID\s*(\d{14})/ig,
  ];

  const results = new Set();
  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match.slice(1).length > 0 ? match.slice(1).join('') : match[0];
      const digits = normalizeDigits(raw);
      if (digits.length === 15 && luhnCheck(digits)) {
        results.add(digits);
      }
    }
  });

  return Array.from(results);
};

export default function Mo35OcrScreen({ onClose, fullScreen = true }) {
  const [isActive, setIsActive] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [imeiList, setImeiList] = useState([]);
  const [lastText, setLastText] = useState('');
  const [error, setError] = useState('');
  const [imeiInfo, setImeiInfo] = useState({});
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedHistoryImei, setExpandedHistoryImei] = useState(null);
  const [historyLoading, setHistoryLoading] = useState({});
  const portalTarget = useMemo(() => (typeof document !== 'undefined' ? document.body : null), []);
  const HISTORY_KEY = 'mo35_imei_history_v2';
  const HISTORY_KEY_OLD = 'mo35_imei_history_v1';

  const processPhoto = async (photo) => {
    if (!photo?.path) {
      setError('No se pudo obtener la imagen');
      setIsActive(false);
      return;
    }

    const result = await Ocr.process({ image: photo.path });
    const text = (result?.results || []).map((entry) => entry.text).join(' ');
    setLastText(text);

    const imeis = extractImeis(text);
    if (imeis.length > 0) {
      const [primaryImei] = imeis;
      setImeiList((prev) => {
        const set = new Set(prev);
        set.add(primaryImei);
        return Array.from(set);
      });
    }
  };

  const startScan = async () => {
    if (!isNative) {
      setError('OCR solo disponible en iOS');
      return;
    }
    setError('');
    try {
      setIsActive(true);
      haptics.light();
      const perms = await Camera.checkPermissions();
      if (perms.camera !== 'granted') {
        const request = await Camera.requestPermissions({ permissions: ['camera'] });
        if (request.camera !== 'granted') {
          setError('Permiso de camara denegado');
          setIsActive(false);
          return;
        }
      }

      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 90,
      });

      await processPhoto(photo);
      setIsActive(false);
      setHasScanned(true);
    } catch (err) {
      setError(err?.message || 'No se pudo iniciar OCR');
      setIsActive(false);
    }
  };

  const handleUpload = async () => {
    if (!isNative) {
      setError('OCR solo disponible en iOS');
      return;
    }
    setError('');
    try {
      setIsActive(true);
      haptics.light();
      const perms = await Camera.checkPermissions();
      if (perms.photos !== 'granted') {
        const request = await Camera.requestPermissions({ permissions: ['photos'] });
        if (request.photos !== 'granted') {
          setError('Permiso de fotos denegado');
          setIsActive(false);
          return;
        }
      }
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
        quality: 90,
      });
      await processPhoto(photo);
      setIsActive(false);
      setHasScanned(true);
    } catch (err) {
      setError(err?.message || 'No se pudo cargar la imagen');
      setIsActive(false);
    }
  };

  useEffect(() => {
    document.body.classList.remove('barcode-scanning-active');
    document.body.classList.remove('barcode-scanner-active');
    startScan();
    return () => {
      document.body.classList.remove('barcode-scanning-active');
    };
  }, []);

  const handleClear = () => {
    setImeiList([]);
    setLastText('');
    setImeiInfo({});
  };

  useEffect(() => {
    try {
      // Intentar cargar historial nuevo (v2)
      let saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

      // Si no hay historial v2, intentar migrar desde v1
      if (saved.length === 0) {
        const oldSaved = JSON.parse(localStorage.getItem(HISTORY_KEY_OLD) || '[]');
        if (oldSaved.length > 0) {
          // Migrar: agregar campos faltantes
          saved = oldSaved.map((item) => ({
            ...item,
            extracted: item.extracted || {},
            isApple: item.isApple || false,
            fromCache: item.fromCache || false,
          }));
          // Guardar en v2
          localStorage.setItem(HISTORY_KEY, JSON.stringify(saved));
        }
      }

      setHistory(saved);
    } catch (e) {
      console.error('[mo35] Error loading history:', e);
    }
  }, []);

  const persistHistory = (entries) => {
    setHistory(entries);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error('[mo35] Error saving history:', e);
    }
  };

  const upsertHistory = (imei, info) => {
    const now = Date.now();
    // Guardar datos completos para poder mostrarlos luego
    const rawData = info?.raw;
    const extracted = rawData?.raw?.extracted || rawData?.payload?.extracted || rawData?.extracted || {};
    const isApple = rawData?.isApple || rawData?.raw?.is_apple || rawData?.payload?.is_apple || false;

    const entry = {
      imei,
      modelName: info?.modelName || 'Sin modelo',
      manufacturer: info?.manufacturer || '-',
      lastAt: now,
      isApple,
      extracted, // Guardar datos extraídos completos
      fromCache: rawData?.fromCache || false,
    };
    const next = [
      entry,
      ...history.filter((item) => item.imei !== imei),
    ].slice(0, 200);
    persistHistory(next);
  };

  const fetchImeiInfo = async (imei) => {
    console.log('[mo35] Fetch IMEI via backend:', imei);

    try {
      const data = await api.lookupImei(imei);
      console.log('[mo35] Backend response:', data);

      // Transform backend response to expected format
      const summary = data.summary || {};
      const payload = data.payload?.extracted || {};

      return {
        result: {
          'Model Name': summary.modelName || payload.model_name || payload.model_description || 'Sin modelo',
          'Model Code': payload.model_code || payload.model || null,
          Manufacturer: summary.manufacturer || payload.manufacturer || '-',
        },
        fromCache: data.fromCache,
        isApple: data.payload?.is_apple || false,
        extracted: data.payload?.extracted || {},
        raw: data.payload,
      };
    } catch (err) {
      console.error('[mo35] Backend IMEI lookup failed:', err);
      throw err;
    }
  };

  useEffect(() => {
    const pending = imeiList.filter((imei) => !imeiInfo[imei]);
    if (pending.length === 0) return;
    pending.forEach(async (imei) => {
      try {
        const data = await fetchImeiInfo(imei);
        const result = data?.result || {};
        const modelName = result['Model Name'] || result['Model Code'] || data?.['Model Name'] || data?.['Model Code'] || 'Sin modelo';
        const manufacturer = result.Manufacturer || data?.Manufacturer || '-';
        const info = { modelName, manufacturer, raw: data };
        setImeiInfo((prev) => ({
          ...prev,
          [imei]: info,
        }));
        upsertHistory(imei, info);
      } catch (err) {
        console.error('[mo35] IMEI lookup failed:', imei, err);
        setImeiInfo((prev) => ({
          ...prev,
          [imei]: {
            modelName: 'Error',
            manufacturer: '-',
            error: err?.message || 'Error',
          },
        }));
      }
    });
  }, [imeiList, imeiInfo]);

  const filteredHistory = history.filter((item) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      item.imei.includes(query) ||
      (item.modelName || '').toLowerCase().includes(query) ||
      (item.manufacturer || '').toLowerCase().includes(query)
    );
  });

  // Manejar click en elemento del historial
  const handleHistoryClick = async (item) => {
    haptics.selection();

    // Toggle: si ya está expandido, colapsar
    if (expandedHistoryImei === item.imei) {
      setExpandedHistoryImei(null);
      return;
    }

    // Si ya tiene datos extraídos, solo expandir
    if (item.extracted && Object.keys(item.extracted).length > 0) {
      setExpandedHistoryImei(item.imei);
      return;
    }

    // Si no tiene datos, hacer lookup
    setHistoryLoading((prev) => ({ ...prev, [item.imei]: true }));
    setExpandedHistoryImei(item.imei);

    try {
      const data = await fetchImeiInfo(item.imei);
      const extracted = data?.extracted || data?.raw?.extracted || {};
      const isApple = data?.isApple || false;

      // Actualizar historial con los nuevos datos
      const updatedHistory = history.map((h) =>
        h.imei === item.imei
          ? { ...h, extracted, isApple, fromCache: data?.fromCache || false }
          : h
      );
      persistHistory(updatedHistory);
    } catch (err) {
      console.error('[mo35] Error fetching history item:', err);
    } finally {
      setHistoryLoading((prev) => ({ ...prev, [item.imei]: false }));
    }
  };

  // Renderizar detalles de un elemento
  const renderDetails = (extracted, isApple, fromCache) => (
    <div className="mo35-ocr-details">
      {fromCache && <span className="mo35-ocr-cache-badge">Cache</span>}
      {isApple && <div className="mo35-ocr-badge mo35-ocr-badge--apple">Apple</div>}
      {extracted.serial_number && (
        <div className="mo35-ocr-detail">
          <span className="mo35-ocr-label">Serial:</span> {extracted.serial_number}
        </div>
      )}
      {extracted.sim_lock && (
        <div className="mo35-ocr-detail">
          <span className="mo35-ocr-label">SIM Lock:</span>
          <span className={`mo35-ocr-value ${extracted.sim_lock.toLowerCase().includes('unlock') ? 'mo35-ocr-value--good' : 'mo35-ocr-value--bad'}`}>
            {extracted.sim_lock}
          </span>
        </div>
      )}
      {extracted.locked_carrier && (
        <div className="mo35-ocr-detail">
          <span className="mo35-ocr-label">Carrier:</span> {extracted.locked_carrier}
        </div>
      )}
      {extracted.icloud_lock && (
        <div className="mo35-ocr-detail">
          <span className="mo35-ocr-label">iCloud:</span>
          <span className={`mo35-ocr-value ${extracted.icloud_lock.toLowerCase().includes('off') || extracted.icloud_lock.toLowerCase().includes('clean') ? 'mo35-ocr-value--good' : 'mo35-ocr-value--bad'}`}>
            {extracted.icloud_lock}
          </span>
        </div>
      )}
      {extracted.warranty_status && (
        <div className="mo35-ocr-detail">
          <span className="mo35-ocr-label">Garantia:</span> {extracted.warranty_status}
        </div>
      )}
      {extracted.purchase_country && (
        <div className="mo35-ocr-detail">
          <span className="mo35-ocr-label">Pais:</span> {extracted.purchase_country}
        </div>
      )}
      {extracted.estimated_purchase_date && (
        <div className="mo35-ocr-detail">
          <span className="mo35-ocr-label">Compra:</span> {extracted.estimated_purchase_date}
        </div>
      )}
      {extracted.replaced_device && extracted.replaced_device !== 'No' && (
        <div className="mo35-ocr-detail mo35-ocr-detail--warning">
          <span className="mo35-ocr-label">Reemplazado:</span> {extracted.replaced_device}
        </div>
      )}
      {extracted.demo_unit && extracted.demo_unit !== 'No' && (
        <div className="mo35-ocr-detail mo35-ocr-detail--warning">
          <span className="mo35-ocr-label">Demo:</span> {extracted.demo_unit}
        </div>
      )}
      {extracted.refurbished_device && extracted.refurbished_device !== 'No' && (
        <div className="mo35-ocr-detail mo35-ocr-detail--warning">
          <span className="mo35-ocr-label">Refurbished:</span> {extracted.refurbished_device}
        </div>
      )}
    </div>
  );

  const screen = (
    <div className={`mo35-ocr-screen ${fullScreen ? 'mo35-ocr-screen--full' : 'mo35-ocr-screen--inline'}`}>
      <div className="mo35-ocr-header">
        <div>
          <div className="mo35-ocr-title">mo35 OCR</div>
          <div className="mo35-ocr-subtitle">Detectar IMEI con camara</div>
        </div>
        <button className="btn-ghost" onClick={onClose}>
          Cerrar
        </button>
      </div>

      <div className="mo35-ocr-actions">
        <button className="btn-secondary" onClick={handleUpload} disabled={isActive}>
          Subir imagen
        </button>
        <button className="btn-secondary" onClick={handleClear} disabled={isActive}>
          Limpiar
        </button>
        <button className="btn-primary" onClick={startScan} disabled={isActive}>
          {isActive ? 'Escaneando...' : (hasScanned ? 'Escanear de nuevo' : 'Escanear IMEI')}
        </button>
      </div>

      {error && <div className="mo35-ocr-error">{error}</div>}

      <div className="mo35-ocr-panel">
        <div className="mo35-ocr-panel-title">IMEI detectados</div>
        {imeiList.length === 0 ? (
          <div className="mo35-ocr-empty">Aun no hay resultados</div>
        ) : (
          <div className="mo35-ocr-list">
            {imeiList.map((imei) => {
              const info = imeiInfo[imei];
              const raw = info?.raw;
              const extracted = raw?.extracted || raw?.raw?.extracted || {};
              const isApple = raw?.isApple || false;

              return (
                <div key={imei} className="mo35-ocr-item mo35-ocr-item--expanded">
                  <div className="mo35-ocr-imei-header">
                    <div className="mo35-ocr-imei">{imei}</div>
                    {raw?.fromCache && <span className="mo35-ocr-cache-badge">Cache</span>}
                  </div>
                  <div className="mo35-ocr-model">
                    {info?.modelName || 'Consultando...'}
                  </div>
                  {info?.manufacturer && info.manufacturer !== '-' && (
                    <div className="mo35-ocr-detail">
                      <span className="mo35-ocr-label">Fabricante:</span> {info.manufacturer}
                    </div>
                  )}
                  {info && !info.error && Object.keys(extracted).length > 0 && (
                    renderDetails(extracted, isApple, raw?.fromCache)
                  )}
                  {info?.error && (
                    <div className="mo35-ocr-error-inline">{info.error}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mo35-ocr-panel">
        <div className="mo35-ocr-panel-title">Historial de consultas</div>
        <input
          className="mo35-ocr-search"
          type="text"
          placeholder="Buscar IMEI o modelo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          list="mo35-ocr-suggestions"
        />
        <datalist id="mo35-ocr-suggestions">
          {history.slice(0, 20).map((item) => (
            <option key={item.imei} value={item.imei}>
              {item.modelName}
            </option>
          ))}
        </datalist>
        {filteredHistory.length === 0 ? (
          <div className="mo35-ocr-empty">Aun no hay historial</div>
        ) : (
          <div className="mo35-ocr-list">
            {filteredHistory.map((item) => {
              const isExpanded = expandedHistoryImei === item.imei;
              const isLoading = historyLoading[item.imei];
              const hasDetails = item.extracted && Object.keys(item.extracted).length > 0;

              return (
                <div
                  key={item.imei}
                  className={`mo35-ocr-item mo35-ocr-item--clickable ${isExpanded ? 'mo35-ocr-item--expanded' : ''}`}
                  onClick={() => handleHistoryClick(item)}
                >
                  <div className="mo35-ocr-imei-header">
                    <div className="mo35-ocr-imei">{item.imei}</div>
                    <span className={`mo35-ocr-expand-icon ${isExpanded ? 'mo35-ocr-expand-icon--open' : ''}`}>
                      {isLoading ? '...' : (isExpanded ? '▼' : '▶')}
                    </span>
                  </div>
                  <div className="mo35-ocr-model">{item.modelName}</div>
                  {item.manufacturer && item.manufacturer !== '-' && (
                    <div className="mo35-ocr-detail">
                      <span className="mo35-ocr-label">Fabricante:</span> {item.manufacturer}
                    </div>
                  )}
                  {isExpanded && isLoading && (
                    <div className="mo35-ocr-loading">Cargando detalles...</div>
                  )}
                  {isExpanded && hasDetails && renderDetails(item.extracted, item.isApple, item.fromCache)}
                  {isExpanded && !isLoading && !hasDetails && (
                    <div className="mo35-ocr-empty">Sin detalles disponibles</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lastText && (
        <div className="mo35-ocr-panel">
          <div className="mo35-ocr-panel-title">Ultimo texto</div>
          <div className="mo35-ocr-last">{lastText}</div>
        </div>
      )}
    </div>
  );

  if (!fullScreen) {
    return screen;
  }
  return portalTarget ? createPortal(screen, portalTarget) : screen;
}
