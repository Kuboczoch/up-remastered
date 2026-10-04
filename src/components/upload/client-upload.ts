import { encryptFile } from "./encryption";
import { apiErrorKey } from "@/i18n/messages";

export type UploadOptions = {
  expirationHours?: number;
  maxDownloads?: number;
  protection?: boolean;
};

export type UploadResult = {
  accessToken: string;
  expiresAt: string;
  id: string;
  originalName: string;
  shareUrl: string;
  size: number;
};

export type UploadProgress = (percentage: number) => void;

export { formatBytes } from "@/lib/format";

function responseMessage(body: unknown): string {
  return apiErrorKey(body);
}

export function parseUploadResponse(body: unknown): UploadResult {
  if (
    typeof body !== "object" ||
    body === null ||
    !("accessToken" in body) ||
    typeof body.accessToken !== "string" ||
    !("upload" in body) ||
    typeof body.upload !== "object" ||
    body.upload === null
  ) {
    throw new Error("Upload completed, but the server response was invalid.");
  }

  const upload = body.upload;
  if (
    !("id" in upload) ||
    typeof upload.id !== "string" ||
    !("expiresAt" in upload) ||
    typeof upload.expiresAt !== "string" ||
    !("originalName" in upload) ||
    typeof upload.originalName !== "string" ||
    !("shareUrl" in upload) ||
    typeof upload.shareUrl !== "string" ||
    !("size" in upload) ||
    typeof upload.size !== "number"
  ) {
    throw new Error("Upload completed, but the server response was invalid.");
  }

  return {
    accessToken: body.accessToken,
    expiresAt: upload.expiresAt,
    id: upload.id,
    originalName: upload.originalName,
    shareUrl: upload.shareUrl,
    size: upload.size,
  };
}

export function uploadFile(
  file: File,
  onProgress: UploadProgress,
  options: UploadOptions = {},
): { abort: () => void; promise: Promise<UploadResult> } {
  const request = new XMLHttpRequest();
  const controller = new AbortController();
  let rejectOperation: (error: unknown) => void = () => {};
  let encryptionKey: string | undefined;
  const promise = new Promise<UploadResult>((resolve, reject) => {
    rejectOperation = reject;
    request.open("POST", "/api/upload");
    request.responseType = "json";
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        );
      }
    });
    request.addEventListener("error", () => {
      reject(new Error("Network error. Check your connection and try again."));
    });
    request.addEventListener("abort", () => {
      reject(new DOMException("Upload cancelled.", "AbortError"));
    });
    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(responseMessage(request.response)));
        return;
      }

      try {
        const result = parseUploadResponse(request.response);
        if (encryptionKey) {
          const url = new URL(
            result.shareUrl,
            globalThis.location?.origin ?? "http://localhost",
          );
          url.hash = `key=${encryptionKey}`;
          result.shareUrl = url.toString();
          result.originalName = file.name;
          result.size = file.size;
        }
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    const send = (upload: File) => {
      if (controller.signal.aborted) return;
      const form = new FormData();
      if (options.expirationHours !== undefined)
        form.set("expiresInHours", String(options.expirationHours));
      if (options.maxDownloads !== undefined)
        form.set("maxDownloads", String(options.maxDownloads));
      if (options.protection) form.set("encrypted", "true");
      form.set("file", upload);
      if (options.protection) onProgress(0);
      request.send(form);
    };
    if (options.protection) {
      void encryptFile(file, controller.signal)
        .then((encrypted) => {
          encryptionKey = encrypted.key;
          send(encrypted.file);
        })
        .catch(reject);
    } else {
      send(file);
    }
  });

  return {
    abort: () => {
      controller.abort();
      rejectOperation(new DOMException("Upload cancelled.", "AbortError"));
      request.abort();
    },
    promise,
  };
}
