import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from './Toast';

// Storage keys for user preferences
export const USER_PREFS_KEYS = {
  DEFAULT_BRANCH_ID: 'qraxer_default_branch_id',
  DEFAULT_BRANCH_NAME: 'qraxer_default_branch_name',
};

// Helper to get saved preferences
export const getUserPreferences = () => {
  try {
    return {
      defaultBranchId: localStorage.getItem(USER_PREFS_KEYS.DEFAULT_BRANCH_ID)
        ? Number(localStorage.getItem(USER_PREFS_KEYS.DEFAULT_BRANCH_ID))
        : null,
      defaultBranchName: localStorage.getItem(USER_PREFS_KEYS.DEFAULT_BRANCH_NAME) || null,
    };
  } catch {
    return { defaultBranchId: null, defaultBranchName: null };
  }
};

// Icons
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const BranchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export default function SettingsScreen({ onBack }) {
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBranchPicker, setShowBranchPicker] = useState(false);

  // Load branches and saved preference
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get saved preference
        const prefs = getUserPreferences();
        setSelectedBranchId(prefs.defaultBranchId);
        console.log('[Settings] User prefs:', prefs);

        // Try cache first
        const cached = localStorage.getItem('repairConfig');
        if (cached) {
          const parsed = JSON.parse(cached);
          console.log('[Settings] Cached config:', parsed);
          // Only use cache if valid AND has branches
          if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000 && parsed.data?.branches?.length > 0) {
            console.log('[Settings] Using cached branches:', parsed.data.branches);
            setBranches(parsed.data.branches);
            setLoading(false);
            return;
          } else {
            console.log('[Settings] Cache invalid or empty branches, fetching fresh...');
            // Clear invalid cache
            localStorage.removeItem('repairConfig');
          }
        }

        // Fetch from API
        console.log('[Settings] Fetching config from API...');
        const config = await api.getRepairConfig();
        console.log('[Settings] API response:', config);
        setBranches(config.branches || []);

        // Cache it only if has branches
        if (config.branches?.length > 0) {
          localStorage.setItem('repairConfig', JSON.stringify({
            data: config,
            timestamp: Date.now(),
          }));
          console.log('[Settings] Config cached with', config.branches.length, 'branches');
        }
      } catch (error) {
        console.error('[Settings] Error loading branches:', error);
        toast.error('Error al cargar sucursales');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle branch selection
  const handleSelectBranch = (branch) => {
    setSelectedBranchId(branch.id);
    setShowBranchPicker(false);

    // Save to localStorage
    try {
      localStorage.setItem(USER_PREFS_KEYS.DEFAULT_BRANCH_ID, String(branch.id));
      localStorage.setItem(USER_PREFS_KEYS.DEFAULT_BRANCH_NAME, branch.name);
      toast.success(`Sucursal: ${branch.name}`);
    } catch (e) {
      console.error('Error saving branch preference:', e);
    }
  };

  // Get selected branch name
  const selectedBranch = branches.find(b => b.id === selectedBranchId);
  const selectedBranchName = selectedBranch?.name || 'No seleccionada';

  return (
    <div className="settings-screen">
      {/* Header */}
      <div className="settings-header">
        <button className="settings-back" onClick={onBack} aria-label="Volver">
          <BackIcon />
        </button>
        <span className="settings-title">Ajustes</span>
        <div className="settings-header-spacer" />
      </div>

      {/* Content */}
      <div className="settings-content">
        {/* Section: Ordenes */}
        <div className="settings-section">
          <div className="settings-section-title">Ordenes de Reparacion</div>

          {/* Branch selector */}
          <button
            className="settings-item"
            onClick={() => setShowBranchPicker(true)}
            disabled={loading}
          >
            <div className="settings-item-icon">
              <BranchIcon />
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">Sucursal por defecto</div>
              <div className="settings-item-value">
                {loading ? 'Cargando...' : selectedBranchName}
              </div>
            </div>
            <ChevronIcon />
          </button>
        </div>

        {/* Info text */}
        <p className="settings-info">
          La sucursal seleccionada se usara automaticamente al crear nuevas ordenes de reparacion.
        </p>
      </div>

      {/* Branch Picker Modal */}
      {showBranchPicker && (
        <div className="settings-modal-backdrop" onClick={() => setShowBranchPicker(false)}>
          <div className="settings-picker" onClick={(e) => e.stopPropagation()}>
            <div className="settings-picker-header">
              <span className="settings-picker-title">Seleccionar Sucursal</span>
              <button
                className="settings-picker-close"
                onClick={() => setShowBranchPicker(false)}
              >
                Cancelar
              </button>
            </div>
            <div className="settings-picker-list">
              {branches.length === 0 ? (
                <div className="settings-picker-empty">
                  No hay sucursales disponibles
                </div>
              ) : (
                branches.map((branch) => (
                  <button
                    key={branch.id}
                    className={`settings-picker-item ${selectedBranchId === branch.id ? 'selected' : ''}`}
                    onClick={() => handleSelectBranch(branch)}
                  >
                    <span className="settings-picker-item-name">{branch.name}</span>
                    {selectedBranchId === branch.id && (
                      <span className="settings-picker-item-check">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
