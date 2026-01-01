import { useState, useEffect } from 'react';
import { api } from '../services/api';
import haptics from '../services/haptics';
import biometrics from '../services/biometrics';

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

const FaceIdIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M7 3H5a2 2 0 0 0-2 2v2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M17 21h2a2 2 0 0 0 2-2v-2" />
    <circle cx="9" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="9" r="1" fill="currentColor" />
    <path d="M9 15c.83.67 1.83 1 3 1s2.17-.33 3-1" />
  </svg>
);

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState('');
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);

  // Check biometrics on mount
  useEffect(() => {
    checkBiometrics();
    const savedUsername = localStorage.getItem('savedUsername') || localStorage.getItem('biometrics_username');
    const savedPassword = localStorage.getItem('savedPassword');
    const rememberFlag = localStorage.getItem('rememberMe') === 'true';
    if (savedUsername) {
      setUsername(savedUsername);
    }
    if (rememberFlag && savedPassword) {
      setPassword(savedPassword);
    }
    setRememberMe(rememberFlag || !!savedUsername);
  }, []);

  const checkBiometrics = async () => {
    const result = await biometrics.isAvailable();
    setBiometricsAvailable(result.available);
    setBiometryType(result.typeName || 'Face ID');

    if (result.available) {
      const hasStored = await biometrics.hasStored();
      setHasStoredCredentials(hasStored);

      // Auto-trigger Face ID if credentials are stored
      if (hasStored) {
        setTimeout(() => loginWithBiometrics(), 500);
      }
    }
  };

  const loginWithBiometrics = async () => {
    setError('');
    setLoading(true);
    haptics.impact();

    try {
      const credentials = await biometrics.get();

      if (credentials && credentials.username && credentials.password) {
        // Login with stored credentials
        const user = await api.login(credentials.username, credentials.password);
        console.log('[Login] Sesión iniciada con Face ID:', user.name);
        haptics.success();
        onSuccess(user);
      } else {
        setError('No se encontraron credenciales guardadas');
        haptics.error();
      }
    } catch (err) {
      console.error('[Login] Biometric error:', err.message);
      // Don't show error for user cancellation
      if (!err.message?.includes('cancel')) {
        setError('Error de autenticación biométrica');
        haptics.error();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Initialize haptics on first user interaction (required for iOS audio)
    haptics.init();
    haptics.impact();

    try {
      const user = await api.login(username, password);
      console.log('[Login] Sesión iniciada:', user);

      // Save credentials if remember me is checked
      console.log('[Login] rememberMe:', rememberMe, 'biometricsAvailable:', biometricsAvailable);
      if (rememberMe && biometricsAvailable) {
        console.log('[Login] Intentando guardar credenciales para Face ID...');
        const saved = await biometrics.save(username, password);
        console.log('[Login] Resultado de guardar credenciales:', saved);
        if (saved) {
          console.log('[Login] Credenciales guardadas para Face ID exitosamente');
          setHasStoredCredentials(true);
        } else {
          console.error('[Login] Fallo al guardar credenciales');
        }
      }
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedUsername', username);
        if (!biometricsAvailable) {
          localStorage.setItem('savedPassword', password);
        } else {
          localStorage.removeItem('savedPassword');
        }
      } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedUsername');
        localStorage.removeItem('savedPassword');
      }

      haptics.success();
      onSuccess(user);
    } catch (err) {
      console.error('[Login] Error:', err.message);
      haptics.error();
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

      {/* Face ID Button - Show if credentials are stored */}
      {biometricsAvailable && hasStoredCredentials && (
        <div style={{ marginBottom: '24px' }}>
          <button
            type="button"
            onClick={loginWithBiometrics}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '16px 24px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
            }}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                <span>Verificando...</span>
              </>
            ) : (
              <>
                <FaceIdIcon size={24} />
                <span>Usar {biometryType}</span>
              </>
            )}
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginTop: '20px',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span>o ingresa manualmente</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
        </div>
      )}

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

        {/* Remember me checkbox - only show if biometrics available */}
        {biometricsAvailable && !hasStoredCredentials && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginTop: '16px',
          }}>
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                accentColor: 'var(--primary)',
              }}
            />
            <label
              htmlFor="rememberMe"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              <FaceIdIcon size={18} />
              Recordar con {biometryType}
            </label>
          </div>
        )}

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

      {/* Version */}
      <p style={{
        marginTop: '8px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        textAlign: 'center',
        opacity: 0.6,
      }}>
        v2.1.0
      </p>
    </div>
  );
}
