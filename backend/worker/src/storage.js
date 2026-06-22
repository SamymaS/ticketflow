import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { config } from './config.js';
import { logger } from './logger.js';

export const s3 = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  forcePathStyle: true, // requis pour MinIO
  credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey },
});

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.s3.bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: config.s3.bucket }));
    logger.info({ bucket: config.s3.bucket }, 'bucket créé');
  }
}

export async function putObject(keyName, body, contentType) {
  await s3.send(new PutObjectCommand({ Bucket: config.s3.bucket, Key: keyName, Body: body, ContentType: contentType }));
  return `${config.s3.publicBaseUrl}/${config.s3.bucket}/${keyName}`;
}
