import { StatusPill } from './StatusPill.jsx';

function OverrideList({ title, scopeType, overrides, onDelete, featureKey }) {
  return (
    <section className="override-block">
      <div className="override-block__header">
        <h4>{title}</h4>
        <span>{overrides.length}</span>
      </div>

      {overrides.length ? (
        <ul className="override-list">
          {overrides.map((override) => (
            <li key={`${scopeType}-${override.scopeKey}`} className="override-list__item">
              <div>
                <strong>{override.label}</strong>
                <p>{override.scopeKey}</p>
              </div>
              <div className="override-list__controls">
                <StatusPill enabled={override.enabled} />
                <button
                  type="button"
                  className="ghost-button ghost-button--danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(featureKey, scopeType, override.scopeKey);
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-inline">No {title.toLowerCase()} configured yet.</p>
      )}
    </section>
  );
}

export function FeatureCard({
  feature,
  selected,
  onSelect,
  onDefaultChange,
  onDeleteOverride,
  busy,
}) {
  return (
    <article
      className={`feature-card ${selected ? 'is-selected' : ''}`}
      onClick={() => onSelect(feature.key)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(feature.key);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="feature-card__header">
        <div>
          <p className="eyebrow">Feature key</p>
          <h3>{feature.key}</h3>
        </div>
        <StatusPill
          enabled={feature.defaultEnabled}
          label={feature.defaultEnabled ? 'Default on' : 'Default off'}
        />
      </div>

      <p className="feature-card__description">{feature.description}</p>

      <div className="feature-card__actions">
        <button
          type="button"
          className="solid-button"
          disabled={busy || feature.defaultEnabled}
          onClick={(event) => {
            event.stopPropagation();
            onDefaultChange(feature.key, true);
          }}
        >
          Enable default
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={busy || !feature.defaultEnabled}
          onClick={(event) => {
            event.stopPropagation();
            onDefaultChange(feature.key, false);
          }}
        >
          Disable default
        </button>
      </div>

      <div className="feature-card__meta">
        <span>{feature.overrideCount} overrides</span>
        <span>{feature.userOverrides.length} user</span>
        <span>{feature.groupOverrides.length} group</span>
      </div>

      <div className="override-grid">
        <OverrideList
          title="Group overrides"
          scopeType="group"
          overrides={feature.groupOverrides}
          onDelete={onDeleteOverride}
          featureKey={feature.key}
        />
        <OverrideList
          title="User overrides"
          scopeType="user"
          overrides={feature.userOverrides}
          onDelete={onDeleteOverride}
          featureKey={feature.key}
        />
      </div>
    </article>
  );
}
