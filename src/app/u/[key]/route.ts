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

  return createDownloadResponse(key, request.headers.get("range"));
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  return createDownloadHeadResponse(key, request.headers.get("range"));
}
