/**
 * Upload WhatsApp bill header image to Cloudflare R2.
 * Run this once to get a public URL for the image.
 */

import { config } from "dotenv";
import { S3Client, PutObjectCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { join } from "path";

// Load .env from project root
config({ path: join(__dirname, "..", ".env") });

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "pgkhata-documents";

async function uploadToR2() {
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

  // Create bucket if it doesn't exist
  try {
    await client.send(new CreateBucketCommand({ Bucket: R2_BUCKET_NAME }));
    console.log(`✅ Created bucket: ${R2_BUCKET_NAME}`);
  } catch (error: any) {
    if (error.name === "BucketAlreadyOwnedByYou" || error.name === "BucketAlreadyExists") {
      console.log(`✅ Bucket already exists: ${R2_BUCKET_NAME}`);
    } else {
      console.error("Error creating bucket:", error);
      process.exit(1);
    }
  }

  // Upload image
  const imagePath = join(__dirname, "..", "whatsapp-bill-header.png");
  const imageBuffer = readFileSync(imagePath);

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: "whatsapp/bill-header.png",
    Body: imageBuffer,
    ContentType: "image/png",
  });

  await client.send(command);

  // Get public URL
  // First, try to get the public URL from R2 settings
  // For now, we'll use the R2.dev subdomain format
  const publicUrl = `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/whatsapp/bill-header.png`;
  
  console.log("✅ Uploaded successfully!");
  console.log(`📎 Public URL: ${publicUrl}`);
  console.log("\nAdd this to your .env file:");
  console.log(`WHATSAPP_HEADER_IMAGE_URL=${publicUrl}`);
  console.log("\nNote: You may need to enable public access on the bucket in R2 settings.");
}

uploadToR2().catch(console.error);
