import { useState } from 'react';

// Close icon
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function CreateClientModal({ phone, onClose, onCreate }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Crear Cliente Rapido</h3>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="client-name">Nombre</label>
            <input
              id="client-name"
              type="text"
              placeholder="Nombre del cliente"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="client-phone">Telefono</label>
            <input
              id="client-phone"
              type="tel"
              value={phone}
              disabled
              style={{ background: 'var(--border-light)', color: 'var(--text-secondary)' }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary btn-large"
            disabled={!name.trim()}
          >
            Guardar y continuar
          </button>
        </form>
      </div>
    </div>
  );
}
