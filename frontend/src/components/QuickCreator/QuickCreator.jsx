import { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { orderQueue, generateIdempotencyKey } from '../../services/orderQueue';
import { queueProcessor } from '../../services/queueProcessor';
import { toast } from '../Toast';
import haptics from '../../services/haptics';
import ClientSection from './ClientSection';
import EquipmentSection from './EquipmentSection';
import ProblemSection from './ProblemSection';
import OrderConfirmation from './OrderConfirmation';
import { getUserPreferences } from '../SettingsScreen';
// Helper: Format date for display
const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
};

// Icons
const ClipboardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const BranchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export default function QuickCreator() {
  // Refs
  const equipmentRef = useRef(null);

  // Config state (loaded once)
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Form state
  const [client, setClient] = useState(null);
  const [equipment, setEquipment] = useState({ brand: '', model: '', serial: '' });
  const [problems, setProblems] = useState([]);
  const [note, setNote] = useState('');

  // New required fields
  const [branchId, setBranchId] = useState(null);
  const [leadSource, setLeadSource] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  // UI state
  const [view, setView] = useState('form'); // 'form' | 'confirmation'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Get user preferences (saved branch)
        const userPrefs = getUserPreferences();

        // DEBUG: Clear cache to force fresh fetch
        console.log('[QuickCreator] DEBUG: Clearing cache to fetch fresh config...');
        localStorage.removeItem('repairConfig');

        // Fetch from API
        const data = await api.getRepairConfig();

        // DEBUG: Log the full config to see leadSources
        console.log('[QuickCreator] ====== DEBUG LEAD SOURCES ======');
        console.log('[QuickCreator] Full config:', JSON.stringify(data, null, 2));
        console.log('[QuickCreator] leadSources:', data.leadSources);
        console.log('[QuickCreator] defaults.leadSource:', data.defaults?.leadSource);
        console.log('[QuickCreator] ================================');

        setConfig(data);

        // Set defaults - use saved branch preference, or first branch as fallback
        if (userPrefs.defaultBranchId) {
          // Verify the saved branch still exists
          const branchExists = data.branches?.some(b => b.id === userPrefs.defaultBranchId);
          setBranchId(branchExists ? userPrefs.defaultBranchId : data.branches?.[0]?.id || null);
        } else if (data.branches?.length > 0) {
          setBranchId(data.branches[0].id);
        }
        if (data.defaults) {
          setLeadSource(data.defaults.leadSource || '');
          setDeliveryDate(data.defaults.deliveryDate || '');
        }

        // Cache for 1 hour
        localStorage.setItem('repairConfig', JSON.stringify({
          data,
          timestamp: Date.now(),
        }));
      } catch (error) {
        console.error('[QuickCreator] Error loading config:', error);
        toast.error('Error al cargar configuracion');
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Check if form is complete enough to submit
  const canSubmit = client && equipment.model && problems.length > 0 && branchId;

  // Reset form for new order
  const resetForm = () => {
    setClient(null);
    setEquipment({ brand: '', model: '', serial: '' });
    setProblems([]);
    setNote('');
    setView('form');
    setOrderResult(null);
    // Keep branchId, leadSource, deliveryDate with their current/default values
    if (config?.defaults) {
      setDeliveryDate(config.defaults.deliveryDate || '');
    }
  };

  // Handle order creation with offline-first queue
  const handleCreateOrder = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    haptics.impact(); // Feedback on submit

    // Find branch name for display
    const branchName = config?.branches?.find(b => b.id === branchId)?.name || '';

    // Prepare order data for queue
    const orderData = {
      client: {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        isNew: client.isNew || false,
      },
      equipment,
      problems,
      note,
      branchId,
      branchName,
      leadSource,
      deliveryDate,
    };

    // Generate idempotency key to prevent duplicates
    const idempotencyKey = generateIdempotencyKey(orderData);

    // Check if online
    const isOnline = await api.isOnline();
    console.log('[QuickCreator] Online status:', isOnline);

    if (isOnline) {
      // TRY IMMEDIATE SYNC
      try {
        // If client is new, create first
        let clientId = client.id;
        if (client.isNew) {
          console.log('[QuickCreator] Creating new client...');
          const createResult = await api.createClient(client.name, client.phone, client.email);
          clientId = createResult.client.id;
          console.log('[QuickCreator] Client created:', clientId);
        }

        // Create repair order with idempotency key
        console.log('[QuickCreator] Creating repair order...');
        const repairData = {
          clientId,
          equipment,
          problems,
          note,
          branchId,
          leadSource,
          deliveryDate,
        };

        const result = await api.createRepairOrder(repairData, idempotencyKey);
        console.log('[QuickCreator] Order created:', result);

        // Success! Show confirmation with real data
        setOrderResult({
          localId: null,
          tempDisplayId: null,
          realId: result.repair.id,
          realName: result.repair.name,
          status: 'confirmed',
          duplicate: result.duplicate || false,
          client,
          equipment,
          problems,
          branchName: result.repair.branch || branchName,
        });
        setView('confirmation');
        haptics.success();

      } catch (error) {
        console.error('[QuickCreator] Sync failed, queuing order:', error);

        // SYNC FAILED - Queue for later
        const queuedOrder = await orderQueue.addOrder(orderData);

        setOrderResult({
          localId: queuedOrder.localId,
          tempDisplayId: queuedOrder.tempDisplayId,
          realId: null,
          realName: null,
          status: 'pending', // queued
          client,
          equipment,
          problems,
          branchName,
          error: error.message,
        });
        setView('confirmation');

        toast.warning('Sin conexión. Orden guardada localmente.');
        haptics.warning();
      }
    } else {
      // OFFLINE - Queue immediately
      console.log('[QuickCreator] Offline, queuing order...');

      const queuedOrder = await orderQueue.addOrder(orderData);

      setOrderResult({
        localId: queuedOrder.localId,
        tempDisplayId: queuedOrder.tempDisplayId,
        realId: null,
        realName: null,
        status: 'pending', // queued
        client,
        equipment,
        problems,
        branchName,
      });
      setView('confirmation');

      toast.info('Orden guardada. Se sincronizará al recuperar conexión.');
      haptics.impact();
    }

    setIsSubmitting(false);
  };

  // Retry syncing a queued order
  const handleRetrySync = async (localId) => {
    if (!localId) return;

    try {
      const result = await queueProcessor.syncOrder({ localId });

      if (result.success) {
        // Update orderResult with synced data
        setOrderResult(prev => ({
          ...prev,
          realId: result.repair.id,
          realName: result.repair.name,
          status: 'confirmed',
          duplicate: result.duplicate || false,
        }));
        haptics.success();
        toast.success('Orden sincronizada correctamente');
      } else if (result.skipped) {
        toast.info('La orden ya está siendo sincronizada');
      } else {
        throw new Error(result.error || 'Error al sincronizar');
      }
    } catch (error) {
      console.error('[QuickCreator] Retry failed:', error);
      toast.error('Error al sincronizar: ' + error.message);
      haptics.error();
    }
  };

  // Show confirmation screen
  if (view === 'confirmation' && orderResult) {
    return (
      <OrderConfirmation
        orderResult={orderResult}
        onCreateAnother={resetForm}
        onRetry={() => handleRetrySync(orderResult.localId)}
      />
    );
  }

  // Show form
  return (
    <div className="fade-in">
      {/* Header con sucursal integrada */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0,
          }}>
            <ClipboardIcon />
          </div>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: 'var(--text)',
              margin: 0,
            }}>
              Nueva Orden
            </h2>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              margin: 0,
            }}>
              Completa los 3 pasos
            </p>
          </div>
        </div>

      </div>

      {/* Sucursal Banner - Siempre visible arriba */}
      {!configLoading && config?.branches?.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(29, 78, 216, 0.1) 100%)',
          borderRadius: '12px',
          marginBottom: '16px',
          border: '1px solid rgba(37, 99, 235, 0.2)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}>
              <BranchIcon />
            </div>
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: '500',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Sucursal
              </div>
              <div style={{
                fontSize: '16px',
                fontWeight: '700',
                color: 'var(--text)',
              }}>
                {config.branches.find(b => b.id === branchId)?.name || 'Seleccionar'}
              </div>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <select
              value={branchId || ''}
              onChange={(e) => setBranchId(Number(e.target.value))}
              style={{
                padding: '8px 32px 8px 12px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2563eb',
                background: 'white',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                borderRadius: '8px',
                appearance: 'none',
                cursor: 'pointer',
              }}
            >
              {config.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <div style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#2563eb',
            }}>
              <ChevronDownIcon />
            </div>
          </div>
        </div>
      )}

      {/* Sección 1: Cliente */}
      <div className="card" style={{ padding: '20px', marginBottom: '12px' }}>
        <ClientSection
          client={client}
          onClientSelect={(selectedClient) => {
            setClient(selectedClient);
            // Auto-focus equipo cuando se selecciona cliente
            setTimeout(() => {
              if (equipmentRef.current) {
                equipmentRef.current.focus();
              }
            }, 100);
          }}
        />
      </div>

      {/* Sección 2: Equipo */}
      <div className="card" style={{
        padding: '20px',
        marginBottom: '12px',
        opacity: !client ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}>
        <EquipmentSection
          ref={equipmentRef}
          equipment={equipment}
          onChange={setEquipment}
          disabled={!client}
        />
      </div>

      {/* Sección 3: Problema */}
      <div className="card" style={{
        padding: '20px',
        marginBottom: '12px',
        opacity: (!client || !equipment.model) ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}>
        <ProblemSection
          problems={problems}
          note={note}
          onProblemsChange={setProblems}
          onNoteChange={setNote}
          disabled={!client || !equipment.model}
        />
      </div>

      {/* Sección 4: Fecha de Entrega */}
      {!configLoading && config && (
        <div className="card" style={{
          padding: '16px 20px',
          opacity: (!client || !equipment.model || problems.length === 0) ? 0.6 : 1,
          transition: 'opacity 0.2s',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <CalendarIcon />
            <label style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text)',
            }}>
              Fecha de entrega
            </label>
            <div style={{ flex: 1 }} />
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              disabled={!client || !equipment.model || problems.length === 0}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--text)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
              }}
            />
          </div>
          {deliveryDate && (
            <div style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '8px',
              textAlign: 'right',
            }}>
              {formatDateForDisplay(deliveryDate)}
            </div>
          )}
        </div>
      )}

      {/* Create Order Button - Super Prominente */}
      <div style={{
        marginTop: '32px',
        marginBottom: '20px',
        padding: '0 4px',
      }}>
        <button
          onClick={handleCreateOrder}
          disabled={!canSubmit || isSubmitting}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            padding: '20px 28px',
            background: canSubmit
              ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
              : 'var(--border)',
            color: canSubmit ? 'white' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '20px',
            fontSize: '18px',
            fontWeight: '700',
            letterSpacing: '-0.3px',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            boxShadow: canSubmit
              ? '0 8px 25px rgba(37, 99, 235, 0.5), 0 4px 10px rgba(37, 99, 235, 0.3)'
              : 'none',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: canSubmit ? 'translateY(0)' : 'translateY(0)',
            minHeight: '64px',
          }}
          onMouseDown={(e) => {
            if (canSubmit) {
              e.currentTarget.style.transform = 'scale(0.98)';
            }
          }}
          onMouseUp={(e) => {
            if (canSubmit) {
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
          onTouchStart={(e) => {
            if (canSubmit) {
              e.currentTarget.style.transform = 'scale(0.98)';
            }
          }}
          onTouchEnd={(e) => {
            if (canSubmit) {
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          {isSubmitting ? (
            <>
              <div className="spinner" style={{ width: '26px', height: '26px', borderWidth: '3px' }} />
              <span>Creando orden...</span>
            </>
          ) : (
            <>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <span>Crear Orden</span>
            </>
          )}
        </button>

        {/* Hint text when ready */}
        {canSubmit && !isSubmitting && (
          <div style={{
            textAlign: 'center',
            marginTop: '12px',
            fontSize: '13px',
            color: 'var(--text-muted)',
            fontWeight: '500',
          }}>
            Todo listo para crear la orden
          </div>
        )}
      </div>
    </div>
  );
}
