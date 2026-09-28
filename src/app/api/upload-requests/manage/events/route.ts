import { NextResponse } from "next/server";

import { createUploadRequestStatusStream } from "@/server/upload-requests/status-events";
import { inspectRequestedUpload } from "@/server/upload-requests/requested-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STREAM_HEADERS = {
  "Cache-Control": "no-store, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream; charset=utf-8",
  "X-Accel-Buffering": "no",
};

export async function GET(request: Request) {
  const token = bearerToken(request);
  const uploadRequest = token ? inspectRequestedUpload(token) : undefined;

  if (!token || !uploadRequest) return unavailableResponse();

  const lastEventId = validLastEventId(request.headers.get("last-event-id"));
  const stream = createUploadRequestStatusStream(
    token,
    uploadRequest,
    lastEventId,
    { signal: request.signal },
  );

  return new Response(stream, { headers: STREAM_HEADERS });
}

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([a-f0-9]{64})$/);
  return match?.[1];
}

function validLastEventId(value: string | null): string | undefined {
  return value && value.length <= 128 && !/[\r\n]/.test(value)
    ? value
    : undefined;
}

function unavailableResponse() {
  return NextResponse.json(
    {
      error: {
        code: "upload_request_unavailable",
        message: "This upload request is unavailable.",
      },
    },
    { headers: { "Cache-Control": "no-store" }, status: 404 },
  );
}
