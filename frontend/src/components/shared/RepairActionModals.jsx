import { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { toast } from '../Toast';
import haptics from '../../services/haptics';

// Compress image to reduce file size - aggressive compression for mobile uploads
const compressImage = (base64Data, maxWidth = 800, quality = 0.5) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions - limit both width and height
      let { width, height } = img;
      const maxDim = maxWidth;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (height * maxDim) / width;
          width = maxDim;
        } else {
          width = (width * maxDim) / height;
          height = maxDim;
        }
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Convert to compressed JPEG with lower quality
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedBase64);
    };
    img.onerror = () => reject(new Error('Error al procesar imagen'));
    img.src = base64Data;
  });
};

// Icons
const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const NoteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const GalleryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

// State translations to Spanish and filter config
const STATE_CONFIG = {
  draft: { label: 'Presupuesto', color: '#64748b', show: true },
  confirmed: { label: 'Confirmado', color: '#2563eb', show: true },
  under_repair: { label: 'En reparacion', color: '#ea580c', show: true },
  ready: { label: 'Listo para entrega', color: '#10b981', show: true },
  '2binvoiced': { label: 'Por facturar', color: '#f59e0b', show: true },
  done: { label: 'Entregado', color: '#16a34a', show: true },
  cancel: { label: 'Cancelado', color: '#dc2626', show: true },
  // Hidden states - not commonly used
  test: { label: 'Prueba', color: '#8b5cf6', show: false },
  handover: { label: 'Entregado', color: '#059669', show: false },
  guarantee: { label: 'Garantia', color: '#ec4899', show: false },
};

// Modal backdrop style - centered with safe area padding
const modalBackdropStyle = {
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
  overflowY: 'auto',
};

// Modal content style
const modalContentStyle = {
  width: '100%',
  maxWidth: '500px',
  background: 'var(--card-bg)',
  borderRadius: '16px',
  padding: '20px',
  maxHeight: 'calc(100vh - 100px)',
  overflow: 'auto',
};

// Modal header style
const modalHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
};

/**
 * Note Modal - Add notes to a repair order
 */
export function NoteModal({ isOpen, onClose, repairId, repairName, onSuccess }) {
  const [noteText, setNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!noteText.trim() || !repairId) return;

    setIsSubmitting(true);
    try {
      await api.addRepairNote(repairId, noteText.trim());
      haptics.success();
      toast.success('Nota agregada');
      setNoteText('');
      onSuccess?.();
      onClose();
    } catch (error) {
      haptics.error();
      toast.error(error.message || 'Error al agregar nota');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={() => !isSubmitting && onClose()}
      style={modalBackdropStyle}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={modalContentStyle}
      >
        <div style={modalHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
            Agregar Nota
          </h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
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
          Orden: <strong>{repairName}</strong>
        </div>

        <textarea
          placeholder="Escribe una nota para esta orden..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          disabled={isSubmitting}
          autoFocus
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            fontSize: '15px',
            resize: 'none',
            fontFamily: 'inherit',
          }}
        />

        <button
          className="btn-primary btn-large"
          onClick={handleSubmit}
          disabled={!noteText.trim() || isSubmitting}
          style={{ width: '100%', marginTop: '12px' }}
        >
          {isSubmitting ? (
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
  );
}

/**
 * Photo Modal - Upload photos to a repair order
 */
export function PhotoModal({ isOpen, onClose, repairId, repairName, onSuccess }) {
  const [previewImage, setPreviewImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photosUploaded, setPhotosUploaded] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  if (!isOpen) return null;

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona una imagen');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen es muy grande (max 10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewImage(event.target.result);
    };
    reader.onerror = () => {
      setError('Error al cargar la imagen');
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!previewImage || !repairId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      // Compress image before upload to avoid 413 error (max 800px, 50% quality)
      let compressedImage = await compressImage(previewImage, 800, 0.5);
      console.log('[PhotoModal] Original size:', Math.round(previewImage.length / 1024), 'KB');
      console.log('[PhotoModal] Compressed size:', Math.round(compressedImage.length / 1024), 'KB');

      // Check if still too large (> 500KB) and compress more
      if (compressedImage.length > 500 * 1024) {
        console.log('[PhotoModal] Still too large, compressing more...');
        compressedImage = await compressImage(compressedImage, 600, 0.4);
        console.log('[PhotoModal] Extra compressed size:', Math.round(compressedImage.length / 1024), 'KB');
      }

      await api.uploadRepairPhoto(repairId, compressedImage);
      haptics.success();
      toast.success('Foto subida');
      setPreviewImage(null);
      setPhotosUploaded(prev => prev + 1);
      onSuccess?.();
      // Reset file inputs
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    } catch (err) {
      haptics.error();
      const errorMsg = err.message || 'Error al subir foto';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCamera = () => {
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleOpenGallery = () => {
    setError(null);
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
      galleryInputRef.current.click();
    }
  };

  const handleClose = () => {
    setPreviewImage(null);
    setPhotosUploaded(0);
    setError(null);
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onClick={() => !isSubmitting && handleClose()}
      style={modalBackdropStyle}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={modalContentStyle}
      >
        <div style={modalHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
            Agregar Foto
          </h3>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
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
          Orden: <strong>{repairName}</strong>
          {photosUploaded > 0 && (
            <span style={{ marginLeft: '12px', color: 'var(--success)' }}>
              {photosUploaded} foto{photosUploaded > 1 ? 's' : ''} subida{photosUploaded > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            padding: '10px 12px',
            background: '#fef2f2',
            color: '#dc2626',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            marginBottom: '12px',
          }}>
            {error}
          </div>
        )}

        {/* Hidden file inputs */}
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
          <div style={{ marginBottom: '12px' }}>
            <img
              src={previewImage}
              alt="Preview"
              style={{
                width: '100%',
                maxHeight: '200px',
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
                  setError(null);
                  handleOpenCamera();
                }}
                disabled={isSubmitting}
                style={{ flex: 1 }}
              >
                Tomar otra
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  setPreviewImage(null);
                  setError(null);
                  handleOpenGallery();
                }}
                disabled={isSubmitting}
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
                minHeight: '100px',
                flexDirection: 'column',
                gap: '8px',
                border: '2px dashed var(--border)',
              }}
            >
              <CameraIcon />
              <span style={{ fontSize: '13px' }}>Camara</span>
            </button>
            <button
              className="btn-secondary btn-large"
              onClick={handleOpenGallery}
              style={{
                flex: 1,
                minHeight: '100px',
                flexDirection: 'column',
                gap: '8px',
                border: '2px dashed var(--border)',
              }}
            >
              <GalleryIcon />
              <span style={{ fontSize: '13px' }}>Galeria</span>
            </button>
          </div>
        )}

        <button
          className="btn-primary btn-large"
          onClick={handleUpload}
          disabled={!previewImage || isSubmitting}
          style={{ width: '100%', marginTop: '12px' }}
        >
          {isSubmitting ? (
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
  );
}

/**
 * State Change Modal - Change repair state
 * Filters out unused states and translates to Spanish
 */
export function StateModal({ isOpen, onClose, repairId, repairName, currentState, onSuccess }) {
  const [availableStates, setAvailableStates] = useState([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [changingState, setChangingState] = useState(false);
  const [selectedState, setSelectedState] = useState(currentState);

  // Load states when modal opens
  useEffect(() => {
    if (isOpen && availableStates.length === 0) {
      loadStates();
    }
  }, [isOpen]);

  // Update selectedState when currentState changes
  useEffect(() => {
    setSelectedState(currentState);
  }, [currentState]);

  const loadStates = async () => {
    setLoadingStates(true);
    try {
      const states = await api.getRepairStates();
      // Filter and translate states
      const filteredStates = states
        .filter(state => {
          const config = STATE_CONFIG[state.value];
          return config ? config.show : true; // Show unknown states by default
        })
        .map(state => {
          const config = STATE_CONFIG[state.value];
          return {
            ...state,
            label: config ? config.label : state.label,
            color: config ? config.color : '#64748b',
          };
        });
      setAvailableStates(filteredStates);
    } catch (error) {
      toast.error('Error al cargar estados');
      onClose();
    } finally {
      setLoadingStates(false);
    }
  };

  if (!isOpen) return null;

  const handleChangeState = async (newState) => {
    if ((!repairId && !repairName) || changingState) return;

    setChangingState(true);
    try {
      // If we have repairId, use the direct endpoint (bypasses QR validation)
      // Otherwise use QR-based endpoint with repairName
      if (repairId) {
        await api.updateRepairState(repairId, newState, null);
      } else {
        await api.updateState(repairName, newState, null);
      }
      haptics.success();
      toast.success('Estado actualizado');
      setSelectedState(newState);
      onSuccess?.(newState);
      onClose();
    } catch (error) {
      haptics.error();
      toast.error(error.message || 'Error al cambiar estado');
    } finally {
      setChangingState(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={() => !changingState && onClose()}
      style={modalBackdropStyle}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ ...modalContentStyle, maxWidth: '340px' }}
      >
        <div style={modalHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
            Cambiar Estado
          </h3>
          <button
            onClick={onClose}
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

        <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Orden: <strong>{repairName}</strong>
        </div>

        {loadingStates ? (
          <div style={{ textAlign: 'center', padding: '30px' }}>
            <div className="spinner spinner-dark" style={{ width: '28px', height: '28px' }} />
            <p style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '13px' }}>Cargando...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {availableStates.map((state) => (
              <button
                key={state.value}
                className="btn-secondary"
                onClick={() => handleChangeState(state.value)}
                disabled={changingState || selectedState === state.value}
                style={{
                  justifyContent: 'flex-start',
                  padding: '12px 14px',
                  opacity: selectedState === state.value ? 0.5 : 1,
                  fontSize: '14px',
                }}
              >
                {changingState ? (
                  <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                ) : (
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: state.color,
                    marginRight: '10px',
                    flexShrink: 0,
                  }} />
                )}
                <span style={{ flex: 1, textAlign: 'left' }}>{state.label}</span>
                {selectedState === state.value && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    (actual)
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
