import { useState, useEffect, useCallback } from 'react';

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const WarningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TOAST_STYLES = {
  success: {
    background: '#dcfce7',
    color: '#15803d',
    border: '1px solid #bbf7d0',
  },
  error: {
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
  },
  warning: {
    background: '#fff7ed',
    color: '#c2410c',
    border: '1px solid #fed7aa',
  },
};

const ICONS = {
  success: CheckIcon,
  error: ErrorIcon,
  warning: WarningIcon,
};

// Global toast state
let toastListener = null;
let toastQueue = [];

export const toast = {
  show(message, type = 'error', duration = 4000) {
    const id = Date.now();
    const newToast = { id, message, type, duration };
    toastQueue.push(newToast);
    if (toastListener) {
      toastListener([...toastQueue]);
    }
    return id;
  },
  success(message, duration) {
    return this.show(message, 'success', duration);
  },
  error(message, duration) {
    return this.show(message, 'error', duration);
  },
  warning(message, duration) {
    return this.show(message, 'warning', duration);
  },
  dismiss(id) {
    toastQueue = toastQueue.filter(t => t.id !== id);
    if (toastListener) {
      toastListener([...toastQueue]);
    }
  },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastListener = setToasts;
    return () => {
      toastListener = null;
    };
  }, []);

  const removeToast = useCallback((id) => {
    toast.dismiss(id);
  }, []);

  useEffect(() => {
    toasts.forEach((t) => {
      const timer = setTimeout(() => {
        removeToast(t.id);
      }, t.duration || 4000);

      return () => clearTimeout(timer);
    });
  }, [toasts, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 'max(20px, env(safe-area-inset-top))',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: 'calc(100% - 32px)',
      maxWidth: '400px',
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || ErrorIcon;
        const styles = TOAST_STYLES[t.type] || TOAST_STYLES.error;

        return (
          <div
            key={t.id}
            style={{
              ...styles,
              padding: '14px 16px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              animation: 'toastSlideIn 0.3s ease-out',
              pointerEvents: 'auto',
            }}
          >
            <Icon />
            <span style={{
              flex: 1,
              fontSize: '14px',
              fontWeight: '500',
              lineHeight: '1.4',
            }}>
              {t.message}
            </span>
            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                opacity: 0.6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'auto',
                color: 'inherit',
              }}
              aria-label="Cerrar"
            >
              <CloseIcon />
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
