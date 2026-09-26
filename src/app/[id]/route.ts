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

  return createDownloadResponse(id, request.headers.get("range"));
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return createDownloadHeadResponse(id, request.headers.get("range"));
}
