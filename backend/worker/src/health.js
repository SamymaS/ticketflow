import http from 'node:http';
import { pool } from './db.js';
import { redis } from './redis.js';

// Petit serveur HTTP pour les probes K8s du worker (pas d'API métier).
export function startHealthServer(port, logger) {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200).end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (req.url === '/readyz') {
      try {
        await pool.query('SELECT 1');
        await redis.ping();
        res.writeHead(200).end(JSON.stringify({ status: 'ready' }));
      } catch (err) {
        res.writeHead(503).end(JSON.stringify({ status: 'not-ready', error: String(err) }));
      }
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(port, () => logger.info({ port }, 'health server worker démarré'));
  return server;
}
