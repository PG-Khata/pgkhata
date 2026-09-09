import { HttpError } from "./http";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const EXTENSION_TO_MIME = new Map([
  ["pdf", "application/pdf"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
]);

const MIME_TO_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

function detectedMime(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

function isStrictBase64(value: string) {
  if (value.length === 0 || value.length % 4 !== 0) return false;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  for (let index = 0; index < value.length - padding; index += 1) {
    const code = value.charCodeAt(index);
    const allowed = (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
      || (code >= 48 && code <= 57) || code === 43 || code === 47;
    if (!allowed) return false;
  }
  for (let index = value.length - padding; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 61) return false;
  }
  return true;
}

export function validateDocumentUpload(input: {
  fileName: string;
  fileBase64: string;
  contentType: string;
}) {
  const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  const expectedMime = EXTENSION_TO_MIME.get(extension);
  if (!expectedMime) {
    throw new HttpError(400, "Only PDF, JPEG, and PNG documents are allowed");
  }

  if (input.contentType.toLowerCase() !== expectedMime) {
    throw new HttpError(400, "File extension and declared content type do not match");
  }

  if (!input.fileBase64 || input.fileBase64.length > 4 * Math.ceil(MAX_DOCUMENT_BYTES / 3)) {
    throw new HttpError(413, `Document must be no larger than ${MAX_DOCUMENT_BYTES} bytes`);
  }
  if (!isStrictBase64(input.fileBase64)) {
    throw new HttpError(400, "Document is not valid base64 data");
  }

  const buffer = Buffer.from(input.fileBase64, "base64");
  if (buffer.length === 0) throw new HttpError(400, "Document cannot be empty");
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    throw new HttpError(413, `Document must be no larger than ${MAX_DOCUMENT_BYTES} bytes`);
  }

  const actualMime = detectedMime(buffer);
  if (actualMime !== expectedMime) {
    throw new HttpError(400, "Document content does not match its declared file type");
  }

  return { buffer, contentType: actualMime, extension: MIME_TO_EXTENSION[actualMime] };
}

export function safeDownloadName(fileName: string) {
  return fileName.replace(/[\r\n"\\/]/g, "_").slice(0, 200) || "document";
}
