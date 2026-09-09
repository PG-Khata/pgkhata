import { describe, expect, it } from "vitest";
import { MAX_DOCUMENT_BYTES, safeDownloadName, validateDocumentUpload } from "../lib/document-upload";

const base64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");

describe("document upload validation", () => {
  it.each([
    ["proof.pdf", "application/pdf", base64([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])],
    ["photo.jpg", "image/jpeg", base64([0xff, 0xd8, 0xff, 0xe0])],
    ["फोटो.png", "image/png", base64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ])("accepts a real allowed file: %s", (fileName, contentType, fileBase64) => {
    expect(validateDocumentUpload({ fileName, contentType, fileBase64 }).contentType).toBe(contentType);
  });

  it.each([
    ["page.html", "text/html", base64([...Buffer.from("<html>")])],
    ["page.pdf", "application/pdf", base64([...Buffer.from("<html>")])],
    ["photo.jpg", "image/png", base64([0xff, 0xd8, 0xff])],
    ["photo.png", "image/png", "not base64!"],
    ["photo.png", "image/png", ""],
  ])("rejects spoofed, mismatched, invalid, or empty content", (fileName, contentType, fileBase64) => {
    expect(() => validateDocumentUpload({ fileName, contentType, fileBase64 })).toThrow();
  });

  it("rejects a file larger than five MiB before storage", () => {
    const fileBase64 = Buffer.alloc(MAX_DOCUMENT_BYTES + 1, 0).toString("base64");
    expect(() => validateDocumentUpload({ fileName: "large.pdf", contentType: "application/pdf", fileBase64 }))
      .toThrow(/no larger/i);
  });

  it("neutralizes response-header characters in download names", () => {
    expect(safeDownloadName('proof\r\nContent-Type: text/html\\".pdf')).not.toMatch(/[\r\n"\\/]/);
  });
});
