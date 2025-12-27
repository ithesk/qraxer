import haptics from '../../services/haptics';

// Check icon
const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PROBLEMS = [
  { id: 'screen', label: 'Pantalla' },
  { id: 'battery', label: 'Bateria' },
  { id: 'charging', label: 'Carga' },
  { id: 'power', label: 'No enciende' },
  { id: 'software', label: 'Software' },
  { id: 'diagnostic', label: 'Diagnostico' },
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
    <div className="section" style={{ opacity: disabled ? 0.5 : 1 }}>
      <div className="section-header">
        <div className="section-title">
          <span className={`section-number ${isCompleted ? 'completed' : ''}`}>
            {isCompleted ? <CheckIcon /> : '3'}
          </span>
          Problema
        </div>
      </div>

      <div className="chips-container" style={{ marginBottom: '16px' }}>
        {PROBLEMS.map((problem) => (
          <button
            key={problem.id}
            type="button"
            className={`chip ${problems.includes(problem.id) ? 'selected' : ''}`}
            onClick={() => !disabled && toggleProblem(problem.id)}
            disabled={disabled}
          >
            {problem.label}
          </button>
        ))}
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
