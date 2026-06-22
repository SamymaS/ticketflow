import pino from 'pino';
import { config } from './config.js';

// Logs structurés JSON vers stdout/stderr (12-factor, exploitables par K8s).
export const logger = pino({ level: config.logLevel });
