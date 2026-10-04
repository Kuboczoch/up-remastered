import { presentUnavailableDownload } from "@/server/downloads/unavailable-page";

import {
  createDownloadHeadResponse,
  createDownloadResponse,
} from "@/server/downloads/create-download-response";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return presentUnavailableDownload(
    request,
    await createDownloadResponse(
      id,
      request.headers.get("range"),
      new Date(),
      new URL(request.url).searchParams.get("download") === "1",
    ),
  );
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return createDownloadHeadResponse(
    id,
    request.headers.get("range"),
    new Date(),
    new URL(request.url).searchParams.get("download") === "1",
  );
}
