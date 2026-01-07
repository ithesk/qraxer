import { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { toast } from '../Toast';
import haptics from '../../services/haptics';

// Success check icon (orange like mockup)
const CheckIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Clock icon for pending/queued orders
const ClockIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// Sync icon for syncing state
const SyncIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

// Error icon
const ErrorIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

// Retry icon
const RetryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 4v6h6" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

// WhatsApp icon
const WhatsAppIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// Tool icon
const ToolIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

// Edit icon
const EditIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

// Note icon
const NoteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

// Camera icon for photos
const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// Close icon
const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Check small icon
const CheckSmallIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Problem labels for display
const problemLabels = {
  screen: 'Pantalla',
  battery: 'Bateria',
  charging: 'Carga',
  power: 'No enciende',
  software: 'Software',
  diagnostic: 'Diagnostico',
};

export default function OrderConfirmation({ orderResult, onCreateAnother, onRetry }) {
  const {
    localId,
    tempDisplayId,
    realId: initialRealId,
    realName: initialRealName,
    jobId,
    status: initialStatus,
    client,
    equipment,
    problems,
    duplicate,
  } = orderResult;

  // Estados locales para actualizar cuando el job complete
  const [currentRealId, setCurrentRealId] = useState(initialRealId);
  const [currentRealName, setCurrentRealName] = useState(initialRealName);
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [pollingError, setPollingError] = useState(null);

  // Use realId from the API response (set after successful creation)
  const repairId = currentRealId;

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isSubmittingPhoto, setIsSubmittingPhoto] = useState(false);
  const [noteAdded, setNoteAdded] = useState(false);
  const [photosUploaded, setPhotosUploaded] = useState(0);
  const [previewImage, setPreviewImage] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [availableStates, setAvailableStates] = useState([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [changingState, setChangingState] = useState(false);
  const [currentState, setCurrentState] = useState(null);
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // ========== POLLING PARA MODO ASYNC ==========
  useEffect(() => {
    if (!jobId || currentStatus !== 'processing') return;

    console.log('[OrderConfirmation] 🚀 Iniciando polling para jobId:', jobId);
    let pollCount = 0;
    const maxPolls = 60; // 2 minutos máximo (60 * 2s)
    const pollInterval = 2000; // 2 segundos

    const pollJob = async () => {
      try {
        pollCount++;
        console.log(`[OrderConfirmation] Polling #${pollCount}...`);

        const job = await api.pollJobStatus(jobId);
        console.log('[OrderConfirmation] Job status:', job.status);

        if (job.status === 'completed' && job.repair) {
          // Orden creada exitosamente
          console.log('[OrderConfirmation] ✅ Orden completada:', job.repair.name);
          setCurrentRealId(job.repair.id);
          setCurrentRealName(job.repair.name);
          setCurrentStatus('confirmed');
          haptics.success();
          toast.success(`Orden ${job.repair.name} creada`);
          return true; // Stop polling
        }

        if (job.status === 'failed') {
          // Error en background
          console.error('[OrderConfirmation] ❌ Job falló:', job.error);
          setPollingError(job.error || 'Error al crear orden');
          setCurrentStatus('failed');
          haptics.error();
          toast.error(job.error || 'Error al crear orden');
          return true; // Stop polling
        }

        // Aún procesando, continuar
        return false;
      } catch (error) {
        console.error('[OrderConfirmation] Error en polling:', error);
        // No detener el polling por errores de red temporales
        if (pollCount >= maxPolls) {
          setPollingError('Timeout esperando respuesta del servidor');
          setCurrentStatus('failed');
          return true;
        }
        return false;
      }
    };

    const intervalId = setInterval(async () => {
      const shouldStop = await pollJob();
      if (shouldStop || pollCount >= maxPolls) {
        clearInterval(intervalId);
      }
    }, pollInterval);

    // Hacer primera llamada inmediatamente
    pollJob();

    return () => {
      console.log('[OrderConfirmation] Limpiando polling interval');
      clearInterval(intervalId);
    };
  }, [jobId, currentStatus]);

  // Display the real order name if synced, or temp ID if pending
  const displayId = currentRealName || tempDisplayId || (currentStatus === 'processing' ? 'Creando...' : 'Procesando...');

  // Status flags - usar currentStatus
  const isProcessing = currentStatus === 'processing';
  const isPending = currentStatus === 'pending';
  const isSyncing = currentStatus === 'syncing';
  const isFailed = currentStatus === 'failed';
  const isConfirmed = currentStatus === 'confirmed';
  const isQueued = isPending || isSyncing; // Local order waiting to sync

  const handleShareWhatsApp = () => {
    const problemText = problems.map(p => problemLabels[p] || p).join(', ');
    const message = `Orden de reparacion ${displayId}\nCliente: ${client.name}\nEquipo: ${equipment.brand} ${equipment.model}\nProblema: ${problemText}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Handle note submission
  const handleSubmitNote = async () => {
    if (!noteText.trim() || !repairId) return;

    setIsSubmittingNote(true);
    try {
      await api.addRepairNote(repairId, noteText.trim());
      haptics.success();
      toast.success('Nota agregada');
      setNoteText('');
      setShowNoteModal(false);
      setNoteAdded(true);
    } catch (error) {
      haptics.error();
      toast.error(error.message || 'Error al agregar nota');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Handle photo capture from camera or file
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Handle photo upload
  const handleUploadPhoto = async () => {
    if (!previewImage || !repairId) return;

    setIsSubmittingPhoto(true);
    try {
      await api.uploadRepairPhoto(repairId, previewImage);
      haptics.success();
      toast.success('Foto subida');
      setPreviewImage(null);
      setPhotosUploaded(prev => prev + 1);
      // Don't close modal to allow more photos
    } catch (error) {
      haptics.error();
      toast.error(error.message || 'Error al subir foto');
    } finally {
      setIsSubmittingPhoto(false);
    }
  };

  // Open camera for photo
  const handleOpenCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Open gallery for photo
  const handleOpenGallery = () => {
    if (galleryInputRef.current) {
      galleryInputRef.current.click();
    }
  };

  // Open state change modal
  const handleOpenStateModal = async () => {
    setShowStateModal(true);
    setLoadingStates(true);
    try {
      const states = await api.getRepairStates();
      setAvailableStates(states);
    } catch (error) {
      toast.error('Error al cargar estados');
      setShowStateModal(false);
    } finally {
      setLoadingStates(false);
    }
  };

  // Change repair state
  const handleChangeState = async (newState) => {
    if (!repairId || changingState) return;

    setChangingState(true);
    try {
      // Usar updateRepairState que actualiza por ID (no requiere validación QR)
      await api.updateRepairState(repairId, newState, null);
      haptics.success();
      toast.success('Estado actualizado');
      setCurrentState(newState);
      setShowStateModal(false);
    } catch (error) {
      haptics.error();
      toast.error(error.message || 'Error al cambiar estado');
    } finally {
      setChangingState(false);
    }
  };

  // Take repair (assign to current user)
  const handleTakeRepair = () => {
    toast.info('Función próximamente disponible');
  };

  // Determine icon and colors based on status
  const getStatusConfig = () => {
    if (isFailed) {
      return {
        icon: <ErrorIcon />,
        bgGradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        shadow: 'rgba(239, 68, 68, 0.4)',
        badge: { bg: '#fef2f2', color: '#dc2626', text: pollingError || 'Error' },
      };
    }
    if (isProcessing) {
      // Nuevo estado: creando orden en background
      return {
        icon: <SyncIcon />,
        bgGradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        shadow: 'rgba(139, 92, 246, 0.4)',
        badge: { bg: '#f5f3ff', color: '#7c3aed', text: 'Creando orden...' },
        spin: true,
      };
    }
    if (isSyncing) {
      return {
        icon: <SyncIcon />,
        bgGradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        shadow: 'rgba(59, 130, 246, 0.4)',
        badge: { bg: '#eff6ff', color: '#2563eb', text: 'Sincronizando...' },
        spin: true,
      };
    }
    if (isPending) {
      return {
        icon: <ClockIcon />,
        bgGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        shadow: 'rgba(245, 158, 11, 0.4)',
        badge: { bg: '#fffbeb', color: '#d97706', text: 'Guardado localmente' },
      };
    }
    // Confirmed
    return {
      icon: <CheckIcon />,
      bgGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      shadow: 'rgba(249, 115, 22, 0.4)',
      badge: { bg: '#fff7ed', color: '#ea580c', text: duplicate ? 'Ya existía' : 'Recibido' },
    };
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="fade-in">
      {/* Header with status-aware styling */}
      <div style={{
        textAlign: 'center',
        padding: '32px 20px',
      }}>
        {/* Status Icon */}
        <div style={{
          width: '72px',
          height: '72px',
          background: statusConfig.bgGradient,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: `0 4px 14px ${statusConfig.shadow}`,
          animation: statusConfig.spin ? 'spin 2s linear infinite' : 'none',
        }}>
          {statusConfig.icon}
        </div>

        {/* Order Number */}
        <div style={{
          fontSize: '28px',
          fontWeight: '700',
          color: isQueued ? 'var(--text-muted)' : 'var(--text)',
          marginBottom: '8px',
        }}>
          {displayId}
        </div>

        {/* State Badge */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          background: statusConfig.badge.bg,
          color: statusConfig.badge.color,
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: '600',
        }}>
          {(isSyncing || isProcessing) && (
            <div className="spinner" style={{
              width: '12px',
              height: '12px',
              borderWidth: '2px',
              borderColor: `${statusConfig.badge.color} transparent transparent transparent`,
            }} />
          )}
          {statusConfig.badge.text}
        </span>

        {/* Processing hint */}
        {isProcessing && (
          <div style={{
            marginTop: '12px',
            fontSize: '13px',
            color: 'var(--text-muted)',
          }}>
            Conectando con el servidor...
          </div>
        )}

        {/* Offline hint */}
        {isQueued && (
          <div style={{
            marginTop: '12px',
            fontSize: '13px',
            color: 'var(--text-muted)',
          }}>
            Se sincronizará automáticamente al recuperar conexión
          </div>
        )}
      </div>

      {/* Client Info Card */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px',
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            background: 'var(--border-light)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
            color: 'var(--primary)',
            fontSize: '16px',
          }}>
            {client?.name?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '16px' }}>{client?.name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{client?.phone}</div>
          </div>
        </div>

        <div style={{
          padding: '12px',
          background: 'var(--border-light)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '14px',
          color: 'var(--text-secondary)',
        }}>
          <div><strong>Equipo:</strong> {equipment?.brand} {equipment?.model}</div>
          <div style={{ marginTop: '4px' }}><strong>Problema:</strong> {problems.map(p => problemLabels[p] || p).join(', ')}</div>
        </div>
      </div>

      {/* Error state */}
      {isFailed && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          <span>No se pudo crear la orden en el sistema</span>
        </div>
      )}

      {/* Action Buttons - Like mockup */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Show retry button for failed OR pending (queued) orders */}
        {(isFailed || isPending) && (
          <button
            className="btn-primary btn-large"
            onClick={async () => {
              if (!localId || isRetrying || isSyncing) return;
              setIsRetrying(true);
              try {
                await onRetry();
              } finally {
                setIsRetrying(false);
              }
            }}
            disabled={!localId || isRetrying || isSyncing}
            style={{
              opacity: (!localId || isRetrying || isSyncing) ? 0.6 : 1,
            }}
          >
            {isRetrying ? (
              <>
                <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                Sincronizando...
              </>
            ) : (
              <>
                <RetryIcon />
                {isFailed ? 'Reintentar' : 'Sincronizar ahora'}
              </>
            )}
          </button>
        )}

        {/* Regular action buttons - only when confirmed */}
        {isConfirmed && (
          <>
            <button
              className="btn-large"
              onClick={handleTakeRepair}
              style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                color: 'white',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
              }}
            >
              <ToolIcon />
              Tomar reparacion
            </button>

            <button
              className="btn-secondary btn-large"
              onClick={handleOpenStateModal}
            >
              <EditIcon />
              Cambiar estado
            </button>

            <button
              className="btn-large"
              onClick={handleShareWhatsApp}
              style={{
                background: '#25D366',
                color: 'white',
              }}
            >
              <WhatsAppIcon />
              WhatsApp
            </button>
          </>
        )}

        {/* WhatsApp available even when syncing (can share temp ID) */}
        {isSyncing && (
          <button
            className="btn-large"
            onClick={handleShareWhatsApp}
            style={{
              background: '#25D366',
              color: 'white',
            }}
          >
            <WhatsAppIcon />
            Compartir por WhatsApp
          </button>
        )}

        {/* Notas / Fotos section - Only available when confirmed (has repairId) */}
        {isConfirmed && repairId && (
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '8px',
          }}>
            <button
              className="btn-secondary btn-large"
              onClick={() => setShowNoteModal(true)}
              style={{
                flex: 1,
                gap: '8px',
                position: 'relative',
              }}
            >
              <NoteIcon />
              Notas
              {noteAdded && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  width: '20px',
                  height: '20px',
                  background: 'var(--success)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}>
                  <CheckSmallIcon />
                </span>
              )}
            </button>
            <button
              className="btn-secondary btn-large"
              onClick={() => setShowPhotoModal(true)}
              style={{
                flex: 1,
                gap: '8px',
                position: 'relative',
              }}
            >
              <CameraIcon />
              Fotos
              {photosUploaded > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  minWidth: '20px',
                  height: '20px',
                  padding: '0 6px',
                  background: 'var(--success)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: '700',
                }}>
                  {photosUploaded}
                </span>
              )}
            </button>
          </div>
        )}

        <button
          className="btn-ghost btn-large"
          onClick={onCreateAnother}
          style={{ marginTop: '8px' }}
        >
          Crear otra orden
        </button>
      </div>

      {/* Note Modal */}
      {showNoteModal && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmittingNote && setShowNoteModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '500px',
              background: 'var(--card-bg)',
              borderRadius: '16px',
              padding: '20px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Agregar Nota
              </h3>
              <button
                onClick={() => setShowNoteModal(false)}
                disabled={isSubmittingNote}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <div style={{ marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Orden: <strong>{displayId}</strong>
            </div>

            <textarea
              placeholder="Escribe una nota para esta orden..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              disabled={isSubmittingNote}
              autoFocus
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                fontSize: '15px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />

            <button
              className="btn-primary btn-large"
              onClick={handleSubmitNote}
              disabled={!noteText.trim() || isSubmittingNote}
              style={{ width: '100%', marginTop: '16px' }}
            >
              {isSubmittingNote ? (
                <>
                  <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                  Guardando...
                </>
              ) : (
                <>
                  <NoteIcon />
                  Guardar Nota
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* State Change Modal */}
      {showStateModal && (
        <div
          className="modal-backdrop"
          onClick={() => !changingState && setShowStateModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '400px',
              background: 'var(--card-bg)',
              borderRadius: '16px',
              padding: '20px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Cambiar Estado
              </h3>
              <button
                onClick={() => setShowStateModal(false)}
                disabled={changingState}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Orden: <strong>{displayId}</strong>
            </div>

            {loadingStates ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner spinner-dark" style={{ width: '32px', height: '32px' }} />
                <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Cargando estados...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableStates.map((state) => (
                  <button
                    key={state.value}
                    className="btn-secondary"
                    onClick={() => handleChangeState(state.value)}
                    disabled={changingState || currentState === state.value}
                    style={{
                      justifyContent: 'flex-start',
                      padding: '14px 16px',
                      opacity: currentState === state.value ? 0.5 : 1,
                    }}
                  >
                    {changingState ? (
                      <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                    ) : (
                      <span style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: state.value === 'done' ? 'var(--success)' :
                                   state.value === 'draft' ? 'var(--text-muted)' :
                                   state.value === 'confirmed' ? 'var(--primary)' :
                                   state.value === 'under_repair' ? 'var(--warning)' :
                                   state.value === 'ready' ? '#10b981' :
                                   state.value === 'cancel' ? 'var(--error)' : 'var(--text-muted)',
                        marginRight: '12px',
                      }} />
                    )}
                    {state.label}
                    {currentState === state.value && (
                      <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                        (actual)
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmittingPhoto && setShowPhotoModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '500px',
              background: 'var(--card-bg)',
              borderRadius: '16px',
              padding: '20px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Agregar Foto
              </h3>
              <button
                onClick={() => {
                  setShowPhotoModal(false);
                  setPreviewImage(null);
                }}
                disabled={isSubmittingPhoto}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Orden: <strong>{displayId}</strong>
              {photosUploaded > 0 && (
                <span style={{ marginLeft: '12px', color: 'var(--success)' }}>
                  {photosUploaded} foto{photosUploaded > 1 ? 's' : ''} subida{photosUploaded > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Hidden file inputs - one for camera, one for gallery */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              style={{ display: 'none' }}
            />
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*"
              onChange={handlePhotoSelect}
              style={{ display: 'none' }}
            />

            {/* Preview or capture buttons */}
            {previewImage ? (
              <div style={{ marginBottom: '16px' }}>
                <img
                  src={previewImage}
                  alt="Preview"
                  style={{
                    width: '100%',
                    maxHeight: '300px',
                    objectFit: 'contain',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg)',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setPreviewImage(null);
                      handleOpenCamera();
                    }}
                    disabled={isSubmittingPhoto}
                    style={{ flex: 1 }}
                  >
                    Tomar otra
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setPreviewImage(null);
                      handleOpenGallery();
                    }}
                    disabled={isSubmittingPhoto}
                    style={{ flex: 1 }}
                  >
                    Elegir otra
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn-secondary btn-large"
                  onClick={handleOpenCamera}
                  style={{
                    flex: 1,
                    minHeight: '120px',
                    flexDirection: 'column',
                    gap: '8px',
                    border: '2px dashed var(--border)',
                  }}
                >
                  <CameraIcon />
                  <span style={{ fontSize: '13px' }}>Cámara</span>
                </button>
                <button
                  className="btn-secondary btn-large"
                  onClick={handleOpenGallery}
                  style={{
                    flex: 1,
                    minHeight: '120px',
                    flexDirection: 'column',
                    gap: '8px',
                    border: '2px dashed var(--border)',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span style={{ fontSize: '13px' }}>Galería</span>
                </button>
              </div>
            )}

            <button
              className="btn-primary btn-large"
              onClick={handleUploadPhoto}
              disabled={!previewImage || isSubmittingPhoto}
              style={{ width: '100%', marginTop: '16px' }}
            >
              {isSubmittingPhoto ? (
                <>
                  <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                  Subiendo...
                </>
              ) : (
                <>
                  <CameraIcon />
                  Subir Foto
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
