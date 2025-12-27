import { useState, useEffect } from 'react';
import { api } from './services/api';
import Login from './components/Login';
import Scanner from './components/Scanner';
import RepairConfirm from './components/RepairConfirm';
import Result from './components/Result';
import ToastContainer from './components/Toast';
import ConnectionDot from './components/ConnectionDot';
import OfflineBanner from './components/OfflineBanner';
import BottomNav from './components/BottomNav';
import QuickCreator from './components/QuickCreator/QuickCreator';
import History from './components/History';
import ProductScanner from './components/ProductScanner';

const APP_VERSION = '2.1.6-exp';

// Scanner tab sub-views
const SCANNER_VIEWS = {
  SCANNER: 'scanner',
  CONFIRM: 'confirm',
  RESULT: 'result',
};

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
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Tab navigation - restore from localStorage
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    return saved && ['scanner', 'creator', 'products', 'history'].includes(saved) ? saved : 'scanner';
  });

  // Scanner tab state
  const [scannerView, setScannerView] = useState(SCANNER_VIEWS.SCANNER);
  const [scanData, setScanData] = useState(null);
  const [qrContent, setQrContent] = useState(null);
  const [result, setResult] = useState(null);

  // Persist active tab
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (api.isAuthenticated()) {
      setUser(api.getUser());
      setIsLoggedIn(true);
    }
  }, []);

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

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  // Scanner tab handlers
  const handleScan = (data, qr) => {
    setScanData(data);
    setQrContent(qr);
    setScannerView(SCANNER_VIEWS.CONFIRM);
  };

  const handleUpdate = (updateResult) => {
    console.log('[App] handleUpdate recibido:', updateResult);
    setResult(updateResult);
    setScannerView(SCANNER_VIEWS.RESULT);
    console.log('[App] Vista cambiada a RESULT');
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

  return (
    <>
      <ToastContainer />
      <OfflineBanner />
      <header className="header">
        <div className="header-content">
          {/* Left: Logo and App Name */}
          <div className="header-brand">
            <div className="header-logo" style={{ position: 'relative' }}>
              <QRLogoIcon />
              <ConnectionDot />
            </div>
            <div className="header-titles">
              <h1 className="header-title">QRaxer</h1>
              <p className="header-tagline">Escáner de Reparaciones</p>
            </div>
          </div>

          {/* Right: User Info with Dropdown */}
          {user && (
            <div style={{ position: 'relative' }}>
              <div
                className="header-user"
                onClick={toggleUserMenu}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleUserMenu()}
              >
                <UserAvatar user={user} />
                <span className="header-user-name">{user.name || user.username}</span>
              </div>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <>
                  {/* Backdrop to close menu */}
                  <div
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 99
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: 'white',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                    border: '1px solid var(--border-light)',
                    minWidth: '160px',
                    zIndex: 100,
                    overflow: 'hidden'
                  }}>
                    <button
                      onClick={handleLogout}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: 'var(--error)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <LogoutIcon />
                      Cerrar sesion
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="container main-content">
        {!isLoggedIn && (
          <Login onSuccess={handleLogin} />
        )}

        {isLoggedIn && activeTab === 'scanner' && (
          <>
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
          </>
        )}

        {isLoggedIn && activeTab === 'creator' && (
          <QuickCreator />
        )}

        {isLoggedIn && activeTab === 'products' && (
          <ProductScanner />
        )}

        {isLoggedIn && activeTab === 'history' && (
          <History />
        )}
      </main>

      {isLoggedIn && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      <footer style={{
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
    </>
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
    console.log('[VersionCheck] Verificando actualizaciones...');
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      console.log('[VersionCheck] Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[VersionCheck] Versión en servidor:', data.version, '- Versión actual:', currentVersion);
        if (data.version && data.version !== currentVersion) {
          console.log('[VersionCheck] Nueva versión disponible!');
          setUpdateAvailable(true);
        } else {
          console.log('[VersionCheck] Ya tienes la última versión');
        }
      } else {
        console.log('[VersionCheck] Error en respuesta:', response.statusText);
      }
    } catch (e) {
      console.error('[VersionCheck] Error:', e.message);
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
