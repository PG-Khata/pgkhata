/**
 * Cloudflare R2 storage client for document uploads.
 *
 * R2 is S3-compatible, so we use the AWS SDK v3 client.
 * Free tier: 10 GB storage, 1M Class A ops, 10M Class B ops, zero egress.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "pgkhata-documents";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g., https://pub-xxx.r2.dev

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
    }
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

/**
 * Upload a file to R2.
 * @param folder - e.g., "kyc/{tenantId}" or "admin/{propertyId}"
 * @param fileName - original file name
 * @param buffer - file content
 * @param contentType - MIME type
 */
export async function uploadToR2(
  folder: string,
  fileName: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadResult> {
  const ext = fileName.split(".").pop() || "bin";
  const key = `${folder}/${randomUUID()}.${ext}`;

  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  const url = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${key}`
    : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;

  return { key, url, size: buffer.length };
}

/**
 * Delete a file from R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );
}

/**
 * Generate a presigned URL for downloading a file.
 * Useful for private documents that shouldn't be publicly accessible.
 */
export async function getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Check if R2 is configured.
 */
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}
