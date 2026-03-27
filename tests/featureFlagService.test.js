import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, initializeDatabase } from '../server/db/database.js';
import { createFeatureFlagRepository } from '../server/services/featureFlagRepository.js';
import { createFeatureFlagService } from '../server/services/featureFlagService.js';

let db;
let repository;
let service;

beforeEach(async () => {
  db = await openDatabase(':memory:');
  await initializeDatabase(db, { seed: false });

  repository = createFeatureFlagRepository(db);
  service = createFeatureFlagService(repository);

  await db.run(
    `
      INSERT INTO groups (key, name, description)
      VALUES
        ('beta-testers', 'Beta Testers', 'Early access cohort'),
        ('enterprise', 'Enterprise', 'Premium customers')
    `,
  );

  const groups = await db.all('SELECT id, key FROM groups');
  const groupIdByKey = new Map(groups.map((group) => [group.key, group.id]));

  await db.run(
    `
      INSERT INTO users (key, name, email, group_id)
      VALUES
        ('mia-chen', 'Mia Chen', 'mia.chen@example.com', ?),
        ('leo-tan', 'Leo Tan', 'leo.tan@example.com', ?),
        ('sara-lim', 'Sara Lim', 'sara.lim@example.com', NULL)
    `,
    [groupIdByKey.get('beta-testers'), groupIdByKey.get('enterprise')],
  );
});

afterEach(async () => {
  await db.close();
});

describe('feature flag service', () => {
  it('returns the global default when no overrides exist', async () => {
    await service.createFlag({
      key: 'checkout-redesign',
      description: 'Test feature',
      defaultEnabled: false,
    });

    const result = await service.evaluateFlag('checkout-redesign');

    expect(result.enabled).toBe(false);
    expect(result.source).toBe('default');
  });

  it('uses a group override when no user override exists', async () => {
    await service.createFlag({
      key: 'priority-support-chat',
      description: 'Enterprise chat access',
      defaultEnabled: false,
    });
    await service.upsertOverride('priority-support-chat', {
      scopeType: 'group',
      scopeKey: 'enterprise',
      enabled: true,
    });

    const result = await service.evaluateFlag('priority-support-chat', {
      userKey: 'leo-tan',
    });

    expect(result.enabled).toBe(true);
    expect(result.source).toBe('group_override');
    expect(result.context.resolvedGroupKey).toBe('enterprise');
  });

  it('lets a user override win over a group override', async () => {
    await service.createFlag({
      key: 'smart-search-v2',
      description: 'Search rollout',
      defaultEnabled: false,
    });
    await service.upsertOverride('smart-search-v2', {
      scopeType: 'group',
      scopeKey: 'beta-testers',
      enabled: true,
    });
    await service.upsertOverride('smart-search-v2', {
      scopeType: 'user',
      scopeKey: 'mia-chen',
      enabled: false,
    });

    const result = await service.evaluateFlag('smart-search-v2', {
      userKey: 'mia-chen',
    });

    expect(result.enabled).toBe(false);
    expect(result.source).toBe('user_override');
  });

  it('rejects duplicate feature keys', async () => {
    await service.createFlag({
      key: 'bulk-order-csv',
      description: 'CSV upload',
      defaultEnabled: true,
    });

    await expect(
      service.createFlag({
        key: 'bulk-order-csv',
        description: 'Duplicate',
        defaultEnabled: false,
      }),
    ).rejects.toThrow('already exists');
  });

  it('rejects overrides that target a missing user or group', async () => {
    await service.createFlag({
      key: 'quick-report-export',
      description: 'Export feature',
      defaultEnabled: false,
    });

    await expect(
      service.upsertOverride('quick-report-export', {
        scopeType: 'user',
        scopeKey: 'missing-user',
        enabled: true,
      }),
    ).rejects.toThrow('User "missing-user" was not found.');
  });

  it('rejects conflicting explicit group context', async () => {
    await service.createFlag({
      key: 'staged-pricing-banner',
      description: 'Pricing experiment',
      defaultEnabled: false,
    });

    await expect(
      service.evaluateFlag('staged-pricing-banner', {
        userKey: 'mia-chen',
        groupKey: 'enterprise',
      }),
    ).rejects.toThrow('conflicts');
  });

  it('falls back to the default after removing an override', async () => {
    await service.createFlag({
      key: 'guided-onboarding',
      description: 'Onboarding helper',
      defaultEnabled: true,
    });
    await service.upsertOverride('guided-onboarding', {
      scopeType: 'user',
      scopeKey: 'sara-lim',
      enabled: false,
    });

    await service.deleteOverride('guided-onboarding', 'user', 'sara-lim');

    const result = await service.evaluateFlag('guided-onboarding', {
      userKey: 'sara-lim',
    });

    expect(result.enabled).toBe(true);
    expect(result.source).toBe('default');
  });
});
