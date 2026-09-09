import './InterfaceSwitcher.css';

export default function InterfaceSwitcher({ value, onChange, disabled = false }) {
  return (
    <div className="interface-switcher" role="group" aria-label="Reports interface">
      <span className="interface-switcher-label">Interface</span>
      <div className="interface-switcher-options">
        {['old', 'new'].map((mode) => (
          <button
            key={mode}
            type="button"
            aria-label={`${mode === 'old' ? 'Old' : 'New'} interface`}
            aria-pressed={value === mode}
            disabled={disabled}
            onClick={() => onChange(mode)}
          >
            {mode === 'old' ? 'Old' : 'New'}
          </button>
        ))}
      </div>
    </div>
  );
}
