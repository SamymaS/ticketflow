import 'dotenv/config';

const num = (v, d) => (v === undefined ? d : Number(v));

export const config = {
  port: num(process.env.API_PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  holdTtlSeconds: num(process.env.HOLD_TTL_SECONDS, 600),
  db: {
    host: process.env.PGHOST ?? 'localhost',
    port: num(process.env.PGPORT, 5432),
    database: process.env.PGDATABASE ?? 'ticketflow',
    user: process.env.PGUSER ?? 'ticketflow',
    password: process.env.PGPASSWORD ?? 'ticketflow_dev_pw',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: num(process.env.REDIS_PORT, 6379),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change_me_in_prod',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  payment: {
    url: process.env.PAYMENT_URL ?? 'http://localhost:4200',
    timeoutMs: num(process.env.PAYMENT_TIMEOUT_MS, 2000),
  },
};
