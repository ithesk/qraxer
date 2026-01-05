import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Ocr } from '@jcesarmobile/capacitor-ocr';
import haptics from '../services/haptics';

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
  const portalTarget = useMemo(() => (typeof document !== 'undefined' ? document.body : null), []);
  const HISTORY_KEY = 'mo35_imei_history_v1';

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
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      setHistory(saved);
    } catch (e) {}
  }, []);

  const persistHistory = (entries) => {
    setHistory(entries);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    } catch (e) {}
  };

  const upsertHistory = (imei, info) => {
    const now = Date.now();
    const entry = {
      imei,
      modelName: info?.modelName || 'Sin modelo',
      manufacturer: info?.manufacturer || '-',
      lastAt: now,
    };
    const next = [
      entry,
      ...history.filter((item) => item.imei !== imei),
    ].slice(0, 200);
    persistHistory(next);
  };

  const fetchImeiInfo = async (imei) => {
    const apiKey = import.meta.env.VITE_SICKW_KEY;
    const service = import.meta.env.VITE_SICKW_SERVICE || 'demo';
    if (!apiKey) {
      throw new Error('Falta VITE_SICKW_KEY');
    }
    const url = `https://sickw.com/api.php?format=beta&key=${encodeURIComponent(apiKey)}&imei=${encodeURIComponent(imei)}&service=${encodeURIComponent(service)}`;
    console.log('[mo35] Fetch IMEI:', imei, 'service:', service);

    if (isNative) {
      const response = await CapacitorHttp.request({
        url,
        method: 'GET',
      });
      if (response.status < 200 || response.status >= 300) {
        console.error('[mo35] Sickw error:', response.status, response.data);
        throw new Error(`Error API (${response.status})`);
      }
      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      console.log('[mo35] Sickw response:', data);
      return data;
    }

    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      console.error('[mo35] Sickw error:', response.status, body);
      throw new Error(`Error API (${response.status})`);
    }
    const data = await response.json();
    console.log('[mo35] Sickw response:', data);
    return data;
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
            {imeiList.map((imei) => (
              <div key={imei} className="mo35-ocr-item">
                <div className="mo35-ocr-imei">{imei}</div>
                <div className="mo35-ocr-model">
                  {imeiInfo[imei]?.modelName || 'Consultando...'}
                </div>
              </div>
            ))}
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
            {filteredHistory.map((item) => (
              <div key={item.imei} className="mo35-ocr-item">
                <div className="mo35-ocr-imei">{item.imei}</div>
                <div className="mo35-ocr-model">{item.modelName}</div>
              </div>
            ))}
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
