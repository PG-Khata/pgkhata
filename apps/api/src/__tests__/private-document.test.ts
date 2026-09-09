import { describe, expect, it, vi } from "vitest";
import { presentPrivateDocument } from "../lib/private-document";

describe("private document responses", () => {
  it("hides both legacy public URLs and private storage keys", async () => {
    const signer = vi.fn().mockResolvedValue("https://signed.example/download?expires=300");
    const response = await presentPrivateDocument(
      {
        id: "doc-1",
        fileUrl: "https://public.example/legacy.pdf",
        storageKey: "kyc/tenant-1/private.pdf",
        fileName: "identity.pdf",
        contentType: "application/pdf",
      },
      signer,
    );

    expect(response).toEqual({
      id: "doc-1",
      fileName: "identity.pdf",
      contentType: "application/pdf",
      downloadUrl: "https://signed.example/download?expires=300",
    });
    expect(response).not.toHaveProperty("fileUrl");
    expect(response).not.toHaveProperty("storageKey");
    expect(signer).toHaveBeenCalledWith("kyc/tenant-1/private.pdf", {
      fileName: "identity.pdf",
      contentType: "application/pdf",
    });
  });

  it("does not expose an unknown legacy external URL", async () => {
    const signer = vi.fn();
    const response = await presentPrivateDocument(
      {
        id: "legacy-doc",
        fileUrl: "https://unknown.example/sensitive.pdf",
        storageKey: null,
        fileName: "sensitive.pdf",
        contentType: null,
      },
      signer,
    );

    expect(response.downloadUrl).toBeNull();
    expect(response).not.toHaveProperty("fileUrl");
    expect(response).not.toHaveProperty("storageKey");
    expect(signer).not.toHaveBeenCalled();
  });
});
