import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SkeletonHistoryList } from './Skeleton';
import haptics from '../services/haptics';
import { toast } from './Toast';

// WhatsApp icon
const WhatsAppIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// Check icon for copy feedback
const CheckSmallIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Edit/Change state icon
const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

// Close icon
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Copy icon
const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// Phone icon
const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

// State labels and colors
const STATE_CONFIG = {
  draft: { label: 'Presupuesto', bg: '#f1f5f9', color: '#475569' },
  confirmed: { label: 'Confirmado', bg: '#dbeafe', color: '#1d4ed8' },
  under_repair: { label: 'En reparacion', bg: '#ffedd5', color: '#c2410c' },
  ready: { label: 'Reparado', bg: '#dcfce7', color: '#15803d' },
  done: { label: 'Hecho', bg: '#bbf7d0', color: '#166534' },
  cancel: { label: 'Cancelado', bg: '#fee2e2', color: '#b91c1c' },
  '2binvoiced': { label: 'Por facturar', bg: '#fef3c7', color: '#b45309' },
  test: { label: 'Prueba', bg: '#e0e7ff', color: '#4338ca' },
  handover: { label: 'Entregado', bg: '#d1fae5', color: '#047857' },
  guarantee: { label: 'Garantia', bg: '#fce7f3', color: '#be185d' },
};

// Filter options
const FILTERS = [
  { id: 'today', label: 'Hoy', days: 1 },
  { id: 'week', label: '7 dias', days: 7 },
  { id: 'all', label: 'Todos', days: 30 },
];

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;

  return date.toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
  });
};

// Get equipment info - prefer product field, fallback to description
const getEquipment = (repair) => {
  // Si hay producto de Odoo, usarlo
  if (repair.product) {
    return repair.product;
  }
  // Fallback: extraer de descripción
  if (!repair.description) return 'Sin equipo';
  const match = repair.description.match(/Marca: ([^\n]+)/);
  const modelMatch = repair.description.match(/Modelo: ([^\n]+)/);
  if (match && modelMatch) {
    return `${match[1]} ${modelMatch[1]}`;
  }
  return repair.description.split('\n')[0] || 'Sin equipo';
};

// Extract problems from description
const extractProblems = (description) => {
  if (!description) return [];
  const match = description.match(/Problemas: ([^\n]+)/);
  if (match) {
    return match[1].split(', ').filter(Boolean);
  }
  return [];
};

// Función de copia compatible con iOS
const copyToClipboard = async (text) => {
  // Intentar con Clipboard API primero
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback para iOS
    }
  }

  // Fallback: crear textarea temporal
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch (e) {
    document.body.removeChild(textArea);
    return false;
  }
};

export default function History() {
  const [filter, setFilter] = useState('week');
  const [repairs, setRepairs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [copiedOrderId, setCopiedOrderId] = useState(null);

  useEffect(() => {
    loadRepairs();
  }, [filter]);

  const loadRepairs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const selectedFilter = FILTERS.find(f => f.id === filter);
      const result = await api.getRecentRepairs(selectedFilter?.days || 7);
      setRepairs(result.repairs || []);
    } catch (err) {
      console.error('[History] Error loading repairs:', err);
      setError('No se pudieron cargar las ordenes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareWhatsApp = (repair, e) => {
    if (e) e.stopPropagation();
    haptics.impact();

    const equipment = getEquipment(repair);
    const stateConfig = STATE_CONFIG[repair.state] || { label: repair.state };
    const problems = extractProblems(repair.description);

    // Formato de texto para WhatsApp
    let text = `*Orden: ${repair.name}*\n`;
    text += `Cliente: ${repair.partner || 'Sin cliente'}\n`;
    if (repair.partnerPhone) {
      text += `Tel: ${repair.partnerPhone}\n`;
    }
    text += `Equipo: ${equipment}\n`;
    if (problems.length > 0) {
      text += `Problema: ${problems.join(', ')}\n`;
    }
    text += `Estado: ${stateConfig.label}`;

    // Abrir WhatsApp con el texto
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
    haptics.success();
  };

  const handleCopyOrderNumber = async (orderName, repairId) => {
    haptics.light();
    const success = await copyToClipboard(orderName);
    if (success) {
      haptics.success();
      setCopiedOrderId(repairId);
      setTimeout(() => setCopiedOrderId(null), 2000);
    } else {
      haptics.error();
      toast.error('No se pudo copiar');
    }
  };

  const handleCall = (phone) => {
    if (!phone) return;
    haptics.impact();
    window.location.href = `tel:${phone}`;
  };

  const openDetail = (repair) => {
    haptics.selection();
    setSelectedRepair(repair);
  };

  const closeDetail = () => {
    haptics.light();
    setSelectedRepair(null);
  };

  return (
    <div className="fade-in">
      <h2 style={{
        fontSize: '22px',
        fontWeight: '700',
        marginBottom: '20px',
        color: 'var(--text)',
      }}>
        Historial
      </h2>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`filter-tab ${filter === f.id ? 'active' : ''}`}
            onClick={() => {
              if (f.id !== filter) haptics.selection();
              setFilter(f.id);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <SkeletonHistoryList count={5} />
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && repairs.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--text-secondary)',
        }}>
          <p>No hay ordenes en este periodo</p>
        </div>
      )}

      {/* Repairs list */}
      {!isLoading && !error && repairs.length > 0 && (
        <div className="history-list">
          {repairs.map((repair) => {
            const stateConfig = STATE_CONFIG[repair.state] || { label: repair.state, bg: '#f1f5f9', color: '#475569' };
            return (
              <div
                key={repair.id}
                className="history-item"
                onClick={() => openDetail(repair)}
              >
                <div className="history-item-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="history-item-name">{repair.name}</span>
                    <span style={{
                      padding: '2px 8px',
                      background: stateConfig.bg,
                      color: stateConfig.color,
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                    }}>
                      {stateConfig.label}
                    </span>
                  </div>
                  <div className="history-item-detail">
                    {repair.partner || 'Sin cliente'}
                  </div>
                  <div className="history-item-detail" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <span>{getEquipment(repair)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ color: 'var(--text-muted)' }}>{formatDate(repair.createdAt)}</span>
                  </div>
                </div>
                <button
                  className="btn-icon"
                  style={{
                    width: '36px',
                    height: '36px',
                    minHeight: '36px',
                    background: '#25D366',
                    color: 'white',
                  }}
                  onClick={(e) => handleShareWhatsApp(repair, e)}
                >
                  <WhatsAppIcon />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedRepair && (
        <div
          className="modal-backdrop"
          onClick={closeDetail}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  marginLeft: '-8px',
                  borderRadius: 'var(--radius-sm)',
                  background: copiedOrderId === selectedRepair.id ? 'var(--success-bg, #dcfce7)' : 'transparent',
                  transition: 'background 0.2s',
                }}
                onClick={() => handleCopyOrderNumber(selectedRepair.name, selectedRepair.id)}
              >
                <span
                  className="modal-title"
                  style={{
                    color: copiedOrderId === selectedRepair.id ? 'var(--success, #16a34a)' : 'inherit',
                  }}
                >
                  {copiedOrderId === selectedRepair.id ? 'Copiado' : selectedRepair.name}
                </span>
                <span style={{
                  color: copiedOrderId === selectedRepair.id ? 'var(--success, #16a34a)' : 'var(--text-muted)',
                }}>
                  {copiedOrderId === selectedRepair.id ? <CheckSmallIcon /> : <CopyIcon />}
                </span>
              </div>
              <button className="modal-close" onClick={closeDetail}>
                <CloseIcon />
              </button>
            </div>

            {/* Estado */}
            {(() => {
              const stateConfig = STATE_CONFIG[selectedRepair.state] || { label: selectedRepair.state, bg: '#f1f5f9', color: '#475569' };
              return (
                <div style={{
                  display: 'inline-block',
                  padding: '6px 14px',
                  background: stateConfig.bg,
                  color: stateConfig.color,
                  borderRadius: 'var(--radius-full)',
                  fontSize: '13px',
                  fontWeight: '600',
                  marginBottom: '20px',
                }}>
                  {stateConfig.label}
                </div>
              );
            })()}

            {/* Cliente */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>
                CLIENTE
              </div>
              <div style={{
                padding: '12px 14px',
                background: 'var(--border-light)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '500' }}>
                      {selectedRepair.partner || 'Sin cliente'}
                    </div>
                    {selectedRepair.partnerPhone && (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {selectedRepair.partnerPhone}
                      </div>
                    )}
                  </div>
                  {selectedRepair.partnerPhone && (
                    <button
                      onClick={() => handleCall(selectedRepair.partnerPhone)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        background: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        minHeight: 'auto',
                      }}
                    >
                      <PhoneIcon />
                      Llamar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Equipo */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>
                EQUIPO
              </div>
              <div style={{
                padding: '12px 14px',
                background: 'var(--border-light)',
                borderRadius: 'var(--radius-md)',
                fontSize: '15px',
              }}>
                {getEquipment(selectedRepair)}
              </div>
            </div>

            {/* Problemas */}
            {(() => {
              const problems = extractProblems(selectedRepair.description);
              if (problems.length === 0) return null;
              return (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '500' }}>
                    PROBLEMAS
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {problems.map((problem, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--primary-bg)',
                          color: 'var(--primary)',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '13px',
                          fontWeight: '500',
                        }}
                      >
                        {problem}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Asignado a */}
            {selectedRepair.assignedUser && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>
                  ASIGNADO A
                </div>
                <div style={{
                  padding: '12px 14px',
                  background: 'var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '15px',
                }}>
                  {selectedRepair.assignedUser}
                </div>
              </div>
            )}

            {/* Fecha */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>
                CREADO
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                {selectedRepair.createdAt
                  ? new Date(selectedRepair.createdAt).toLocaleDateString('es-DO', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Sin fecha'}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleShareWhatsApp(selectedRepair)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '14px 20px',
                  background: '#25D366',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                <WhatsAppIcon />
                WhatsApp
              </button>
              <button
                onClick={() => {
                  // TODO: Implementar cambio de estado
                  haptics.selection();
                  toast.info('Proximamente: Cambiar estado');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '14px 16px',
                  background: 'var(--border-light)',
                  color: 'var(--text)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                <EditIcon />
                Estado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
