// Bottom Navigation Component - iOS Style with 3 buttons and FAB center
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

// Product/Barcode Icon
const ProductIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
    <path d="M3 5v14" stroke={active ? 'var(--primary)' : 'currentColor'} />
    <path d="M6 5v14" stroke={active ? 'var(--primary)' : 'currentColor'} />
    <path d="M10 5v14" stroke={active ? 'var(--primary)' : 'currentColor'} strokeWidth={active ? '2.5' : '2'} />
    <path d="M14 5v14" stroke={active ? 'var(--primary)' : 'currentColor'} />
    <path d="M18 5v14" stroke={active ? 'var(--primary)' : 'currentColor'} strokeWidth={active ? '2.5' : '2'} />
    <path d="M21 5v14" stroke={active ? 'var(--primary)' : 'currentColor'} />
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
      <div className="bottom-nav-inner">
        {/* Escanear / Reparaciones */}
        <button
          className={`bottom-nav-item ${activeTab === 'scanner' ? 'active' : ''}`}
          onClick={() => handleTabClick('scanner')}
          aria-label="Reparaciones"
        >
          <span className="bottom-nav-icon">
            <ScanIcon active={activeTab === 'scanner'} />
          </span>
          <span className="bottom-nav-label">Reparaciones</span>
        </button>

        {/* Crear - FAB prominente centrado */}
        <button
          className={`bottom-nav-fab ${isCreatorActive ? 'active' : ''}`}
          onClick={() => handleTabClick('creator')}
          aria-label="Crear"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Productos */}
        <button
          className={`bottom-nav-item ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => handleTabClick('products')}
          aria-label="Productos"
        >
          <span className="bottom-nav-icon">
            <ProductIcon active={activeTab === 'products'} />
          </span>
          <span className="bottom-nav-label">Productos</span>
        </button>
      </div>
    </nav>
  );
}
