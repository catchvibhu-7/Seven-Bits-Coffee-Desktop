/**
 * SEVEN BITS COFFEE - S3-COMPATIBLE OBJECT STORAGE
 * Location: /s3.js
 *
 * Replaces UPLOADS_DIR (local disk) as where uploaded images actually
 * live. Talks to whatever S3-compatible endpoint the env vars point at -
 * LocalStack in dev/test, real AWS S3 in production - the exact same code
 * path either way, since that's the whole point of LocalStack emulating
 * the real S3 API rather than a fake/mocked client.
 *
 * Env vars (all optional except S3_BUCKET in production):
 *   S3_ENDPOINT           - LocalStack's URL (e.g. http://localhost:4566).
 *                            Unset -> the AWS SDK's real endpoint resolution.
 *   S3_BUCKET             - defaults to "sbc-uploads".
 *   S3_REGION             - defaults to "us-east-1".
 *   S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
 *                         - LocalStack accepts any non-empty values here.
 *                           Unset in production -> the SDK's normal
 *                           credential chain (IAM role, ~/.aws/credentials,
 *                           etc.) is used instead.
 *   S3_FORCE_PATH_STYLE   - "1" to force path-style URLs (LocalStack needs
 *                            this); auto-enabled whenever S3_ENDPOINT is set,
 *                            since a custom endpoint is always a LocalStack/
 *                            MinIO-style dev setup, never real AWS.
 */
"use strict";
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand } = require("@aws-sdk/client-s3");

const BUCKET = process.env.S3_BUCKET || "sbc-uploads";
const ENDPOINT = process.env.S3_ENDPOINT || undefined;

const client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1" || !!ENDPOINT,
  credentials:
    process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined // falls back to the SDK's own credential chain for real AWS
});

async function putObject(key, buffer, contentType) {
  await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
}

/** Returns the object's raw Node readable stream plus its stored content
 *  type/length, for server.js to pipe straight into the HTTP response -
 *  keeps the existing `/uploads/<filename>` URL contract working exactly
 *  as before (every place that already builds that URL string needs zero
 *  changes) instead of switching callers over to a presigned S3 URL. */
async function getObjectStream(key) {
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return { stream: res.Body, contentType: res.ContentType, contentLength: res.ContentLength };
}

async function deleteObject(key) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Dev/test convenience only - LocalStack starts with no buckets at all,
 *  so this creates one on boot if it's missing. Real AWS S3 buckets are
 *  provisioned out-of-band (Terraform/console/CLI) with real access
 *  policies, so a failure here (e.g. no CreateBucket permission, which is
 *  normal and expected in production) is deliberately swallowed - it
 *  only matters that the bucket exists, not that this process was the
 *  one that created it. */
async function ensureBucket() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch (e) {
    try {
      await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    } catch (e2) {
      // Already exists (race with another process) or no permission to
      // create it in production - either way, nothing more to do here.
    }
  }
}

module.exports = { putObject, getObjectStream, deleteObject, ensureBucket, BUCKET };
