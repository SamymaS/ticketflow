import IORedis from 'ioredis';
import { config } from './config.js';

// maxRetriesPerRequest=null requis par BullMQ.
export const redis = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});
