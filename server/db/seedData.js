export const seedGroups = [
  {
    key: 'beta-testers',
    name: 'Beta Testers',
    description: 'Early access customers who help validate new product changes.',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'High-touch accounts with premium support and rollout privileges.',
  },
  {
    key: 'internal-ops',
    name: 'Internal Ops',
    description: 'Internal teammates validating features before public release.',
  },
];

export const seedUsers = [
  {
    key: 'mia-chen',
    name: 'Mia Chen',
    email: 'mia.chen@example.com',
    groupKey: 'beta-testers',
  },
  {
    key: 'omar-rahman',
    name: 'Omar Rahman',
    email: 'omar.rahman@example.com',
    groupKey: 'enterprise',
  },
  {
    key: 'leo-tan',
    name: 'Leo Tan',
    email: 'leo.tan@example.com',
    groupKey: 'enterprise',
  },
  {
    key: 'ivy-ng',
    name: 'Ivy Ng',
    email: 'ivy.ng@example.com',
    groupKey: 'internal-ops',
  },
  {
    key: 'sara-lim',
    name: 'Sara Lim',
    email: 'sara.lim@example.com',
    groupKey: null,
  },
];

export const seedFeatures = [
  {
    key: 'checkout-redesign',
    description: 'Expose the redesigned checkout flow to selected audiences.',
    defaultEnabled: false,
  },
  {
    key: 'priority-support-chat',
    description: 'Show the concierge support entry point for eligible accounts.',
    defaultEnabled: false,
  },
  {
    key: 'bulk-order-csv',
    description: 'Allow CSV uploads in the ordering workflow.',
    defaultEnabled: true,
  },
  {
    key: 'smart-search-v2',
    description: 'Switch search results to the new ranking model.',
    defaultEnabled: false,
  },
];

export const seedOverrides = [
  {
    featureKey: 'checkout-redesign',
    scopeType: 'group',
    scopeKey: 'beta-testers',
    enabled: true,
  },
  {
    featureKey: 'checkout-redesign',
    scopeType: 'user',
    scopeKey: 'mia-chen',
    enabled: false,
  },
  {
    featureKey: 'priority-support-chat',
    scopeType: 'group',
    scopeKey: 'enterprise',
    enabled: true,
  },
  {
    featureKey: 'bulk-order-csv',
    scopeType: 'user',
    scopeKey: 'sara-lim',
    enabled: false,
  },
  {
    featureKey: 'smart-search-v2',
    scopeType: 'group',
    scopeKey: 'internal-ops',
    enabled: true,
  },
];
