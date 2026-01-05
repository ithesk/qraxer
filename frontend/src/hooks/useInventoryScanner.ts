import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { fetchProductByBarcode, submitCounts } from '../services/inventory';
import haptics from '../services/haptics';

export type InventoryLine = {
  barcode: string;
  productId: number | null;
  name: string;
  qty: number;
  lastAt: number;
};

type ProductCacheEntry = {
  id: number | null;
  name: string;
};

const PRODUCT_CACHE_KEY = 'inv_product_cache_v1';
const DRAFT_KEY_PREFIX = 'inv_count_draft_v1';
const DEFAULT_COOLDOWN_MS = 650;

const sortByLastAt = (lines: InventoryLine[]) => {
  return [...lines].sort((a, b) => b.lastAt - a.lastAt);
};

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Ignore storage errors (quota/private mode)
  }
};

type InventoryScannerOptions = {
  cooldownMs?: number;
  sessionId?: string;
};

export const useInventoryScanner = (options: InventoryScannerOptions = {}) => {
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const sessionId = options.sessionId ?? 'default';
  const [isActive, setIsActive] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [lines, setLines] = useState<InventoryLine[]>([]);

  const productCacheRef = useRef<Record<string, ProductCacheEntry>>({});
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const pendingFetchRef = useRef<Set<string>>(new Set());
  const skipPersistRef = useRef(true);
  const lastSessionIdRef = useRef(sessionId);

  useEffect(() => {
    productCacheRef.current = readJson(PRODUCT_CACHE_KEY, {});
    const draftLines = readJson<InventoryLine[]>(
      `${DRAFT_KEY_PREFIX}_${sessionId}`,
      []
    );
    if (draftLines.length > 0) {
      setLines(sortByLastAt(draftLines));
    }
    skipPersistRef.current = true;
  }, []);

  useEffect(() => {
    if (lastSessionIdRef.current !== sessionId) {
      lastSessionIdRef.current = sessionId;
      skipPersistRef.current = true;
    }
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    writeJson(`${DRAFT_KEY_PREFIX}_${sessionId}`, lines);
  }, [lines, sessionId]);

  useEffect(() => {
    const draftLines = readJson<InventoryLine[]>(
      `${DRAFT_KEY_PREFIX}_${sessionId}`,
      []
    );
    setLines(sortByLastAt(draftLines));
    setLastCode(null);
    skipPersistRef.current = true;
  }, [sessionId]);

  const persistProductCache = useCallback(() => {
    writeJson(PRODUCT_CACHE_KEY, productCacheRef.current);
  }, []);

  const upsertLine = useCallback((barcode: string, entry?: ProductCacheEntry, delta = 1) => {
    setLines((prev) => {
      const now = Date.now();
      const next = [...prev];
      const index = next.findIndex((line) => line.barcode === barcode);
      if (index >= 0) {
        const updated = { ...next[index] };
        updated.qty = Math.max(0, updated.qty + delta);
        updated.lastAt = now;
        if (entry) {
          updated.name = entry.name;
          updated.productId = entry.id;
        }
        if (updated.qty === 0) {
          next.splice(index, 1);
        } else {
          next[index] = updated;
        }
      } else if (delta > 0) {
        next.push({
          barcode,
          productId: entry?.id ?? null,
          name: entry?.name ?? `Codigo ${barcode}`,
          qty: delta,
          lastAt: now,
        });
      }
      return sortByLastAt(next);
    });
  }, []);

  const handleBarcode = useCallback(async (barcode: string) => {
    if (!barcode) return;
    const now = Date.now();
    const lastSeen = cooldownRef.current.get(barcode) || 0;
    if (now - lastSeen < cooldownMs) return;
    cooldownRef.current.set(barcode, now);
    setLastCode(barcode);
    haptics.scanDetected();

    const cached = productCacheRef.current[barcode];
    if (cached) {
      upsertLine(barcode, cached, 1);
      return;
    }

    if (pendingFetchRef.current.has(barcode)) {
      return;
    }
    pendingFetchRef.current.add(barcode);

    try {
      const fetched = await fetchProductByBarcode(barcode);
      const entry = fetched ?? { id: null, name: `Codigo ${barcode}` };
      productCacheRef.current[barcode] = entry;
      persistProductCache();
      upsertLine(barcode, entry, 1);
    } finally {
      pendingFetchRef.current.delete(barcode);
    }
  }, [cooldownMs, persistProductCache, upsertLine]);

  const start = useCallback(async () => {
    if (isActive) return;
    const permission = await BarcodeScanner.requestPermissions();
    if (permission.camera !== 'granted') {
      throw new Error('Camera permission denied');
    }

    document.body.classList.add('barcode-scanning-active');
    document.documentElement.classList.add('barcode-scanning-active');
    try {
      await BarcodeScanner.addListener('barcodeScanned', (result) => {
        const rawValue =
          result?.barcode?.rawValue ||
          result?.barcodes?.[0]?.rawValue ||
          result?.barcode?.displayValue ||
          result?.barcodes?.[0]?.displayValue ||
          '';
        handleBarcode(rawValue);
      });

      const videoElement = document.getElementById('inventory-scan-video') as HTMLVideoElement | null;
      await BarcodeScanner.startScan(videoElement ? { videoElement } : {});
      setIsActive(true);
    } catch (err) {
      document.body.classList.remove('barcode-scanning-active');
      document.documentElement.classList.remove('barcode-scanning-active');
      await BarcodeScanner.removeAllListeners();
      throw err;
    }
  }, [handleBarcode, isActive]);

  const stop = useCallback(async () => {
    if (!isActive) return;
    await BarcodeScanner.removeAllListeners();
    await BarcodeScanner.stopScan();
    document.body.classList.remove('barcode-scanning-active');
    document.documentElement.classList.remove('barcode-scanning-active');
    setIsActive(false);
  }, [isActive]);

  const inc = useCallback((barcode: string) => {
    const cached = productCacheRef.current[barcode];
    upsertLine(barcode, cached, 1);
  }, [upsertLine]);

  const dec = useCallback((barcode: string) => {
    const cached = productCacheRef.current[barcode];
    upsertLine(barcode, cached, -1);
  }, [upsertLine]);

  const clear = useCallback(() => {
    setLines([]);
    writeJson(`${DRAFT_KEY_PREFIX}_${sessionId}`, []);
  }, [sessionId]);

  const submit = useCallback(async () => {
    if (lines.length === 0) return;
    const snapshot = [...lines];
    await submitCounts(lines);
    setLines([]);
    writeJson(`${DRAFT_KEY_PREFIX}_${sessionId}`, []);
    return snapshot;
  }, [lines, sessionId]);

  const totalItems = useMemo(() => {
    return lines.reduce((sum, line) => sum + line.qty, 0);
  }, [lines]);

  useEffect(() => {
    return () => {
      BarcodeScanner.removeAllListeners();
      BarcodeScanner.stopScan();
      document.body.classList.remove('barcode-scanning-active');
      document.documentElement.classList.remove('barcode-scanning-active');
    };
  }, []);

  return {
    start,
    stop,
    isActive,
    lastCode,
    lines,
    totalItems,
    inc,
    dec,
    clear,
    submit,
  };
};
