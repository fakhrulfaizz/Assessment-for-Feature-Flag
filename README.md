# Feature Flag Engine

SQLite-backed feature flag system with a React frontend, seeded dummy data, and tests around the core precedence rules.

## Stack

- React + Vite for the frontend
- Express for the API
- SQLite for persistence
- Vitest for unit tests

## Run It

Install dependencies:

```bash
npm install
```

Run the API and React app together:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001`

Run tests with coverage:

```bash
npm test
```

Build the frontend and serve it from Express:

```bash
npm run build
npm start
```

## What Is Seeded

- 4 feature flags
- 3 groups
- 5 users
- 5 user/group overrides

The seeded scenarios intentionally cover the most important evaluation paths:

- `checkout-redesign`: group override enabled for `beta-testers`, but user override disabled for `mia-chen`
- `priority-support-chat`: enabled for the `enterprise` group
- `bulk-order-csv`: globally enabled, but disabled for `sara-lim`
- `smart-search-v2`: enabled for `internal-ops`

## Assumptions

- Feature keys are normalized to lowercase and accept letters, numbers, and hyphens only.
- If a user is provided during evaluation and no explicit group is supplied, the engine uses the user's stored group automatically.
- If both a user and a group are supplied, they must agree with the user's actual group membership.

## Tradeoffs

- I kept the API surface small and focused on the challenge requirements instead of building a full auth or tenancy model.
- The repository does straightforward SQL instead of adding an ORM so the evaluation path stays transparent and easy to reason about.
- The frontend is intentionally more functional than fancy, but still gives enough visibility to test precedence and mutations quickly.

## Another Hour / Day

- Add region overrides as a first-class scope with explicit precedence rules.
- Add optimistic UI updates and richer audit history for flag changes.
- Add integration tests for the HTTP routes and a lightweight e2e flow for the React UI.
- Introduce pagination and server-side filtering once the flag catalog grows.

## Known Limitations

- There is no authentication or role-based authorization around mutations.
- The seeded SQLite database is recreated only on first boot; there is no reset script yet.
- The frontend favors operator workflows over end-user polish, which matches the brief but leaves room for finer UX touches.
