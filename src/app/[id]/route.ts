import {
  createDownloadHeadResponse,
  createDownloadResponse,
} from "@/server/downloads/create-download-response";
import { presentUnavailableFile } from "@/server/downloads/unavailable-page";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const response = await createDownloadResponse(
    id,
    request.headers.get("range"),
    new Date(),
    new URL(request.url).searchParams.get("download") === "1",
  );
  return presentUnavailableFile(request, response);
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
