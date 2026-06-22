import { Worker } from 'bullmq';
import { redis } from './redis.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { QUEUE_NAME, EVENTS } from './events.js';
import { startHealthServer } from './health.js';
import { ensureBucket } from './storage.js';
import { handleReservationPaid } from './handlers/reservationPaid.js';

const handlers = { [EVENTS.RESERVATION_PAID]: handleReservationPaid };

async function main() {
  await ensureBucket();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const handler = handlers[job.name];
      if (!handler) return logger.warn({ name: job.name }, 'évènement inconnu — ignoré');
      await handler(job.data); // succès => ack ; erreur => retries puis dead-letter
    },
    { connection: redis, concurrency: config.concurrency }
  );

  worker.on('completed', (job) => logger.debug({ id: job.id }, 'job acquitté'));
  worker.on('failed', (job, err) => logger.error({ id: job?.id, err }, 'job en échec'));

  const healthServer = startHealthServer(config.port, logger);

  async function shutdown(sig) {
    logger.info({ sig }, 'arrêt du worker');
    await worker.close();
    healthServer.close();
    process.exit(0);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  logger.info({ concurrency: config.concurrency }, 'worker démarré');
}

main().catch((err) => { logger.error({ err }, 'échec worker'); process.exit(1); });
