import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
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

  // Politique de lecture publique (idempotent) — requis pour que les URLs de PDF soient accessibles
  const policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${config.s3.bucket}/*`],
    }],
  });
  await s3.send(new PutBucketPolicyCommand({ Bucket: config.s3.bucket, Policy: policy }));
}

export async function putObject(keyName, body, contentType) {
  await s3.send(new PutObjectCommand({ Bucket: config.s3.bucket, Key: keyName, Body: body, ContentType: contentType }));
  return `${config.s3.publicBaseUrl}/${config.s3.bucket}/${keyName}`;
}
