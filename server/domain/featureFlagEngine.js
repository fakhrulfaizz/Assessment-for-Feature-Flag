import { ValidationError } from './errors.js';

export function evaluateFeatureFlag({
  featureKey,
  defaultEnabled,
  userOverride = null,
  groupOverride = null,
}) {
  if (typeof defaultEnabled !== 'boolean') {
    throw new ValidationError(
      `Feature "${featureKey}" is missing a valid global default state.`,
    );
  }

  if (userOverride) {
    return {
      featureKey,
      enabled: Boolean(userOverride.enabled),
      source: 'user_override',
      matchedScope: {
        type: 'user',
        key: userOverride.scopeKey,
      },
    };
  }

  if (groupOverride) {
    return {
      featureKey,
      enabled: Boolean(groupOverride.enabled),
      source: 'group_override',
      matchedScope: {
        type: 'group',
        key: groupOverride.scopeKey,
      },
    };
  }

  return {
    featureKey,
    enabled: defaultEnabled,
    source: 'default',
    matchedScope: {
      type: 'global',
      key: null,
    },
  };
}
