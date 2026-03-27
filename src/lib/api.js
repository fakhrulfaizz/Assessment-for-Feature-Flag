async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Request failed.');
  }

  return payload?.data;
}

export const api = {
  getDashboard() {
    return request('/api/dashboard');
  },

  createFeature(input) {
    return request('/api/features', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateFeature(featureKey, input) {
    return request(`/api/features/${featureKey}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  evaluateFeature(featureKey, input) {
    return request(`/api/features/${featureKey}/evaluate`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  upsertOverride(featureKey, input) {
    return request(`/api/features/${featureKey}/overrides`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  deleteOverride(featureKey, scopeType, scopeKey) {
    return request(
      `/api/features/${featureKey}/overrides/${scopeType}/${scopeKey}`,
      {
        method: 'DELETE',
      },
    );
  },
};
