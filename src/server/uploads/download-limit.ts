import { UploadRequestError } from "@/server/uploads/errors";

export function resolveMaxDownloads(value: string | undefined): number | null {
  if (value === undefined || value === "unlimited") return null;
  if (!/^(?:[1-9]|10)$/.test(value)) {
    throw new UploadRequestError(
      "maxDownloads must be unlimited or an integer from 1 to 10.",
      400,
      "invalid_max_downloads",
    );
  }
  return Number(value);
}
