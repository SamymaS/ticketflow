import { Queue } from 'bullmq';
import { redis } from './redis.js';
import { QUEUE_NAME } from './events.js';

export const eventsQueue = new Queue(QUEUE_NAME, { connection: redis });

export const publish = (name, payload) =>
  eventsQueue.add(name, payload, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: false, // conservé = dead-letter consultable
  });
