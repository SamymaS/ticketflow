import { Router } from 'express';
import { checkDb } from './db.js';
import { redis } from './redis.js';

export const health = Router();

// Liveness : le process répond.
health.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

// Readiness : dépendances joignables (DB + Redis).
health.get('/readyz', async (_req, res) => {
  try {
    await checkDb();
    await redis.ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', error: String(err) });
  }
});
