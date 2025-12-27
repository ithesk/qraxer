// Success check icon (orange like mockup)
const CheckIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
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
  const { tempId, realName, status, client, equipment, problems } = orderResult;

  const displayId = realName || tempId;
  const isPending = status === 'pending';
  const isFailed = status === 'failed';

  const handleShareWhatsApp = () => {
    const problemText = problems.map(p => problemLabels[p] || p).join(', ');
    const message = `Orden de reparacion ${displayId}\nCliente: ${client.name}\nEquipo: ${equipment.brand} ${equipment.model}\nProblema: ${problemText}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fade-in">
      {/* Success Header - Orange like mockup */}
      <div style={{
        textAlign: 'center',
        padding: '32px 20px',
      }}>
        {/* Orange Check Icon */}
        <div style={{
          width: '72px',
          height: '72px',
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 4px 14px rgba(249, 115, 22, 0.4)',
        }}>
          <CheckIcon />
        </div>

        {/* Order Number */}
        <div style={{
          fontSize: '28px',
          fontWeight: '700',
          color: isPending ? 'var(--text-muted)' : 'var(--text)',
          marginBottom: '8px',
        }}>
          {displayId}
          {isPending && (
            <div className="spinner spinner-dark" style={{ width: '20px', height: '20px', margin: '8px auto 0' }} />
          )}
        </div>

        {/* State Badge - Orange */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '6px 14px',
          background: '#fff7ed',
          color: '#ea580c',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: '600',
        }}>
          Recibido
        </span>
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
        {isFailed ? (
          <button className="btn-primary btn-large" onClick={onRetry}>
            <RetryIcon />
            Reintentar
          </button>
        ) : (
          <>
            <button
              className="btn-large"
              onClick={() => {}}
              disabled={isPending}
              style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                color: 'white',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
              }}
            >
              <ToolIcon />
              Tomar reparacion
            </button>

            <button className="btn-secondary btn-large" disabled={isPending}>
              <EditIcon />
              Cambiar estado
            </button>

            <button
              className="btn-large"
              onClick={handleShareWhatsApp}
              disabled={isPending}
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

        {/* Notas / Fotos section - Like mockup */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '8px',
        }}>
          <button
            className="btn-secondary btn-large"
            disabled={isPending}
            style={{ flex: 1, gap: '8px' }}
          >
            <NoteIcon />
            Notas
          </button>
          <button
            className="btn-secondary btn-large"
            disabled={isPending}
            style={{ flex: 1, gap: '8px' }}
          >
            <CameraIcon />
            Fotos
          </button>
        </div>

        <button
          className="btn-ghost btn-large"
          onClick={onCreateAnother}
          style={{ marginTop: '8px' }}
        >
          Crear otra orden
        </button>
      </div>
    </div>
  );
}
