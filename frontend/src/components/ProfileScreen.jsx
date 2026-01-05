import React, { useState, useEffect } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

const STORAGE_KEYS = {
  AVATAR: 'qraxer_user_avatar',
  ABOUT: 'qraxer_user_about',
};

export default function ProfileScreen({ user, version, onBack, onProfile, onSettings, onLogout }) {
  const [avatar, setAvatar] = useState(null);
  const [about, setAbout] = useState('');
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState('');
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.username?.[0] || 'U').toUpperCase();

  const position = user?.role || user?.position || 'Tecnico';
  const userName = user?.name || user?.username || 'Usuario';

  // Load saved data from localStorage
  useEffect(() => {
    try {
      const savedAvatar = localStorage.getItem(STORAGE_KEYS.AVATAR);
      if (savedAvatar) setAvatar(savedAvatar);

      const savedAbout = localStorage.getItem(STORAGE_KEYS.ABOUT);
      if (savedAbout) {
        setAbout(savedAbout);
      } else {
        setAbout(user?.about || 'Cuenta activa para operaciones y escaneo en tienda.');
      }
    } catch (e) {
      console.error('Error loading profile data:', e);
    }
  }, [user?.about]);

  // Handle avatar selection with Capacitor Camera
  const handleSelectPhoto = async (source) => {
    setShowAvatarOptions(false);

    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        width: 400,
        height: 400,
      });

      if (image.dataUrl) {
        setAvatar(image.dataUrl);
        try {
          localStorage.setItem(STORAGE_KEYS.AVATAR, image.dataUrl);
        } catch (e) {
          console.error('Error saving avatar:', e);
        }
      }
    } catch (e) {
      // User cancelled or error
      console.log('Camera cancelled or error:', e);
    }
  };

  const handleAvatarClick = () => {
    if (Capacitor.isNativePlatform()) {
      setShowAvatarOptions(true);
    } else {
      // Fallback for web - use file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result;
          if (base64) {
            setAvatar(base64);
            try {
              localStorage.setItem(STORAGE_KEYS.AVATAR, base64);
            } catch (err) {
              console.error('Error saving avatar:', err);
            }
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }
  };

  const handleRemoveAvatar = () => {
    setAvatar(null);
    setShowAvatarOptions(false);
    try {
      localStorage.removeItem(STORAGE_KEYS.AVATAR);
    } catch (e) {
      console.error('Error removing avatar:', e);
    }
  };

  // Handle about editing
  const handleEditAbout = () => {
    setAboutDraft(about);
    setIsEditingAbout(true);
  };

  const handleSaveAbout = () => {
    setAbout(aboutDraft);
    setIsEditingAbout(false);
    try {
      localStorage.setItem(STORAGE_KEYS.ABOUT, aboutDraft);
    } catch (e) {
      console.error('Error saving about:', e);
    }
  };

  const handleCancelAbout = () => {
    setIsEditingAbout(false);
    setAboutDraft('');
  };

  return (
    <div className="profile-screen-ios">
      {/* Header */}
      <div className="profile-ios-header">
        <button className="profile-ios-back" onClick={onBack} aria-label="Volver">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="profile-ios-header-title">Perfil</span>
        <div className="profile-ios-header-spacer" />
      </div>

      {/* Avatar Section */}
      <div className="profile-ios-avatar-section">
        <div className="profile-ios-avatar-container" onClick={handleAvatarClick}>
          {avatar ? (
            <img src={avatar} alt="Avatar" className="profile-ios-avatar-img" />
          ) : (
            <div className="profile-ios-avatar-initials">{initials}</div>
          )}
          <div className="profile-ios-avatar-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        </div>
        {avatar && (
          <button className="profile-ios-remove-avatar" onClick={handleRemoveAvatar}>
            Eliminar foto
          </button>
        )}
        <div className="profile-ios-name">{userName}</div>
        <div className="profile-ios-role">{position}</div>
      </div>

      {/* About Section */}
      <div className="profile-ios-card">
        <div className="profile-ios-card-header">
          <span className="profile-ios-card-title">Acerca de</span>
          {!isEditingAbout && (
            <button className="profile-ios-edit-btn" onClick={handleEditAbout}>
              Editar
            </button>
          )}
        </div>
        {isEditingAbout ? (
          <div className="profile-ios-about-edit">
            <textarea
              className="profile-ios-textarea"
              value={aboutDraft}
              onChange={(e) => setAboutDraft(e.target.value)}
              placeholder="Escribe algo sobre ti..."
              maxLength={200}
              autoFocus
            />
            <div className="profile-ios-about-actions">
              <button className="profile-ios-cancel-btn" onClick={handleCancelAbout}>
                Cancelar
              </button>
              <button className="profile-ios-save-btn" onClick={handleSaveAbout}>
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <p className="profile-ios-about-text">{about}</p>
        )}
      </div>

      {/* Settings Section */}
      <div className="profile-ios-card">
        <div className="profile-ios-card-title-solo">Configuración</div>
        <div className="profile-ios-menu">
          <button className="profile-ios-menu-item" onClick={onProfile}>
            <div className="profile-ios-menu-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="profile-ios-menu-label">Editar perfil</span>
            <svg className="profile-ios-menu-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button className="profile-ios-menu-item" onClick={onSettings}>
            <div className="profile-ios-menu-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <span className="profile-ios-menu-label">Ajustes</span>
            <svg className="profile-ios-menu-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="profile-ios-footer">
        <button className="profile-ios-logout" onClick={onLogout}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar sesión
        </button>
        <div className="profile-ios-version">Versión {version}</div>
      </div>

      {/* Avatar Options Modal */}
      {showAvatarOptions && (
        <div className="profile-ios-modal-backdrop" onClick={() => setShowAvatarOptions(false)}>
          <div className="profile-ios-action-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="profile-ios-action-sheet-title">Cambiar foto de perfil</div>
            <button className="profile-ios-action-btn" onClick={() => handleSelectPhoto('camera')}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Tomar foto
            </button>
            <button className="profile-ios-action-btn" onClick={() => handleSelectPhoto('photos')}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Elegir de la galería
            </button>
            {avatar && (
              <button className="profile-ios-action-btn profile-ios-action-danger" onClick={handleRemoveAvatar}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Eliminar foto
              </button>
            )}
            <button className="profile-ios-action-cancel" onClick={() => setShowAvatarOptions(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
