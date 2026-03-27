import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import sqlite3 from 'sqlite3';
import {
  seedFeatures,
  seedGroups,
  seedOverrides,
  seedUsers,
} from './seedData.js';

const sqlite = sqlite3.verbose();

export async function openDatabase(filename) {
  if (filename !== ':memory:') {
    await mkdir(path.dirname(filename), { recursive: true });
  }

  const raw = await new Promise((resolve, reject) => {
    const instance = new sqlite.Database(filename, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(instance);
    });
  });

  const db = {
    raw,
    exec(sql) {
      return new Promise((resolve, reject) => {
        raw.exec(sql, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        raw.get(sql, params, (error, row) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(row ?? null);
        });
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        raw.all(sql, params, (error, rows) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(rows ?? []);
        });
      });
    },
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        raw.run(sql, params, function onRun(error) {
          if (error) {
            reject(error);
            return;
          }

          resolve({
            lastID: this.lastID,
            changes: this.changes,
          });
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        raw.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };

  await db.exec('PRAGMA foreign_keys = ON;');

  return db;
}

export async function initializeDatabase(db, { seed = true } = {}) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS features (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      default_enabled INTEGER NOT NULL CHECK (default_enabled IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature_id INTEGER NOT NULL REFERENCES features(id) ON DELETE CASCADE,
      scope_type TEXT NOT NULL CHECK (scope_type IN ('user', 'group')),
      scope_key TEXT NOT NULL,
      enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (feature_id, scope_type, scope_key)
    );

    CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id);
    CREATE INDEX IF NOT EXISTS idx_overrides_feature_scope
      ON overrides(feature_id, scope_type, scope_key);
  `);

  if (!seed) {
    return;
  }

  const row = await db.get('SELECT COUNT(*) AS count FROM features');

  if (row?.count > 0) {
    return;
  }

  await seedDatabase(db);
}

async function seedDatabase(db) {
  await db.exec('BEGIN TRANSACTION;');

  try {
    for (const group of seedGroups) {
      await db.run(
        `
          INSERT INTO groups (key, name, description)
          VALUES (?, ?, ?)
        `,
        [group.key, group.name, group.description],
      );
    }

    const groupRows = await db.all('SELECT id, key FROM groups');
    const groupIdByKey = new Map(groupRows.map((group) => [group.key, group.id]));

    for (const user of seedUsers) {
      await db.run(
        `
          INSERT INTO users (key, name, email, group_id)
          VALUES (?, ?, ?, ?)
        `,
        [
          user.key,
          user.name,
          user.email,
          user.groupKey ? groupIdByKey.get(user.groupKey) ?? null : null,
        ],
      );
    }

    for (const feature of seedFeatures) {
      await db.run(
        `
          INSERT INTO features (key, description, default_enabled)
          VALUES (?, ?, ?)
        `,
        [feature.key, feature.description, feature.defaultEnabled ? 1 : 0],
      );
    }

    const featureRows = await db.all('SELECT id, key FROM features');
    const featureIdByKey = new Map(
      featureRows.map((feature) => [feature.key, feature.id]),
    );

    for (const override of seedOverrides) {
      await db.run(
        `
          INSERT INTO overrides (feature_id, scope_type, scope_key, enabled)
          VALUES (?, ?, ?, ?)
        `,
        [
          featureIdByKey.get(override.featureKey),
          override.scopeType,
          override.scopeKey,
          override.enabled ? 1 : 0,
        ],
      );
    }

    await db.exec('COMMIT;');
  } catch (error) {
    await db.exec('ROLLBACK;');
    throw error;
  }
}
