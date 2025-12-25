import { useState, useEffect } from 'react';
import { api } from './services/api';
import Login from './components/Login';
import Scanner from './components/Scanner';
import RepairConfirm from './components/RepairConfirm';
import Result from './components/Result';

const APP_VERSION = '1.4.0';

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
      <header className="header">
        <div className="header-content">
          {/* Left: Logo and App Name */}
          <div className="header-brand">
            <div className="header-logo">
              <QRLogoIcon />
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
        textAlign: 'center',
        padding: '8px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        opacity: 0.6
      }}>
        v{APP_VERSION}
      </footer>
    </>
  );
}
