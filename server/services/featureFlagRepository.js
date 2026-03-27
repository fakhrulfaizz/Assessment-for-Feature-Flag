function mapFeatureRows(rows) {
  const features = new Map();

  for (const row of rows) {
    let feature = features.get(row.key);

    if (!feature) {
      feature = {
        key: row.key,
        description: row.description ?? '',
        defaultEnabled: Boolean(row.defaultEnabled),
        userOverrides: [],
        groupOverrides: [],
      };
      features.set(row.key, feature);
    }

    if (!row.scopeType) {
      continue;
    }

    const override = {
      scopeKey: row.scopeKey,
      label:
        row.scopeType === 'user'
          ? row.userName ?? row.scopeKey
          : row.groupName ?? row.scopeKey,
      enabled: Boolean(row.overrideEnabled),
    };

    if (row.scopeType === 'user') {
      feature.userOverrides.push(override);
      continue;
    }

    feature.groupOverrides.push(override);
  }

  return Array.from(features.values()).map((feature) => ({
    ...feature,
    overrideCount: feature.userOverrides.length + feature.groupOverrides.length,
  }));
}

export function createFeatureFlagRepository(db) {
  return {
    async listFeatures() {
      const rows = await db.all(
        `
          SELECT
            f.id,
            f.key,
            f.description,
            f.default_enabled AS defaultEnabled,
            o.scope_type AS scopeType,
            o.scope_key AS scopeKey,
            o.enabled AS overrideEnabled,
            u.name AS userName,
            g.name AS groupName
          FROM features f
          LEFT JOIN overrides o ON o.feature_id = f.id
          LEFT JOIN users u ON o.scope_type = 'user' AND u.key = o.scope_key
          LEFT JOIN groups g ON o.scope_type = 'group' AND g.key = o.scope_key
          ORDER BY f.key, o.scope_type, o.scope_key
        `,
      );

      return mapFeatureRows(rows);
    },

    async getFeatureByKey(key) {
      const rows = await db.all(
        `
          SELECT
            f.id,
            f.key,
            f.description,
            f.default_enabled AS defaultEnabled,
            o.scope_type AS scopeType,
            o.scope_key AS scopeKey,
            o.enabled AS overrideEnabled,
            u.name AS userName,
            g.name AS groupName
          FROM features f
          LEFT JOIN overrides o ON o.feature_id = f.id
          LEFT JOIN users u ON o.scope_type = 'user' AND u.key = o.scope_key
          LEFT JOIN groups g ON o.scope_type = 'group' AND g.key = o.scope_key
          WHERE f.key = ?
          ORDER BY o.scope_type, o.scope_key
        `,
        [key],
      );

      if (!rows.length) {
        return null;
      }

      return mapFeatureRows(rows)[0];
    },

    getFeatureRecordByKey(key) {
      return db.get(
        `
          SELECT
            id,
            key,
            description,
            default_enabled AS defaultEnabled
          FROM features
          WHERE key = ?
        `,
        [key],
      );
    },

    async createFeature({ key, description, defaultEnabled }) {
      await db.run(
        `
          INSERT INTO features (key, description, default_enabled)
          VALUES (?, ?, ?)
        `,
        [key, description, defaultEnabled ? 1 : 0],
      );
    },

    async updateFeature({ key, description, defaultEnabled }) {
      await db.run(
        `
          UPDATE features
          SET description = ?, default_enabled = ?, updated_at = CURRENT_TIMESTAMP
          WHERE key = ?
        `,
        [description, defaultEnabled ? 1 : 0, key],
      );
    },

    listGroups() {
      return db.all(
        `
          SELECT key, name, description
          FROM groups
          ORDER BY name
        `,
      );
    },

    getGroupByKey(key) {
      return db.get(
        `
          SELECT key, name, description
          FROM groups
          WHERE key = ?
        `,
        [key],
      );
    },

    listUsers() {
      return db.all(
        `
          SELECT
            u.key,
            u.name,
            u.email,
            g.key AS groupKey,
            g.name AS groupName
          FROM users u
          LEFT JOIN groups g ON g.id = u.group_id
          ORDER BY u.name
        `,
      );
    },

    getUserByKey(key) {
      return db.get(
        `
          SELECT
            u.key,
            u.name,
            u.email,
            g.key AS groupKey,
            g.name AS groupName
          FROM users u
          LEFT JOIN groups g ON g.id = u.group_id
          WHERE u.key = ?
        `,
        [key],
      );
    },

    getOverride(featureId, scopeType, scopeKey) {
      return db.get(
        `
          SELECT scope_type AS scopeType, scope_key AS scopeKey, enabled
          FROM overrides
          WHERE feature_id = ? AND scope_type = ? AND scope_key = ?
        `,
        [featureId, scopeType, scopeKey],
      );
    },

    async upsertOverride({ featureId, scopeType, scopeKey, enabled }) {
      await db.run(
        `
          INSERT INTO overrides (feature_id, scope_type, scope_key, enabled)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(feature_id, scope_type, scope_key)
          DO UPDATE SET
            enabled = excluded.enabled,
            updated_at = CURRENT_TIMESTAMP
        `,
        [featureId, scopeType, scopeKey, enabled ? 1 : 0],
      );
    },

    deleteOverride(featureId, scopeType, scopeKey) {
      return db.run(
        `
          DELETE FROM overrides
          WHERE feature_id = ? AND scope_type = ? AND scope_key = ?
        `,
        [featureId, scopeType, scopeKey],
      );
    },
  };
}
