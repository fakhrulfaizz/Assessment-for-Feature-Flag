import { evaluateFeatureFlag } from '../domain/featureFlagEngine.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../domain/errors.js';

const KEY_PATTERN = /^[a-z0-9][a-z0-9-_]*$/;

function normalizeKey(value, fieldName) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string.`);
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    throw new ValidationError(`${fieldName} is required.`);
  }

  if (!KEY_PATTERN.test(normalized)) {
    throw new ValidationError(
      `${fieldName} must use lowercase letters, numbers, hyphens, or underscores.`,
    );
  }

  return normalized;
}

function normalizeScopeType(value) {
  if (typeof value !== 'string') {
    throw new ValidationError('scopeType must be provided.');
  }

  const normalized = value.trim().toLowerCase();

  if (normalized !== 'user' && normalized !== 'group') {
    throw new ValidationError('scopeType must be either "user" or "group".');
  }

  return normalized;
}

function normalizeDescription(value) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new ValidationError('description must be a string.');
  }

  return value.trim();
}

function assertBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${fieldName} must be a boolean.`);
  }

  return value;
}

export function createFeatureFlagService(repository) {
  return {
    async getDashboard() {
      const [features, users, groups] = await Promise.all([
        repository.listFeatures(),
        repository.listUsers(),
        repository.listGroups(),
      ]);

      const groupOverrides = features.reduce(
        (total, feature) => total + feature.groupOverrides.length,
        0,
      );
      const userOverrides = features.reduce(
        (total, feature) => total + feature.userOverrides.length,
        0,
      );

      return {
        stats: {
          flags: features.length,
          users: users.length,
          groups: groups.length,
          overrides: groupOverrides + userOverrides,
        },
        features,
        users,
        groups,
      };
    },

    listFlags() {
      return repository.listFeatures();
    },

    async getFlag(featureKey) {
      const normalizedFeatureKey = normalizeKey(featureKey, 'feature key');
      const feature = await repository.getFeatureByKey(normalizedFeatureKey);

      if (!feature) {
        throw new NotFoundError(`Feature "${normalizedFeatureKey}" was not found.`);
      }

      return feature;
    },

    async createFlag(input) {
      const key = normalizeKey(input.key, 'feature key');
      const description = normalizeDescription(input.description);
      const defaultEnabled = assertBoolean(
        input.defaultEnabled,
        'defaultEnabled',
      );

      const existingFeature = await repository.getFeatureRecordByKey(key);

      if (existingFeature) {
        throw new ConflictError(`Feature "${key}" already exists.`);
      }

      await repository.createFeature({
        key,
        description,
        defaultEnabled,
      });

      return this.getFlag(key);
    },

    async updateFlag(featureKey, input) {
      const key = normalizeKey(featureKey, 'feature key');
      const existingFeature = await repository.getFeatureRecordByKey(key);

      if (!existingFeature) {
        throw new NotFoundError(`Feature "${key}" was not found.`);
      }

      const nextDescription =
        input.description === undefined
          ? existingFeature.description ?? ''
          : normalizeDescription(input.description);
      const nextDefaultEnabled =
        input.defaultEnabled === undefined
          ? Boolean(existingFeature.defaultEnabled)
          : assertBoolean(input.defaultEnabled, 'defaultEnabled');

      await repository.updateFeature({
        key,
        description: nextDescription,
        defaultEnabled: nextDefaultEnabled,
      });

      return this.getFlag(key);
    },

    async upsertOverride(featureKey, input) {
      const key = normalizeKey(featureKey, 'feature key');
      const scopeType = normalizeScopeType(input.scopeType);
      const scopeKey = normalizeKey(input.scopeKey, `${scopeType} key`);
      const enabled = assertBoolean(input.enabled, 'enabled');

      const feature = await repository.getFeatureRecordByKey(key);

      if (!feature) {
        throw new NotFoundError(`Feature "${key}" was not found.`);
      }

      if (scopeType === 'user') {
        const user = await repository.getUserByKey(scopeKey);

        if (!user) {
          throw new NotFoundError(`User "${scopeKey}" was not found.`);
        }
      } else {
        const group = await repository.getGroupByKey(scopeKey);

        if (!group) {
          throw new NotFoundError(`Group "${scopeKey}" was not found.`);
        }
      }

      await repository.upsertOverride({
        featureId: feature.id,
        scopeType,
        scopeKey,
        enabled,
      });

      return this.getFlag(key);
    },

    async deleteOverride(featureKey, scopeTypeValue, scopeKeyValue) {
      const key = normalizeKey(featureKey, 'feature key');
      const scopeType = normalizeScopeType(scopeTypeValue);
      const scopeKey = normalizeKey(scopeKeyValue, `${scopeType} key`);

      const feature = await repository.getFeatureRecordByKey(key);

      if (!feature) {
        throw new NotFoundError(`Feature "${key}" was not found.`);
      }

      const result = await repository.deleteOverride(feature.id, scopeType, scopeKey);

      if (!result.changes) {
        throw new NotFoundError(
          `Override "${scopeType}:${scopeKey}" does not exist for "${key}".`,
        );
      }

      return this.getFlag(key);
    },

    async evaluateFlag(featureKey, context = {}) {
      const key = normalizeKey(featureKey, 'feature key');
      const feature = await repository.getFeatureRecordByKey(key);

      if (!feature) {
        throw new NotFoundError(`Feature "${key}" was not found.`);
      }

      const userKey = context.userKey
        ? normalizeKey(context.userKey, 'user key')
        : null;
      const groupKey = context.groupKey
        ? normalizeKey(context.groupKey, 'group key')
        : null;

      let user = null;
      let explicitGroup = null;

      if (userKey) {
        user = await repository.getUserByKey(userKey);

        if (!user) {
          throw new NotFoundError(`User "${userKey}" was not found.`);
        }
      }

      if (groupKey) {
        explicitGroup = await repository.getGroupByKey(groupKey);

        if (!explicitGroup) {
          throw new NotFoundError(`Group "${groupKey}" was not found.`);
        }
      }

      if (user && explicitGroup && user.groupKey !== explicitGroup.key) {
        throw new ValidationError(
          `User "${user.key}" belongs to "${user.groupKey ?? 'no-group'}", which conflicts with "${explicitGroup.key}".`,
        );
      }

      const resolvedGroupKey = explicitGroup?.key ?? user?.groupKey ?? null;

      const [userOverride, groupOverride] = await Promise.all([
        user ? repository.getOverride(feature.id, 'user', user.key) : null,
        resolvedGroupKey
          ? repository.getOverride(feature.id, 'group', resolvedGroupKey)
          : null,
      ]);

      const decision = evaluateFeatureFlag({
        featureKey: feature.key,
        defaultEnabled: Boolean(feature.defaultEnabled),
        userOverride,
        groupOverride,
      });

      return {
        ...decision,
        context: {
          userKey: user?.key ?? null,
          userName: user?.name ?? null,
          resolvedGroupKey,
          resolvedGroupName:
            explicitGroup?.name ?? user?.groupName ?? null,
        },
        inspected: {
          defaultEnabled: Boolean(feature.defaultEnabled),
          userOverride: userOverride
            ? {
                scopeKey: userOverride.scopeKey,
                enabled: Boolean(userOverride.enabled),
              }
            : null,
          groupOverride: groupOverride
            ? {
                scopeKey: groupOverride.scopeKey,
                enabled: Boolean(groupOverride.enabled),
              }
            : null,
        },
      };
    },
  };
}
