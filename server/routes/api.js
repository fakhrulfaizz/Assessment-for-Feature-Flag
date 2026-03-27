import { Router } from 'express';

function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function createApiRouter(service) {
  const router = Router();

  router.get(
    '/health',
    asyncHandler(async (_request, response) => {
      response.json({
        data: {
          status: 'ok',
        },
      });
    }),
  );

  router.get(
    '/dashboard',
    asyncHandler(async (_request, response) => {
      response.json({
        data: await service.getDashboard(),
      });
    }),
  );

  router.get(
    '/features',
    asyncHandler(async (_request, response) => {
      response.json({
        data: await service.listFlags(),
      });
    }),
  );

  router.get(
    '/features/:featureKey',
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.getFlag(request.params.featureKey),
      });
    }),
  );

  router.post(
    '/features',
    asyncHandler(async (request, response) => {
      const feature = await service.createFlag(request.body ?? {});

      response.status(201).json({
        data: feature,
      });
    }),
  );

  router.patch(
    '/features/:featureKey',
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.updateFlag(request.params.featureKey, request.body ?? {}),
      });
    }),
  );

  router.post(
    '/features/:featureKey/evaluate',
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.evaluateFlag(
          request.params.featureKey,
          request.body ?? {},
        ),
      });
    }),
  );

  router.put(
    '/features/:featureKey/overrides',
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.upsertOverride(
          request.params.featureKey,
          request.body ?? {},
        ),
      });
    }),
  );

  router.delete(
    '/features/:featureKey/overrides/:scopeType/:scopeKey',
    asyncHandler(async (request, response) => {
      response.json({
        data: await service.deleteOverride(
          request.params.featureKey,
          request.params.scopeType,
          request.params.scopeKey,
        ),
      });
    }),
  );

  return router;
}
