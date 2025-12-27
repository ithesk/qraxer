// Bottom Navigation Component - iOS Style with FAB center button
import haptics from '../services/haptics';

// QR Scanner Icon
const ScanIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
    <path
      d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"
      stroke={active ? 'var(--primary)' : 'currentColor'}
    />
    <rect
      x="7" y="7" width="10" height="10" rx="2"
      stroke={active ? 'var(--primary)' : 'currentColor'}
      fill={active ? 'var(--primary-bg)' : 'none'}
    />
    <rect x="9" y="9" width="2" height="2" fill={active ? 'var(--primary)' : 'currentColor'} />
    <rect x="13" y="9" width="2" height="2" fill={active ? 'var(--primary)' : 'currentColor'} />
    <rect x="9" y="13" width="2" height="2" fill={active ? 'var(--primary)' : 'currentColor'} />
  </svg>
);

// Clock/History Icon
const HistoryIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
    <circle
      cx="12" cy="12" r="10"
      stroke={active ? 'var(--primary)' : 'currentColor'}
      fill={active ? 'var(--primary-bg)' : 'none'}
    />
    <polyline
      points="12 6 12 12 16 14"
      stroke={active ? 'var(--primary)' : 'currentColor'}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function BottomNav({ activeTab, onTabChange }) {
  const handleTabClick = (id) => {
    if (id !== activeTab) {
      haptics.selection();
    }
    onTabChange(id);
  };

  const isCreatorActive = activeTab === 'creator';

  return (
    <nav className="bottom-nav">
      {/* Escanear */}
      <button
        className={`bottom-nav-item ${activeTab === 'scanner' ? 'active' : ''}`}
        onClick={() => handleTabClick('scanner')}
        aria-label="Escanear"
      >
        <span className="bottom-nav-icon">
          <ScanIcon active={activeTab === 'scanner'} />
        </span>
        <span className="bottom-nav-label">Escanear</span>
      </button>

      {/* Crear - FAB prominente */}
      <button
        className="bottom-nav-fab"
        onClick={() => handleTabClick('creator')}
        aria-label="Crear"
        style={{
          background: isCreatorActive
            ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
          transform: isCreatorActive ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Historial */}
      <button
        className={`bottom-nav-item ${activeTab === 'history' ? 'active' : ''}`}
        onClick={() => handleTabClick('history')}
        aria-label="Historial"
      >
        <span className="bottom-nav-icon">
          <HistoryIcon active={activeTab === 'history'} />
        </span>
        <span className="bottom-nav-label">Historial</span>
      </button>
    </nav>
  );
}
