import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInventoryScanner } from '../hooks/useInventoryScanner';
import { toast } from './Toast';
import haptics from '../services/haptics';

const CloseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PlusIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const MinusIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3,6 5,6 21,6" />
    <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6" />
  </svg>
);

const formatSessionName = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Sesion';
  return `Sesion ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export default function InventoryScanModal() {
  const [sessions, setSessions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('inv_count_sessions_v1') || '[]');
    } catch (e) {
      return [];
    }
  });
  const [activeSessionId, setActiveSessionId] = useState(() => {
    try {
      return localStorage.getItem('inv_active_session_v1');
    } catch (e) {
      return null;
    }
  });
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('inv_count_history_v1') || '[]');
    } catch (e) {
      return [];
    }
  });
  const {
    start,
    stop,
    isActive,
    lastCode,
    lines,
    totalItems,
    inc,
    dec,
    clear,
    submit,
  } = useInventoryScanner({ sessionId: activeSessionId || 'default' });

  const [submitting, setSubmitting] = useState(false);
  const portalTarget = useMemo(() => (typeof document !== 'undefined' ? document.body : null), []);

  useEffect(() => {
    try {
      const savedSessions = JSON.parse(localStorage.getItem('inv_count_sessions_v1') || '[]');
      const savedActive = localStorage.getItem('inv_active_session_v1');
      const savedHistory = JSON.parse(localStorage.getItem('inv_count_history_v1') || '[]');
      const normalizedSessions = (savedSessions || []).map((session) => ({
        ...session,
        name: session.name || formatSessionName(session.createdAt),
      }));
      setSessions(normalizedSessions);
      setHistory(savedHistory);
      if (savedActive) {
        setActiveSessionId(savedActive);
      } else if (savedSessions.length > 0) {
        setActiveSessionId(savedSessions[0].id);
      } else {
        const newId = `sess_${Date.now()}`;
        const now = Date.now();
        const next = [
          {
            id: newId,
            createdAt: now,
            updatedAt: now,
            totalItems: 0,
            name: formatSessionName(now),
          },
        ];
        setSessions(next);
        localStorage.setItem('inv_count_sessions_v1', JSON.stringify(next));
        setActiveSessionId(newId);
      }
    } catch (e) {
      const newId = `sess_${Date.now()}`;
      const now = Date.now();
      const next = [
        {
          id: newId,
          createdAt: now,
          updatedAt: now,
          totalItems: 0,
          name: formatSessionName(now),
        },
      ];
      setSessions(next);
      localStorage.setItem('inv_count_sessions_v1', JSON.stringify(next));
      setActiveSessionId(newId);
    }
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    localStorage.setItem('inv_active_session_v1', activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) return;
    const now = Date.now();
    setSessions((prev) => {
      const nextSessions = prev.map((session) => {
        if (session.id !== activeSessionId) return session;
        return {
          ...session,
          updatedAt: now,
          totalItems,
          lastCode: lastCode || session.lastCode || null,
        };
      });
      localStorage.setItem('inv_count_sessions_v1', JSON.stringify(nextSessions));
      return nextSessions;
    });
  }, [activeSessionId, lastCode, totalItems]);

  const handleStart = async () => {
    try {
      await start();
    } catch (err) {
      toast.error('No se pudo iniciar el escaner');
    }
  };

  const handleStop = async () => {
    try {
      await stop();
    } catch (err) {
      toast.error('No se pudo detener el escaner');
    }
  };

  const handleSubmit = async () => {
    if (lines.length === 0 || submitting) return;
    setSubmitting(true);
    haptics.light();
    try {
      const submitted = await submit();
      if (submitted && submitted.length > 0) {
        const entry = {
          id: `hist_${Date.now()}`,
          submittedAt: Date.now(),
          totalItems: submitted.reduce((sum, line) => sum + line.qty, 0),
          lines: submitted,
        };
        const nextHistory = [entry, ...history].slice(0, 3);
        setHistory(nextHistory);
        localStorage.setItem('inv_count_history_v1', JSON.stringify(nextHistory));
      }
      toast.success('Conteo enviado');
      await stop();
    } catch (err) {
      toast.error('Error al enviar conteo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    if (lines.length === 0) return;
    clear();
  };

  const handleNewSession = () => {
    const newId = `sess_${Date.now()}`;
    const now = Date.now();
    const nextSessions = [
      {
        id: newId,
        createdAt: now,
        updatedAt: now,
        totalItems: 0,
        lastCode: null,
        name: formatSessionName(now),
      },
      ...sessions,
    ].slice(0, 3);
    setSessions(nextSessions);
    localStorage.setItem('inv_count_sessions_v1', JSON.stringify(nextSessions));
    localStorage.setItem(`inv_count_draft_v1_${newId}`, '[]');
    setActiveSessionId(newId);
  };

  const handleSelectSession = (sessionId) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
  };

  const handleDeleteSession = (sessionId) => {
    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    setSessions(nextSessions);
    localStorage.setItem('inv_count_sessions_v1', JSON.stringify(nextSessions));
    localStorage.removeItem(`inv_count_draft_v1_${sessionId}`);

    if (activeSessionId === sessionId) {
      if (nextSessions.length > 0) {
        setActiveSessionId(nextSessions[0].id);
      } else {
        const newId = `sess_${Date.now()}`;
        const now = Date.now();
        const next = [
          {
            id: newId,
            createdAt: now,
            updatedAt: now,
            totalItems: 0,
            name: formatSessionName(now),
          },
        ];
        setSessions(next);
        localStorage.setItem('inv_count_sessions_v1', JSON.stringify(next));
        setActiveSessionId(newId);
      }
    }
  };

  const modal = isActive ? (
    <div className="barcode-scanning-modal">
      <div className="barcode-scanning-topbar">
        <div>
          <div className="barcode-scanning-title">Escaneando...</div>
          <div className="barcode-scanning-subtitle">{totalItems} items</div>
        </div>
        <button className="btn-ghost barcode-scanning-close" onClick={handleStop}>
          <CloseIcon />
          Cerrar
        </button>
      </div>

      <div className="barcode-scanning-sheet">
        <div className="barcode-scanning-handle" />
        <div className="barcode-scanning-last">
          <span>Ultimo codigo</span>
          <strong>{lastCode || '-'}</strong>
        </div>

        <div className="barcode-scanning-list">
          {lines.length === 0 && (
            <div className="barcode-scanning-empty">Escanea un producto para comenzar</div>
          )}
          {lines.map((line) => (
            <div key={line.barcode} className="barcode-scanning-row">
              <div className="barcode-scanning-info">
                <div className="barcode-scanning-name">{line.name}</div>
                <div className="barcode-scanning-barcode">{line.barcode}</div>
              </div>
              <div className="barcode-scanning-qty">
                <button className="btn-icon btn-secondary" onClick={() => dec(line.barcode)}>
                  <MinusIcon />
                </button>
                <span>{line.qty}</span>
                <button className="btn-icon btn-secondary" onClick={() => inc(line.barcode)}>
                  <PlusIcon />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="barcode-scanning-actions">
          <button className="btn-secondary" onClick={handleClear} disabled={lines.length === 0}>
            Limpiar
          </button>
          <button className="btn-success" onClick={handleSubmit} disabled={lines.length === 0 || submitting}>
            Enviar contado
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="inventory-count-page">
        <div className="inventory-header">
          <div>
            <div className="inventory-title">Conteo de inventario</div>
            <div className="inventory-subtitle">Sesion actual: {activeSessionId || '-'}</div>
          </div>
          <div className="inventory-new-session">
            <button className="btn-secondary" onClick={handleNewSession}>
              <span aria-hidden="true">➕</span>
              Nueva sesion
            </button>
            <span className="inventory-new-session-hint">Empieza un conteo desde cero.</span>
          </div>
        </div>

        <div className="inventory-card">
          <div className="inventory-card-row">
            <div>
              <div className="inventory-card-label">Items contados</div>
              <div className="inventory-card-value">{totalItems}</div>
            </div>
            <div>
              <div className="inventory-card-label">Ultimo codigo</div>
              <div className="inventory-card-value">{lastCode || '-'}</div>
            </div>
          </div>
          <button className="btn-primary btn-large" onClick={handleStart}>
            Iniciar escaneo continuo
          </button>
        </div>

        <div className="inventory-section">
          <div className="inventory-section-title">Detalle de la sesion</div>
          {lines.length === 0 && (
            <div className="inventory-empty">No hay items en esta sesion</div>
          )}
          {lines.slice(0, 5).map((line) => (
            <div key={line.barcode} className="inventory-line-row">
              <div className="inventory-line-info">
                <div className="inventory-line-name">{line.name}</div>
                <div className="inventory-line-barcode">{line.barcode}</div>
              </div>
              <div className="inventory-line-qty">{line.qty}</div>
            </div>
          ))}
          {lines.length > 5 && (
            <div className="inventory-empty">+{lines.length - 5} mas</div>
          )}
        </div>

        <div className="inventory-section">
          <div className="inventory-section-title">Sesiones</div>
          <div className="inventory-session-list">
            {sessions.map((session) => (
              <button
                key={session.id}
                className={`inventory-session-card ${session.id === activeSessionId ? 'active' : ''}`}
                onClick={() => handleSelectSession(session.id)}
              >
                <div>
                  <div className="inventory-session-id">{session.name || 'Sesion'}</div>
                  <div className="inventory-session-meta">
                    {session.totalItems || 0} items
                  </div>
                </div>
                <div className="inventory-session-actions">
                  <span className="inventory-session-last">{session.lastCode || '-'}</span>
                  <button
                    className="inventory-session-delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    aria-label={`Eliminar ${session.name || 'Sesion'}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="inventory-section">
          <div className="inventory-section-title">Historial reciente</div>
          {history.length === 0 && (
            <div className="inventory-empty">
              Aun no hay conteos enviados
              <button className="btn-primary inventory-empty-cta" onClick={handleStart}>
                Enviar sesion actual
              </button>
            </div>
          )}
          {history.map((entry) => (
            <div key={entry.id} className="inventory-history-card">
              <div>
                <div className="inventory-history-title">{entry.totalItems} items</div>
                <div className="inventory-history-meta">
                  {new Date(entry.submittedAt).toLocaleString()}
                </div>
              </div>
              <div className="inventory-history-lines">
                {entry.lines?.length || 0} lineas
              </div>
            </div>
          ))}
        </div>
      </div>
      {portalTarget ? createPortal(modal, portalTarget) : modal}
    </>
  );
}
