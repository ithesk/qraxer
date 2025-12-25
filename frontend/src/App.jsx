import { useState, useEffect } from 'react';
import { api } from './services/api';
import Login from './components/Login';
import Scanner from './components/Scanner';
import RepairConfirm from './components/RepairConfirm';
import Result from './components/Result';
import ToastContainer from './components/Toast';
import ConnectionDot from './components/ConnectionDot';

const APP_VERSION = '1.4.2';

const VIEWS = {
  LOGIN: 'login',
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

export default function App() {
  const [view, setView] = useState(VIEWS.LOGIN);
  const [user, setUser] = useState(null);
  const [scanData, setScanData] = useState(null);
  const [qrContent, setQrContent] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (api.isAuthenticated()) {
      setUser(api.getUser());
      setView(VIEWS.SCANNER);
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setView(VIEWS.SCANNER);
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setScanData(null);
    setQrContent(null);
    setResult(null);
    setView(VIEWS.LOGIN);
  };

  const handleScan = (data, qr) => {
    setScanData(data);
    setQrContent(qr);
    setView(VIEWS.CONFIRM);
  };

  const handleUpdate = (updateResult) => {
    setResult(updateResult);
    setView(VIEWS.RESULT);
  };

  const handleNewScan = () => {
    setScanData(null);
    setQrContent(null);
    setResult(null);
    setView(VIEWS.SCANNER);
  };

  const handleCancel = () => {
    setScanData(null);
    setQrContent(null);
    setView(VIEWS.SCANNER);
  };

  return (
    <>
      <ToastContainer />
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

          {/* Right: User Info */}
          {user && (
            <div className="header-user">
              <UserAvatar user={user} />
              <span className="header-user-name">{user.name || user.username}</span>
            </div>
          )}
        </div>
      </header>

      <main className="container" style={{ flex: 1 }}>
        {view === VIEWS.LOGIN && (
          <Login onSuccess={handleLogin} />
        )}

        {view === VIEWS.SCANNER && (
          <Scanner onScan={handleScan} onLogout={handleLogout} />
        )}

        {view === VIEWS.CONFIRM && scanData && (
          <RepairConfirm
            repair={scanData.repair}
            qrContent={qrContent}
            onUpdate={handleUpdate}
            onCancel={handleCancel}
          />
        )}

        {view === VIEWS.RESULT && result && (
          <Result result={result} onNewScan={handleNewScan} />
        )}
      </main>

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
