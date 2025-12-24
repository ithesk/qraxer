import { useState, useEffect } from 'react';
import { api } from './services/api';
import Login from './components/Login';
import Scanner from './components/Scanner';
import RepairConfirm from './components/RepairConfirm';
import Result from './components/Result';

const VIEWS = {
  LOGIN: 'login',
  SCANNER: 'scanner',
  CONFIRM: 'confirm',
  RESULT: 'result',
};

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

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
        <h1>QRaxer</h1>
        {user && (
          <div className="header-subtitle" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <UserIcon />
            <span>{user.name || user.username}</span>
          </div>
        )}
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
    </>
  );
}
