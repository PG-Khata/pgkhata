/**
 * Upload the WhatsApp bill header image to R2 storage.
 * Run this once to get a public URL for the image.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { join } from "path";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "pgkhata-documents";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

async function uploadHeader() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error("Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
    process.exit(1);
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  const imagePath = join(__dirname, "..", "whatsapp-bill-header.png");
  const imageBuffer = readFileSync(imagePath);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: "whatsapp/bill-header.png",
    Body: imageBuffer,
    ContentType: "image/png",
    ACL: "public-read",
  });

  await client.send(command);

  const publicUrl = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/whatsapp/bill-header.png`
    : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/whatsapp/bill-header.png`;

  console.log("✅ Uploaded successfully!");
  console.log(`📎 Public URL: ${publicUrl}`);
  console.log("\nAdd this to your .env file:");
  console.log(`WHATSAPP_HEADER_IMAGE_URL=${publicUrl}`);
}

uploadHeader().catch(console.error);
