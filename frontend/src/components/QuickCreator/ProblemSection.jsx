import haptics from '../../services/haptics';

// Icons
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const WrenchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

// Problem icons
const ScreenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M12 18h.01" />
  </svg>
);

const BatteryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="6" width="18" height="12" rx="2" />
    <line x1="23" y1="10" x2="23" y2="14" />
  </svg>
);

const ChargingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const PowerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

const SoftwareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const DiagnosticIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const PROBLEMS = [
  { id: 'screen', label: 'Pantalla', icon: ScreenIcon },
  { id: 'battery', label: 'Batería', icon: BatteryIcon },
  { id: 'charging', label: 'Carga', icon: ChargingIcon },
  { id: 'power', label: 'No enciende', icon: PowerIcon },
  { id: 'software', label: 'Software', icon: SoftwareIcon },
  { id: 'diagnostic', label: 'Diagnóstico', icon: DiagnosticIcon },
];

export default function ProblemSection({ problems, note, onProblemsChange, onNoteChange, disabled }) {
  const toggleProblem = (problemId) => {
    haptics.selection();
    if (problems.includes(problemId)) {
      onProblemsChange(problems.filter((p) => p !== problemId));
    } else {
      onProblemsChange([...problems, problemId]);
    }
  };

  const isCompleted = problems.length > 0;

  return (
    <div className="section">
      <div className="section-header" style={{ marginBottom: '16px' }}>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: isCompleted
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : disabled ? 'var(--border)' : 'var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isCompleted ? 'white' : 'var(--text-muted)',
            transition: 'all 0.2s',
          }}>
            {isCompleted ? <CheckIcon /> : <WrenchIcon />}
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '15px', color: disabled ? 'var(--text-muted)' : 'var(--text)' }}>
              Problema
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {isCompleted ? `${problems.length} seleccionado${problems.length > 1 ? 's' : ''}` : 'Selecciona uno o más'}
            </div>
          </div>
        </div>
      </div>

      {/* Grid de problemas con iconos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
        marginBottom: '16px',
      }}>
        {PROBLEMS.map((problem) => {
          const Icon = problem.icon;
          const isSelected = problems.includes(problem.id);
          return (
            <button
              key={problem.id}
              type="button"
              onClick={() => !disabled && toggleProblem(problem.id)}
              disabled={disabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 16px',
                background: isSelected
                  ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                  : 'var(--card-bg)',
                border: isSelected ? 'none' : '1px solid var(--border)',
                borderRadius: '12px',
                color: isSelected ? 'white' : 'var(--text)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon />
              </div>
              {problem.label}
            </button>
          );
        })}
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="note">Nota breve (opcional)</label>
        <textarea
          id="note"
          placeholder="Detalles adicionales..."
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          disabled={disabled}
          rows={2}
          style={{
            resize: 'none',
            minHeight: '80px',
          }}
        />
      </div>
    </div>
  );
}
