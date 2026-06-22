import 'dotenv/config';
const num = (v, d) => (v === undefined ? d : Number(v));

export const config = {
  port: num(process.env.WORKER_PORT, 4100),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  concurrency: num(process.env.WORKER_CONCURRENCY, 5),
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
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'tickets',
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    publicBaseUrl: process.env.S3_PUBLIC_URL ?? 'http://localhost:9000',
  },
};
