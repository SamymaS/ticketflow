import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { logger } from './logger.js';
import { migrate } from './db.js';
import { health } from './health.js';
import { users } from './routes/users.js';
import { events } from './routes/events.js';
import { tickets } from './routes/tickets.js';
import { reservations } from './routes/reservations.js';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));

app.use(health);
app.use('/api/users', users);
app.use('/api/events', events);
app.use('/api/reservations', reservations);
app.use('/api/tickets', tickets);

app.use((err, _req, res, _next) => {
  logger.error({ err }, 'erreur non gérée');
  res.status(500).json({ error: 'Erreur interne' });
});

async function start() {
  await migrate();
  const server = app.listen(config.port, () => logger.info({ port: config.port }, 'API démarrée'));
  const shutdown = (sig) => {
    logger.info({ sig }, 'arrêt en cours');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
start().catch((err) => { logger.error({ err }, 'échec démarrage'); process.exit(1); });
