import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export default function ConnectionDot() {
  const [online, setOnline] = useState(null);

  const checkConnection = useCallback(async () => {
    const result = await api.checkConnection();
    setOnline(result.online);
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    const handleOnline = () => checkConnection();
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleOnline);
    };
  }, [checkConnection]);

  const getColor = () => {
    if (online === null) return '#9ca3af'; // gray - checking
    return online ? '#22c55e' : '#ef4444'; // green or red
  };

  return (
    <span
      title={online === null ? 'Verificando...' : online ? 'Conectado' : 'Sin conexión'}
      style={{
        position: 'absolute',
        bottom: '-2px',
        right: '-2px',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: getColor(),
        border: '2px solid white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}
    />
  );
}
