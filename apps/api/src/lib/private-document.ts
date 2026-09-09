import { safeDownloadName } from "./document-upload";
import { getDownloadUrl } from "./r2-storage";

type StoredDocument = {
  fileUrl: string;
  storageKey: string | null;
  fileName: string;
  contentType: string | null;
  [key: string]: unknown;
};

type DownloadSigner = (
  key: string,
  options: { fileName: string; contentType?: string },
) => Promise<string>;

/** Return only a short-lived download capability; never expose storage coordinates. */
export async function presentPrivateDocument<T extends StoredDocument>(
  document: T,
  signDownload: DownloadSigner = getDownloadUrl,
) {
  const { fileUrl: _legacyUrl, storageKey, ...safe } = document;
  return {
    ...safe,
    downloadUrl: storageKey
      ? await signDownload(storageKey, {
          fileName: safeDownloadName(document.fileName),
          contentType: document.contentType ?? undefined,
        })
      : null,
  };
}
