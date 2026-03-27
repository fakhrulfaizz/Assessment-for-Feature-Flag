export function StatusPill({ enabled, label }) {
  return (
    <span className={`status-pill ${enabled ? 'is-enabled' : 'is-disabled'}`}>
      {label ?? (enabled ? 'Enabled' : 'Disabled')}
    </span>
  );
}
