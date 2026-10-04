import { presentUnavailableDownload } from "@/server/downloads/unavailable-page";

import {
  createDownloadHeadResponse,
  createDownloadResponse,
} from "@/server/downloads/create-download-response";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  return presentUnavailableDownload(
    request,
    await createDownloadResponse(
      key,
      request.headers.get("range"),
      new Date(),
      new URL(request.url).searchParams.get("download") === "1",
    ),
  );
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  return createDownloadHeadResponse(
    key,
    request.headers.get("range"),
    new Date(),
    new URL(request.url).searchParams.get("download") === "1",
  );
}
