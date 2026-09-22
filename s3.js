/**
 * SEVEN BITS COFFEE - S3-COMPATIBLE OBJECT STORAGE (opt-in)
 * Location: /s3.js
 *
 * Local disk (UPLOADS_DIR) is the default place uploaded images live - zero
 * setup, works for a single shop out of the box. This module is only used
 * when an owner/admin explicitly turns on "S3-compatible storage" in
 * Global Settings and enters a bucket/endpoint/credentials (their own AWS
 * account, another S3-compatible provider, or credentials their vendor
 * gave them - this module doesn't care which). See server.js's
 * PATCH /api/config, which calls configure() with the saved settings every
 * time they change, and main.js's boot, which calls it once with whatever
 * was already saved.
 */
"use strict";
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand } = require("@aws-sdk/client-s3");

let client = null;
let bucket = null;

/** Rebuilds (or tears down) the S3 client from the current config - called
 *  once at boot and again every time Global Settings saves storage
 *  settings, so a toggle/credential change takes effect immediately with
 *  no restart. */
function configure(config) {
  if (config.uploadsStorage !== "s3" || !config.s3Bucket) {
    client = null;
    bucket = null;
    return;
  }
  bucket = config.s3Bucket;
  const endpoint = config.s3Endpoint || undefined;
  client = new S3Client({
    region: config.s3Region || "us-east-1",
    endpoint,
    // A custom endpoint only ever means a non-AWS S3-compatible service
    // (LocalStack, MinIO, etc.) - those need path-style URLs; real AWS
    // (no custom endpoint) uses its normal virtual-hosted-style.
    forcePathStyle: !!endpoint,
    credentials:
      config.s3AccessKeyId && config.s3SecretAccessKey
        ? { accessKeyId: config.s3AccessKeyId, secretAccessKey: config.s3SecretAccessKey }
        : undefined
  });
}

function isEnabled() {
  return !!client;
}

async function putObject(key, buffer, contentType) {
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
}

/** Returns the object's raw Node readable stream plus its stored content
 *  type/length, for server.js to pipe straight into the HTTP response -
 *  keeps the existing `/uploads/<filename>` URL contract working exactly
 *  the same as the local-disk path (every place that already builds that
 *  URL string needs zero changes) instead of switching callers over to a
 *  presigned S3 URL. */
async function getObjectStream(key) {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return { stream: res.Body, contentType: res.ContentType, contentLength: res.ContentLength };
}

async function deleteObject(key) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Creates the configured bucket if it doesn't exist yet - convenient for
 *  LocalStack/MinIO-style dev setups that start with nothing. A failure
 *  here (e.g. no CreateBucket permission, normal for a real AWS bucket a
 *  vendor/owner already provisioned by hand) is deliberately swallowed -
 *  it only matters that the bucket exists, not that this process made it. */
async function ensureBucket() {
  if (!client) return;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (e) {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (e2) {
      // Already exists (race) or no permission to create it - either way,
      // nothing more to do here.
    }
  }
}

module.exports = { configure, isEnabled, putObject, getObjectStream, deleteObject, ensureBucket };
