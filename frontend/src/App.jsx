import { useState, useEffect, lazy, Suspense } from 'react';
import { api } from './services/api';
import Login from './components/Login';
import ToastContainer, { toast } from './components/Toast';
import ConnectionDot from './components/ConnectionDot';
import OfflineBanner from './components/OfflineBanner';
import BottomNav from './components/BottomNav';
import Mo35OcrScreen from './components/Mo35OcrScreen';
import ProfileScreen from './components/ProfileScreen';

// Lazy load heavy components
const Scanner = lazy(() => import('./components/Scanner'));
const RepairConfirm = lazy(() => import('./components/RepairConfirm'));
const Result = lazy(() => import('./components/Result'));
const QuickCreator = lazy(() => import('./components/QuickCreator/QuickCreator'));
const ProductScanner = lazy(() => import('./components/ProductScanner'));
const InventoryCountPage = lazy(() => import('./pages/InventoryCountPage'));

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

// Scanner tab sub-views
const SCANNER_VIEWS = {
  SCANNER: 'scanner',
  CONFIRM: 'confirm',
  RESULT: 'result',
};

// Loading spinner for lazy components
const LazySpinner = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px'
  }}>
    <div className="spinner spinner-dark" />
  </div>
);

// Logo QR icon
const QRLogoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none" />
    <rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none" />
    <rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none" />
    <rect x="14" y="14" width="3" height="3" />
    <rect x="18" y="18" width="3" height="3" />
  </svg>
);

// Logout icon
const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

// Notification bell icon
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

// User avatar with initials
const UserAvatar = ({ user }) => {
  const getInitials = () => {
    if (user.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user.username ? user.username[0].toUpperCase() : 'U';
  };

  return (
    <div className="user-avatar">
      {getInitials()}
    </div>
  );
};

// Persistent storage keys
const STORAGE_KEYS = {
  ACTIVE_TAB: 'qraxer_active_tab',
};

export default function App() {
  // Splash state
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [showProfileScreen, setShowProfileScreen] = useState(false);
  const [showMo35Ocr, setShowMo35Ocr] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Tab navigation - restore from localStorage
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    return saved && ['scanner', 'creator', 'products', 'inventory', 'mo35'].includes(saved) ? saved : 'scanner';
  });

  // Scanner tab state
  const [scannerView, setScannerView] = useState(SCANNER_VIEWS.SCANNER);
  const [scanData, setScanData] = useState(null);
  const [qrContent, setQrContent] = useState(null);
  const [result, setResult] = useState(null);

  const handleProfile = () => {
    toast.info('Perfil: pronto');
  };

  const handleSettings = () => {
    toast.info('Ajustes: pronto');
  };

  const openProfileScreen = () => {
    setShowProfileScreen(true);
  };

  const closeProfileScreen = () => {
    setShowProfileScreen(false);
  };

  // Check auth and hide splash
  useEffect(() => {
    const initApp = async () => {
      // Check authentication
      if (api.isAuthenticated()) {
        setUser(api.getUser());
        setIsLoggedIn(true);
      }
      setAuthChecked(true);

      // Minimum splash time for smooth UX
      await new Promise(resolve => setTimeout(resolve, 800));

      // Fade out splash
      setSplashFading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      setShowSplash(false);
    };

    initApp();
  }, []);

  // Persist active tab
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
  }, [activeTab]);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await api.logout();
    setUser(null);
    setScanData(null);
    setQrContent(null);
    setResult(null);
    setIsLoggedIn(false);
    setActiveTab('scanner');
    setScannerView(SCANNER_VIEWS.SCANNER);
  };

  const handleNotifications = () => {
    toast.show('Notificaciones pronto', 'warning', 2000);
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  const openMo35Ocr = () => {
    setShowMo35Ocr(true);
  };

  const closeMo35Ocr = () => {
    setShowMo35Ocr(false);
  };

  // Scanner tab handlers
  const handleScan = (data, qr) => {
    setScanData(data);
    setQrContent(qr);
    setScannerView(SCANNER_VIEWS.CONFIRM);
  };

  const handleUpdate = (updateResult) => {
    setResult(updateResult);
    setScannerView(SCANNER_VIEWS.RESULT);
  };

  const handleNewScan = () => {
    setScanData(null);
    setQrContent(null);
    setResult(null);
    setScannerView(SCANNER_VIEWS.SCANNER);
  };

  const handleCancel = () => {
    setScanData(null);
    setQrContent(null);
    setScannerView(SCANNER_VIEWS.SCANNER);
  };

  // Tab change handler - reset scanner view when switching tabs
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'scanner') {
      setScannerView(SCANNER_VIEWS.SCANNER);
    }
  };

  // Show splash screen
  if (showSplash) {
    return <SplashScreen fading={splashFading} />;
  }

  return (
    <>
      <ToastContainer />
      <OfflineBanner />
      {!showProfileScreen && (
        <header className="header">
          <div className="header-content">
            {/* Minimal header: app icon, notifications, avatar */}
            <div className="header-minimal">
              <button
                className="header-logo header-logo-button"
                onClick={openMo35Ocr}
                aria-label="Abrir OCR mo35"
                style={{ position: 'relative' }}
              >
                <QRLogoIcon />
                <ConnectionDot />
              </button>
              {user && (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="btn-icon btn-secondary header-notification-button"
                    onClick={handleNotifications}
                    aria-label="Notificaciones"
                  >
                    <BellIcon />
                  </button>
                  <div
                    className="header-user"
                    onClick={openProfileScreen}
                    style={{ cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && openProfileScreen()}
                  >
                    <UserAvatar user={user} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <main className={showProfileScreen ? 'main-content profile-screen-main' : 'container main-content'}>
        {!isLoggedIn && (
          <Login onSuccess={handleLogin} />
        )}

        {isLoggedIn && showProfileScreen && (
          <ProfileScreen
            user={user}
            version={APP_VERSION}
            onBack={closeProfileScreen}
            onProfile={handleProfile}
            onSettings={handleSettings}
            onLogout={handleLogout}
          />
        )}

        {isLoggedIn && !showProfileScreen && activeTab === 'scanner' && (
          <Suspense fallback={<LazySpinner />}>
            {scannerView === SCANNER_VIEWS.SCANNER && (
              <Scanner onScan={handleScan} />
            )}

            {scannerView === SCANNER_VIEWS.CONFIRM && scanData && (
              <RepairConfirm
                repair={scanData.repair}
                qrContent={qrContent}
                onUpdate={handleUpdate}
                onCancel={handleCancel}
              />
            )}

            {scannerView === SCANNER_VIEWS.RESULT && result && (
              <Result result={result} onNewScan={handleNewScan} />
            )}
          </Suspense>
        )}

        {isLoggedIn && !showProfileScreen && activeTab === 'creator' && (
          <Suspense fallback={<LazySpinner />}>
            <QuickCreator />
          </Suspense>
        )}

        {isLoggedIn && !showProfileScreen && activeTab === 'products' && (
          <Suspense fallback={<LazySpinner />}>
            <ProductScanner />
          </Suspense>
        )}

        {isLoggedIn && !showProfileScreen && activeTab === 'inventory' && (
          <Suspense fallback={<LazySpinner />}>
            <InventoryCountPage />
          </Suspense>
        )}

        {isLoggedIn && !showProfileScreen && activeTab === 'mo35' && (
          <Mo35OcrScreen onClose={() => setActiveTab('scanner')} fullScreen={false} />
        )}
      </main>

      {isLoggedIn && !showProfileScreen && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      <footer className="app-footer" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        padding: '8px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        opacity: 0.6
      }}>
        <span>v{APP_VERSION}</span>
        <VersionUpdateDot currentVersion={APP_VERSION} />
      </footer>

      {showMo35Ocr && (
        <Mo35OcrScreen onClose={closeMo35Ocr} />
      )}
    </>
  );
}

// Splash Screen Component
function SplashScreen({ fading }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      zIndex: 9999,
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.3s ease-out'
    }}>
      {/* Logo */}
      <div style={{
        width: '80px',
        height: '80px',
        background: 'white',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="5" y="5" width="3" height="3" fill="#2563eb" stroke="none" />
          <rect x="16" y="5" width="3" height="3" fill="#2563eb" stroke="none" />
          <rect x="5" y="16" width="3" height="3" fill="#2563eb" stroke="none" />
          <rect x="14" y="14" width="3" height="3" />
          <rect x="18" y="18" width="3" height="3" />
        </svg>
      </div>

      {/* App Name */}
      <h1 style={{
        color: 'white',
        fontSize: '28px',
        fontWeight: '700',
        margin: '0 0 8px 0',
        letterSpacing: '-0.5px'
      }}>
        QRaxer
      </h1>

      {/* Tagline */}
      <p style={{
        color: 'rgba(255,255,255,0.8)',
        fontSize: '14px',
        margin: 0
      }}>
        Escáner de Reparaciones
      </p>

      {/* Loading indicator */}
      <div style={{
        marginTop: '40px',
        width: '24px',
        height: '24px',
        border: '3px solid rgba(255,255,255,0.3)',
        borderTopColor: 'white',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
    </div>
  );
}

// Small dot indicator for version updates
function VersionUpdateDot({ currentVersion }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    checkForUpdates();
    const interval = setInterval(checkForUpdates, 60000);
    const handleFocus = () => checkForUpdates();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentVersion]);

  const checkForUpdates = async () => {
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data.version && data.version !== currentVersion) {
          setUpdateAvailable(true);
        }
      }
    } catch (e) {
      // Silent fail
    }
  };

  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    }
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    window.location.reload(true);
  };

  if (!updateAvailable) return null;

  return (
    <button
      onClick={handleUpdate}
      title="Nueva versión disponible - Toca para actualizar"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: 'var(--primary)',
        color: 'white',
        border: 'none',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '10px',
        fontWeight: '600',
        cursor: 'pointer',
        minHeight: 'auto',
        animation: 'pulse 2s infinite'
      }}
    >
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: '#4ade80'
      }} />
      Actualizar
    </button>
  );
}
