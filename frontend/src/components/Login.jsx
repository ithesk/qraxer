import { useState } from 'react';
import { api } from '../services/api';

const QRIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="3" height="3" />
    <rect x="18" y="14" width="3" height="3" />
    <rect x="14" y="18" width="3" height="3" />
    <rect x="18" y="18" width="3" height="3" />
  </svg>
);

const AlertIcon = () => (
  <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await api.login(username, password);
      onSuccess(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 'calc(100vh - 120px)',
      justifyContent: 'center',
      padding: '20px 0'
    }}>
      {/* Logo/Branding */}
      <div style={{
        textAlign: 'center',
        marginBottom: '32px',
        color: 'var(--primary)'
      }}>
        <QRIcon />
        <h2 style={{
          fontSize: '28px',
          fontWeight: '700',
          marginTop: '16px',
          color: 'var(--text)',
          letterSpacing: '-0.5px'
        }}>
          Bienvenido
        </h2>
        <p style={{
          color: 'var(--text-secondary)',
          marginTop: '8px',
          fontSize: '15px'
        }}>
          Ingresa para escanear reparaciones
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="correo@empresa.com"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            enterKeyHint="next"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            autoComplete="current-password"
            enterKeyHint="go"
            required
          />
        </div>

        <div style={{ marginTop: '28px' }}>
          <button
            type="submit"
            className="btn-primary btn-large"
            disabled={loading || !username || !password}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Ingresando...</span>
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </div>
      </form>

      {/* Footer hint */}
      <p style={{
        marginTop: '24px',
        fontSize: '13px',
        color: 'var(--text-muted)',
        textAlign: 'center'
      }}>
        Usa tus credenciales de Odoo
      </p>
    </div>
  );
}
