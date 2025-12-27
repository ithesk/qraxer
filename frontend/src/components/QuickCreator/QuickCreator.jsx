import { useState, useRef } from 'react';
import { api } from '../../services/api';
import { toast } from '../Toast';
import haptics from '../../services/haptics';
import ClientSection from './ClientSection';
import EquipmentSection from './EquipmentSection';
import ProblemSection from './ProblemSection';
import OrderConfirmation from './OrderConfirmation';

// Generate temporary ID
const generateTempId = () => `TMP-${Date.now().toString(36).toUpperCase().slice(-6)}`;

export default function QuickCreator() {
  // Refs
  const equipmentRef = useRef(null);

  // Form state
  const [client, setClient] = useState(null);
  const [equipment, setEquipment] = useState({ brand: '', model: '', serial: '' });
  const [problems, setProblems] = useState([]);
  const [note, setNote] = useState('');

  // UI state
  const [view, setView] = useState('form'); // 'form' | 'confirmation'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  // Check if form is complete enough to submit
  const canSubmit = client && equipment.brand && problems.length > 0;

  // Reset form for new order
  const resetForm = () => {
    setClient(null);
    setEquipment({ brand: '', model: '', serial: '' });
    setProblems([]);
    setNote('');
    setView('form');
    setOrderResult(null);
  };

  // Handle order creation with optimistic UI
  const handleCreateOrder = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    haptics.impact(); // Feedback on submit
    const tempId = generateTempId();

    // Optimistic: show confirmation immediately with temp ID
    setOrderResult({
      tempId,
      realId: null,
      realName: null,
      status: 'pending',
      client,
      equipment,
      problems,
    });
    setView('confirmation');

    try {
      // If client is new (not yet in Odoo), create it first
      let clientId = client.id;

      if (client.isNew) {
        console.log('[QuickCreator] Creating new client...');
        const createResult = await api.createClient(client.name, client.phone);
        clientId = createResult.client.id;
        console.log('[QuickCreator] Client created:', clientId);
      }

      // Create the repair order
      console.log('[QuickCreator] Creating repair order...');
      const orderData = {
        clientId,
        equipment,
        problems,
        note,
      };

      const result = await api.createRepairOrder(orderData);
      console.log('[QuickCreator] Order created:', result);

      // Update with real ID
      setOrderResult(prev => ({
        ...prev,
        realId: result.repair.id,
        realName: result.repair.name,
        status: 'confirmed',
      }));

      // Haptic feedback for success
      haptics.success();

    } catch (error) {
      console.error('[QuickCreator] Error creating order:', error);

      setOrderResult(prev => ({
        ...prev,
        status: 'failed',
        error: error.message,
      }));

      toast.error('No se pudo crear la orden. Intenta de nuevo.');

      // Haptic feedback for error
      haptics.error();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show confirmation screen
  if (view === 'confirmation' && orderResult) {
    return (
      <OrderConfirmation
        orderResult={orderResult}
        onCreateAnother={resetForm}
        onRetry={handleCreateOrder}
      />
    );
  }

  // Show form
  return (
    <div className="fade-in">
      <h2 style={{
        fontSize: '22px',
        fontWeight: '700',
        marginBottom: '20px',
        color: 'var(--text)',
      }}>
        Crear Orden Rapida
      </h2>

      {/* Form Card */}
      <div className="card" style={{ padding: '20px' }}>
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

        <div className="divider" />

        <EquipmentSection
          ref={equipmentRef}
          equipment={equipment}
          onChange={setEquipment}
          disabled={!client}
        />

        <div className="divider" />

        <ProblemSection
          problems={problems}
          note={note}
          onProblemsChange={setProblems}
          onNoteChange={setNote}
          disabled={!client || !equipment.brand}
        />
      </div>

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
