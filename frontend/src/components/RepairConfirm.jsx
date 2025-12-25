import { useState } from 'react';
import { api } from '../services/api';

// Estados con labels actualizados de Odoo
const STATE_LABELS = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  ready: 'Listo',
  under_repair: 'En reparacion',
  '2binvoiced': 'Por facturar',
  done: 'Reparado',
  test: 'En pruebas',
  cancel: 'Cancelado',
  handover: 'Entregado',
  guarantee: 'En garantia',
};

// Estados finales donde no se muestra ningún botón de acción
const FINAL_STATES = ['cancel', 'handover'];

const ToolIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const BoxIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const WrenchIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const AlertIcon = () => (
  <svg className="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const InfoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export default function RepairConfirm({ repair, qrContent, onUpdate, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentState = repair.currentState;
  const isFinalState = FINAL_STATES.includes(currentState);
  const isUnderRepair = currentState === 'under_repair';

  // Determinar qué acción mostrar
  const getQuickAction = () => {
    if (isFinalState) {
      return null; // No mostrar botón en estados finales
    }

    if (isUnderRepair) {
      return {
        newState: 'done',
        label: 'Marcar como Reparado',
        description: 'El equipo ha sido reparado',
        icon: <CheckCircleIcon />,
        className: 'btn-success'
      };
    }

    // Para cualquier otro estado, permitir poner "En reparación"
    return {
      newState: 'under_repair',
      label: 'Iniciar Reparacion',
      description: 'Comenzar a trabajar en este equipo',
      icon: <WrenchIcon />,
      className: 'btn-primary'
    };
  };

  const quickAction = getQuickAction();

  const handleQuickAction = async () => {
    if (!quickAction) return;

    console.log('[RepairConfirm] Acción rápida:', quickAction.newState);
    setError('');
    setLoading(true);

    try {
      console.log('[RepairConfirm] Llamando API updateState...');
      const result = await api.updateState(qrContent, quickAction.newState, '');
      console.log('[RepairConfirm] API respondió:', result);
      onUpdate(result);
    } catch (err) {
      console.error('[RepairConfirm] Error:', err.message);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}

      {/* Repair Header Card */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--primary-light) 0%, var(--primary) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
          }}>
            <ToolIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Orden de Reparacion
            </div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--text)',
              letterSpacing: '-0.5px'
            }}>
              {repair.name}
            </h2>
          </div>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%'
        }}>
          <span className={`state-badge state-${currentState}`} style={{
            fontSize: '15px',
            padding: '10px 20px',
            fontWeight: '700'
          }}>
            {STATE_LABELS[currentState] || currentState}
          </span>
        </div>
      </div>

      {/* Repair Details Card */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: '700',
          color: 'var(--text)',
          marginBottom: '16px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Detalles
        </h3>

        {repair.product && (
          <div className="info-row">
            <span className="info-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BoxIcon />
              Producto
            </span>
            <span className="info-value" style={{
              maxWidth: '60%',
              wordBreak: 'break-word'
            }}>
              {repair.product}
            </span>
          </div>
        )}

        {repair.partner && (
          <div className="info-row">
            <span className="info-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserIcon />
              Cliente
            </span>
            <span className="info-value" style={{
              maxWidth: '60%',
              wordBreak: 'break-word'
            }}>
              {repair.partner}
            </span>
          </div>
        )}

        {repair.description && (
          <div style={{
            paddingTop: '14px',
            borderTop: repair.product || repair.partner ? '1px solid var(--border-light)' : 'none'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px'
            }}>
              <FileTextIcon />
              <span style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                fontWeight: '600'
              }}>
                Descripcion
              </span>
            </div>
            <p style={{
              fontSize: '15px',
              color: 'var(--text)',
              lineHeight: '1.6',
              marginLeft: '26px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {repair.description}
            </p>
          </div>
        )}
      </div>

      {/* Quick Action or Final State Message */}
      {isFinalState ? (
        /* Estado final - Solo mostrar información */
        <div className="card" style={{
          marginBottom: '20px',
          background: 'var(--border-light)',
          textAlign: 'center',
          padding: '28px 24px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--text-secondary)'
          }}>
            <InfoIcon />
          </div>
          <p style={{
            color: 'var(--text)',
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '8px'
          }}>
            Estado Final
          </p>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            Este equipo esta en estado <strong>{STATE_LABELS[currentState] || currentState}</strong>.
            <br />
            No se pueden realizar mas acciones.
          </p>
        </div>
      ) : quickAction && (
        /* Botón de acción rápida */
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: quickAction.className === 'btn-success'
                ? 'rgba(22, 163, 74, 0.1)'
                : 'rgba(37, 99, 235, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: quickAction.className === 'btn-success'
                ? 'var(--success)'
                : 'var(--primary)'
            }}>
              {quickAction.icon}
            </div>
            <div>
              <h4 style={{
                fontSize: '17px',
                fontWeight: '700',
                color: 'var(--text)',
                marginBottom: '2px'
              }}>
                Accion rapida
              </h4>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                margin: 0
              }}>
                {quickAction.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleQuickAction}
            className={`${quickAction.className} btn-large`}
            disabled={loading}
            aria-busy={loading}
            style={{
              width: '100%',
              marginTop: '16px'
            }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Actualizando...</span>
              </>
            ) : (
              <>
                {quickAction.icon}
                <span>{quickAction.label}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Volver Button */}
      <div className="bottom-actions">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary btn-large"
          disabled={loading}
        >
          <ArrowLeftIcon />
          <span>Escanear otro</span>
        </button>
      </div>
    </div>
  );
}
