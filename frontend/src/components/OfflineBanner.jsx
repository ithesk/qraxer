import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { queueProcessor } from '../services/queueProcessor';
import { orderQueue } from '../services/orderQueue';

// Wifi Off icon
const WifiOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

// Check icon
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(null); // null = checking
  const [showReconnected, setShowReconnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOfflineRef = useRef(false);

  // Subscribe to queue changes to show pending count
  useEffect(() => {
    const unsubscribe = orderQueue.subscribe(async () => {
      const pending = await orderQueue.getPendingOrders();
      setPendingCount(pending.length);
    });

    // Initial count
    orderQueue.getPendingOrders().then(pending => {
      setPendingCount(pending.length);
    });

    return unsubscribe;
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      const result = await api.checkConnection();
      const newOnlineState = result.online;

      // Show reconnected message if we were offline and now online
      if (wasOfflineRef.current && newOnlineState) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);

        // SYNC QUEUE when connection is restored
        console.log('[OfflineBanner] Connection restored, triggering queue sync...');
        setIsSyncing(true);
        try {
          const syncResult = await queueProcessor.processQueue();
          console.log('[OfflineBanner] Sync result:', syncResult);
        } catch (e) {
          console.error('[OfflineBanner] Sync error:', e);
        } finally {
          setIsSyncing(false);
        }
      }

      if (!newOnlineState) {
        wasOfflineRef.current = true;
      }

      setIsOnline(newOnlineState);
    } catch (e) {
      wasOfflineRef.current = true;
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 15000);

    const handleOnline = () => checkConnection();
    const handleOffline = () => {
      wasOfflineRef.current = true;
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', checkConnection);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', checkConnection);
    };
  }, [checkConnection]);

  // Show reconnected message with sync status
  if (showReconnected) {
    return (
      <div
        className="fade-in"
        style={{
          position: 'fixed',
          top: 'max(60px, env(safe-area-inset-top))',
          left: '16px',
          right: '16px',
          padding: '12px 16px',
          background: 'var(--success)',
          color: 'white',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          fontWeight: '500',
          zIndex: 150,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {isSyncing ? (
          <>
            <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
            <span>Sincronizando órdenes pendientes...</span>
          </>
        ) : (
          <>
            <CheckIcon />
            <span>Conexión restaurada</span>
          </>
        )}
      </div>
    );
  }

  // Don't show anything if online or still checking
  if (isOnline === null || isOnline === true) return null;

  return (
    <div
      className="fade-in"
      style={{
        position: 'fixed',
        top: 'max(60px, env(safe-area-inset-top))',
        left: '16px',
        right: '16px',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        border: '1px solid #f59e0b',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 150,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: 'var(--radius-full)',
        background: '#f59e0b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        flexShrink: 0,
      }}>
        <WifiOffIcon />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#92400e',
          marginBottom: '2px',
        }}>
          Sin conexión
        </div>
        <div style={{
          fontSize: '12px',
          color: '#a16207',
        }}>
          {pendingCount > 0
            ? `${pendingCount} orden${pendingCount > 1 ? 'es' : ''} pendiente${pendingCount > 1 ? 's' : ''} de sincronizar`
            : 'Algunas funciones no están disponibles'}
        </div>
      </div>
    </div>
  );
}
