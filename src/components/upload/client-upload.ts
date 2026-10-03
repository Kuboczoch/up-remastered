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

function responseMessage(body: unknown, fallback: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }

  return fallback;
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
  options: { expirationHours?: number } = {},
): { abort: () => void; promise: Promise<UploadResult> } {
  const request = new XMLHttpRequest();
  const promise = new Promise<UploadResult>((resolve, reject) => {
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
        reject(
          new Error(
            responseMessage(
              request.response,
              `Upload failed with status ${request.status}.`,
            ),
          ),
        );
        return;
      }

      try {
        resolve(parseUploadResponse(request.response));
      } catch (error) {
        reject(error);
      }
    });

    const form = new FormData();
    form.set("file", file);
    if (options.expirationHours !== undefined) {
      form.set("expiresInHours", String(options.expirationHours));
    }
    request.send(form);
  });

  return { abort: () => request.abort(), promise };
}
