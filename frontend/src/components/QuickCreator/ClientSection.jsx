import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { toast } from '../Toast';
import haptics from '../../services/haptics';
import { SkeletonClientCard } from '../Skeleton';

// Icons
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default function ClientSection({ client, onClientSelect }) {
  const [phone, setPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const searchTimeoutRef = useRef(null);
  const lastSearchedPhone = useRef('');

  // Auto-search function
  const doSearch = useCallback(async (phoneNumber) => {
    if (phoneNumber.length < 10 || phoneNumber === lastSearchedPhone.current) {
      return;
    }

    lastSearchedPhone.current = phoneNumber;
    setIsSearching(true);
    setSearchResult(null);
    setShowCreateForm(false);

    try {
      const result = await api.searchClient(phoneNumber);
      setSearchResult(result);

      if (!result.found) {
        setShowCreateForm(true);
      }
    } catch (error) {
      console.error('[ClientSection] Search error:', error);
      toast.error('Error al buscar cliente');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(value);

    // Reset search when phone changes significantly
    if (searchResult && value.length < 10) {
      setSearchResult(null);
      setShowCreateForm(false);
      lastSearchedPhone.current = '';
    }

    // Clear any pending search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Auto-search when phone reaches 10 digits
    if (value.length === 10) {
      searchTimeoutRef.current = setTimeout(() => {
        doSearch(value);
      }, 300);
    }
  };

  const handleSelectClient = (selectedClient) => {
    haptics.success();
    onClientSelect({
      id: selectedClient.id,
      name: selectedClient.name,
      phone: selectedClient.phone,
      isNew: false,
    });
  };

  const handleCreateClient = () => {
    if (!newClientName.trim()) {
      haptics.warning();
      toast.warning('Ingresa el nombre del cliente');
      return;
    }

    haptics.success();
    onClientSelect({
      id: null,
      name: newClientName.trim(),
      phone,
      isNew: true,
    });
  };

  const handleClearClient = () => {
    onClientSelect(null);
    setPhone('');
    setNewClientName('');
    setSearchResult(null);
    setShowCreateForm(false);
    lastSearchedPhone.current = '';
  };

  const isCompleted = client !== null;

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title">
          <span className={`section-number ${isCompleted ? 'completed' : ''}`}>
            {isCompleted ? <CheckIcon /> : '1'}
          </span>
          Cliente
        </div>
        {isCompleted && (
          <button
            className="btn-ghost"
            onClick={handleClearClient}
            style={{ padding: '8px 12px', minHeight: '36px', fontSize: '14px' }}
          >
            Cambiar
          </button>
        )}
      </div>

      {/* Selected client card */}
      {client && (
        <div className="client-card selected">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '700',
              fontSize: '15px',
              flexShrink: 0,
            }}>
              {client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div className="client-info">
              <div className="client-name">{client.name}</div>
              <div className="client-phone">{client.phone}</div>
              {client.isNew && (
                <span style={{
                  fontSize: '11px',
                  color: 'var(--warning)',
                  fontWeight: '600',
                }}>
                  Nuevo cliente
                </span>
              )}
            </div>
          </div>
          <span className="section-check">
            <CheckIcon />
          </span>
        </div>
      )}

      {/* Form when no client selected */}
      {!client && (
        <>
          {/* Phone input */}
          <div style={{ position: 'relative' }}>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Teléfono (10 dígitos)"
              value={phone}
              onChange={handlePhoneChange}
              maxLength={10}
              style={{
                paddingRight: isSearching ? '50px' : '16px',
              }}
            />
            {isSearching && (
              <div style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                fontWeight: '500',
              }}>
                Buscando...
              </div>
            )}
            {phone.length > 0 && phone.length < 10 && !isSearching && (
              <div style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                fontWeight: '500',
              }}>
                {phone.length}/10
              </div>
            )}
          </div>

          {/* Loading skeleton */}
          {isSearching && (
            <div style={{ marginTop: '12px' }} className="fade-in">
              <SkeletonClientCard />
            </div>
          )}

          {/* Found clients */}
          {!isSearching && searchResult?.found && searchResult.clients.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              {searchResult.clients.map((c) => (
                <div
                  key={c.id}
                  className="client-card"
                  onClick={() => handleSelectClient(c)}
                  style={{ marginBottom: '8px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                      flexShrink: 0,
                    }}>
                      <UserIcon />
                    </div>
                    <div className="client-info">
                      <div className="client-name">{c.name}</div>
                      <div className="client-phone">{c.phone}</div>
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    style={{
                      padding: '10px 16px',
                      minHeight: '40px',
                      fontSize: '14px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectClient(c);
                    }}
                  >
                    Usar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Not found - Create new client */}
          {showCreateForm && (
            <div style={{ marginTop: '12px' }}>
              <div style={{
                padding: '16px',
                background: 'var(--warning-bg)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #fed7aa',
              }}>
                <p style={{
                  color: 'var(--warning)',
                  fontSize: '13px',
                  marginBottom: '12px',
                  fontWeight: '500',
                }}>
                  Cliente no encontrado
                </p>

                <input
                  type="text"
                  placeholder="Nombre del cliente"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateClient()}
                  autoFocus
                  style={{ marginBottom: '12px' }}
                />

                <button
                  className="btn-primary"
                  onClick={handleCreateClient}
                  disabled={!newClientName.trim()}
                  style={{ width: '100%' }}
                >
                  <PlusIcon />
                  Crear cliente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
