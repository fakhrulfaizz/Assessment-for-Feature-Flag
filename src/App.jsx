import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { FeatureCard } from './components/FeatureCard.jsx';
import { MetricCard } from './components/MetricCard.jsx';
import { StatusPill } from './components/StatusPill.jsx';
import { api } from './lib/api.js';

const emptyDashboard = {
  stats: {
    flags: 0,
    users: 0,
    groups: 0,
    overrides: 0,
  },
  features: [],
  users: [],
  groups: [],
};

const emptyCreateForm = {
  key: '',
  description: '',
  defaultEnabled: false,
};

const emptyOverrideForm = {
  scopeType: 'group',
  scopeKey: '',
  enabled: true,
};

const emptyEvaluator = {
  featureKey: '',
  userKey: '',
  groupKey: '',
};

const sourceLabels = {
  default: 'Global default',
  group_override: 'Group override',
  user_override: 'User override',
};

const featureKeyPattern = /^[a-z0-9-]+$/;

function getFeatureKeyError(value) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return '';
  }

  if (!featureKeyPattern.test(normalized)) {
    return 'Only letters, numbers, and hyphens are allowed.';
  }

  return '';
}


export default function App() {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [selectedFeatureKey, setSelectedFeatureKey] = useState('');
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [overrideForm, setOverrideForm] = useState(emptyOverrideForm);
  const [evaluator, setEvaluator] = useState(emptyEvaluator);
  const [evaluation, setEvaluation] = useState(null);
  const [search, setSearch] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const deferredSearch = useDeferredValue(search);
  const featureKeyError = getFeatureKeyError(createForm.key);

  const selectedFeature =
    dashboard.features.find((feature) => feature.key === selectedFeatureKey) ?? null;

  const scopeOptions =
    overrideForm.scopeType === 'group' ? dashboard.groups : dashboard.users;

  const filteredFeatures = dashboard.features.filter((feature) => {
    const haystack = `${feature.key} ${feature.description}`.toLowerCase();
    return haystack.includes(deferredSearch.trim().toLowerCase());
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!dashboard.features.length) {
      return;
    }

    if (!selectedFeatureKey) {
      setSelectedFeatureKey(dashboard.features[0].key);
      return;
    }

    const stillExists = dashboard.features.some(
      (feature) => feature.key === selectedFeatureKey,
    );

    if (!stillExists) {
      setSelectedFeatureKey(dashboard.features[0].key);
    }
  }, [dashboard.features, selectedFeatureKey]);

  useEffect(() => {
    if (!selectedFeatureKey) {
      return;
    }

    setEvaluator((current) => ({
      ...current,
      featureKey: current.featureKey || selectedFeatureKey,
    }));
  }, [selectedFeatureKey]);

  useEffect(() => {
    if (!scopeOptions.length) {
      return;
    }

    const hasCurrentOption = scopeOptions.some(
      (option) => option.key === overrideForm.scopeKey,
    );

    if (!hasCurrentOption) {
      setOverrideForm((current) => ({
        ...current,
        scopeKey: scopeOptions[0].key,
      }));
    }
  }, [overrideForm.scopeKey, overrideForm.scopeType, scopeOptions]);

  async function loadDashboard(preferredFeatureKey) {
    setBusyAction((current) => current || 'loading');
    setError('');

    try {
      const data = await api.getDashboard();

      startTransition(() => {
        setDashboard(data);

        const fallbackFeatureKey =
          preferredFeatureKey && data.features.some((feature) => feature.key === preferredFeatureKey)
            ? preferredFeatureKey
            : data.features[0]?.key ?? '';

        setSelectedFeatureKey(fallbackFeatureKey);
        setEvaluator((current) => ({
          ...current,
          featureKey:
            current.featureKey && data.features.some((feature) => feature.key === current.featureKey)
              ? current.featureKey
              : fallbackFeatureKey,
        }));
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  }

  async function handleCreateFeature(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (featureKeyError) {
      return;
    }

    setBusyAction('create-feature');

    try {
      const createdFeature = await api.createFeature(createForm);
      setCreateForm(emptyCreateForm);
      setNotice(`Created feature "${createdFeature.key}".`);
      await loadDashboard(createdFeature.key);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  }

  async function handleDefaultChange(featureKey, defaultEnabled) {
    setBusyAction('toggle-default');
    setError('');
    setNotice('');

    try {
      await api.updateFeature(featureKey, { defaultEnabled });
      setNotice(
        `Updated "${featureKey}" to default ${defaultEnabled ? 'enabled' : 'disabled'}.`,
      );
      await loadDashboard(featureKey);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  }

  async function handleSaveOverride(event) {
    event.preventDefault();

    if (!selectedFeature) {
      return;
    }

    setBusyAction('save-override');
    setError('');
    setNotice('');

    try {
      await api.upsertOverride(selectedFeature.key, overrideForm);
      setNotice(
        `Saved ${overrideForm.scopeType} override for "${selectedFeature.key}".`,
      );
      await loadDashboard(selectedFeature.key);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  }

  async function handleDeleteOverride(featureKey, scopeType, scopeKey) {
    setBusyAction('delete-override');
    setError('');
    setNotice('');

    try {
      await api.deleteOverride(featureKey, scopeType, scopeKey);
      setNotice(`Removed ${scopeType} override "${scopeKey}" from "${featureKey}".`);
      await loadDashboard(featureKey);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  }

  async function handleEvaluate(event) {
    event.preventDefault();

    if (!evaluator.featureKey) {
      setError('Pick a feature before running an evaluation.');
      return;
    }

    setBusyAction('evaluate');
    setError('');
    setNotice('');
    setEvaluation(null);

    try {
      const result = await api.evaluateFeature(evaluator.featureKey, {
        userKey: evaluator.userKey || undefined,
        groupKey: evaluator.groupKey || undefined,
      });
      setEvaluation(result);
      setNotice(`Evaluation for "${evaluator.featureKey}" completed.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Coding challenge implementation</p>
          <h1>Feature Flag Engine</h1>
          <p className="hero__lede">
            React frontend, SQLite-backed persistence, seeded dummy data, and a
            clean evaluation engine with user-over-group-over-default precedence.
          </p>
        </div>

        <div className="hero__rules">
          <p>Evaluation order</p>
          <div className="rule-stack">
            <span>User override</span>
            <span>Group override</span>
            <span>Global default</span>
          </div>
        </div>
      </header>

      {(error || notice) && (
        <section className="banner-row">
          {error ? <p className="banner banner--error">{error}</p> : null}
          {notice ? <p className="banner banner--notice">{notice}</p> : null}
        </section>
      )}

      <section className="metric-grid">
        <MetricCard
          label="Feature flags"
          value={dashboard.stats.flags}
          helper="Seeded and newly created flags live here."
        />
        <MetricCard
          label="Overrides"
          value={dashboard.stats.overrides}
          helper="User and group rules currently stored in SQLite."
        />
        <MetricCard
          label="Users"
          value={dashboard.stats.users}
          helper="Seed personas available for runtime evaluation."
        />
        <MetricCard
          label="Groups"
          value={dashboard.stats.groups}
          helper="Reusable audience buckets for staged rollouts."
        />
      </section>

      <main className="workspace">
        <section className="panel panel--registry">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Registry</p>
              <h2>Feature catalog</h2>
            </div>
            <span className="section-count">
              {filteredFeatures.length}/{dashboard.features.length}
            </span>
          </div>

          <label className="field">
            <span>Search features</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Try: checkout, smart, support..."
            />
          </label>

          <div className="feature-list">
            {filteredFeatures.map((feature) => (
              <FeatureCard
                key={feature.key}
                feature={feature}
                selected={feature.key === selectedFeatureKey}
                onSelect={setSelectedFeatureKey}
                onDefaultChange={handleDefaultChange}
                onDeleteOverride={handleDeleteOverride}
                busy={Boolean(busyAction)}
              />
            ))}

            {!filteredFeatures.length ? (
              <div className="empty-state">
                <h3>No features match that search.</h3>
                <p>Clear the filter or create a new flag from the control panel.</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="side-column">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Mutation</p>
                <h2>Create a new flag</h2>
              </div>
            </div>

            <form className="stack-form" onSubmit={handleCreateFeature}>
              <label className="field">
                <span>Feature key</span>
                <input
                  value={createForm.key}
                  aria-invalid={Boolean(featureKeyError)}
                  onChange={(event) => {
                    setCreateForm((current) => ({
                      ...current,
                      key: event.target.value.toLowerCase(),
                    }));
                  }}
                  placeholder="example: staged-pricing-banner"
                />

                {featureKeyError ? (
                  <small className="error-text">{featureKeyError}</small>
                ) : null}
              </label>

              <label className="field">
                <span>Description</span>
                <textarea
                  rows="3"
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe what the flag turns on or off."
                />
              </label>

              <label className="field">
                <span>Global default</span>
                <select
                  value={String(createForm.defaultEnabled)}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      defaultEnabled: event.target.value === 'true',
                    }))
                  }
                >
                  <option value="false">Disabled</option>
                  <option value="true">Enabled</option>
                </select>
              </label>

              <button
                type="submit"
                className="solid-button solid-button--wide"
                disabled={
                  Boolean(busyAction) ||
                  !createForm.key.trim() ||
                  Boolean(featureKeyError)
                }
              >
                Create feature
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Focused controls</p>
                <h2>{selectedFeature ? selectedFeature.key : 'Pick a feature'}</h2>
              </div>
            </div>

            {selectedFeature ? (
              <>
                <p className="panel-copy">{selectedFeature.description}</p>

                <div className="selected-feature">
                  <div className="selected-feature__status">
                    <StatusPill
                      enabled={selectedFeature.defaultEnabled}
                      label={
                        selectedFeature.defaultEnabled
                          ? 'Global default enabled'
                          : 'Global default disabled'
                      }
                    />
                    <span>
                      User override {'>'} Group override {'>'} Global default
                    </span>
                  </div>

                  <div className="button-row">
                    <button
                      type="button"
                      className="solid-button"
                      disabled={Boolean(busyAction) || selectedFeature.defaultEnabled}
                      onClick={() => handleDefaultChange(selectedFeature.key, true)}
                    >
                      Enable by default
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={Boolean(busyAction) || !selectedFeature.defaultEnabled}
                      onClick={() => handleDefaultChange(selectedFeature.key, false)}
                    >
                      Disable by default
                    </button>
                  </div>
                </div>

                <form className="stack-form" onSubmit={handleSaveOverride}>
                  <label className="field">
                    <span>Override type</span>
                    <select
                      value={overrideForm.scopeType}
                      onChange={(event) =>
                        setOverrideForm((current) => ({
                          ...current,
                          scopeType: event.target.value,
                          scopeKey: '',
                        }))
                      }
                    >
                      <option value="group">Group</option>
                      <option value="user">User</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>{overrideForm.scopeType === 'group' ? 'Group' : 'User'}</span>
                    <select
                      value={overrideForm.scopeKey}
                      onChange={(event) =>
                        setOverrideForm((current) => ({
                          ...current,
                          scopeKey: event.target.value,
                        }))
                      }
                    >
                      {scopeOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Override state</span>
                    <select
                      value={String(overrideForm.enabled)}
                      onChange={(event) =>
                        setOverrideForm((current) => ({
                          ...current,
                          enabled: event.target.value === 'true',
                        }))
                      }
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </label>

                  <button
                    type="submit"
                    className="solid-button solid-button--wide"
                    disabled={Boolean(busyAction) || !overrideForm.scopeKey}
                  >
                    Save override
                  </button>
                </form>
              </>
            ) : (
              <div className="empty-state">
                <h3>Select a feature</h3>
                <p>The mutation controls will follow the highlighted card.</p>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Runtime evaluation</p>
                <h2>Evaluation lab</h2>
              </div>
            </div>

            <form className="stack-form" onSubmit={handleEvaluate}>
              <label className="field">
                <span>Feature</span>
                <select
                  value={evaluator.featureKey}
                  onChange={(event) =>
                    setEvaluator((current) => ({
                      ...current,
                      featureKey: event.target.value,
                    }))
                  }
                >
                  {dashboard.features.map((feature) => (
                    <option key={feature.key} value={feature.key}>
                      {feature.key}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>User (optional)</span>
                <select
                  value={evaluator.userKey}
                  onChange={(event) =>
                    setEvaluator((current) => ({
                      ...current,
                      userKey: event.target.value,
                    }))
                  }
                >
                  <option value="">No user context</option>
                  {dashboard.users.map((user) => (
                    <option key={user.key} value={user.key}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Explicit group (optional)</span>
                <select
                  value={evaluator.groupKey}
                  onChange={(event) =>
                    setEvaluator((current) => ({
                      ...current,
                      groupKey: event.target.value,
                    }))
                  }
                >
                  <option value="">Auto from user / no group</option>
                  {dashboard.groups.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="solid-button solid-button--wide"
                disabled={Boolean(busyAction)}
              >
                Evaluate flag
              </button>
            </form>

            {evaluation ? (
              <div className="result-card">
                <div className="result-card__hero">
                  <div>
                    <p className="eyebrow">Resolved decision</p>
                    <h3>{evaluation.enabled ? 'Enabled' : 'Disabled'}</h3>
                  </div>
                  <StatusPill enabled={evaluation.enabled} />
                </div>

                <dl className="result-grid">
                  <div>
                    <dt>Source</dt>
                    <dd>{sourceLabels[evaluation.source]}</dd>
                  </div>
                  <div>
                    <dt>User</dt>
                    <dd>{evaluation.context.userName ?? 'None'}</dd>
                  </div>
                  <div>
                    <dt>Resolved group</dt>
                    <dd>{evaluation.context.resolvedGroupName ?? 'None'}</dd>
                  </div>
                  <div>
                    <dt>Matched scope</dt>
                    <dd>{evaluation.matchedScope.type.replace('_', ' ')}</dd>
                  </div>
                </dl>

                <div className="inspection-strip">
                  <span>
                    Default: {evaluation.inspected.defaultEnabled ? 'on' : 'off'}
                  </span>
                  <span>
                    Group:{' '}
                    {evaluation.inspected.groupOverride
                      ? evaluation.inspected.groupOverride.enabled
                        ? 'on'
                        : 'off'
                      : 'none'}
                  </span>
                  <span>
                    User:{' '}
                    {evaluation.inspected.userOverride
                      ? evaluation.inspected.userOverride.enabled
                        ? 'on'
                        : 'off'
                      : 'none'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="empty-state empty-state--compact">
                <h3>Run a scenario</h3>
                <p>
                  Pick a feature, optionally add user or group context, and verify
                  how the engine resolves the final state.
                </p>
              </div>
            )}

            <div className="seed-grid">
              <section>
                <div className="section-heading section-heading--nested">
                  <h3>Seed users</h3>
                </div>
                <ul className="seed-list">
                  {dashboard.users.map((user) => (
                    <li key={user.key}>
                      <strong>{user.name}</strong>
                      <span>{user.groupName ?? 'No group'}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <div className="section-heading section-heading--nested">
                  <h3>Seed groups</h3>
                </div>
                <ul className="seed-list">
                  {dashboard.groups.map((group) => (
                    <li key={group.key}>
                      <strong>{group.name}</strong>
                      <span>{group.description}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
