import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { openDatabase, initializeDatabase } from './db/database.js';
import { createApiRouter } from './routes/api.js';
import { createFeatureFlagRepository } from './services/featureFlagRepository.js';
import { createFeatureFlagService } from './services/featureFlagService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const databasePath = path.join(rootDir, 'data', 'feature-flags.sqlite');
const distPath = path.join(rootDir, 'dist');
const port = Number(process.env.PORT ?? 3001);

const db = await openDatabase(databasePath);
await initializeDatabase(db, { seed: true });

const repository = createFeatureFlagRepository(db);
const service = createFeatureFlagService(repository);

const app = express();

app.use(express.json());
app.use('/api', createApiRouter(service));
app.use('/api', (_request, response) => {
  response.status(404).json({
    error: {
      message: 'API route not found.',
      details: null,
    },
  });
});

if (existsSync(distPath)) {
  app.use(express.static(distPath));

  app.use((request, response, next) => {
    if (request.path.startsWith('/api')) {
      next();
      return;
    }

    response.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((error, _request, response, _next) => {
  const statusCode = error.statusCode ?? 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  response.status(statusCode).json({
    error: {
      message: error.message ?? 'Unexpected server error.',
      details: error.details ?? null,
    },
  });
});

const server = app.listen(port, () => {
  console.log(`Feature flag API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
