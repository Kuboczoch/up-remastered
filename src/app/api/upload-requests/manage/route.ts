import { NextResponse } from "next/server";

import {
  inspectRequestedUpload,
  revokeRequestedUpload,
} from "@/server/upload-requests/requested-upload";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const token = bearerToken(request);
  const uploadRequest = token ? inspectRequestedUpload(token) : undefined;

  return uploadRequest
    ? NextResponse.json(
        { request: uploadRequest },
        { headers: NO_STORE_HEADERS },
      )
    : unavailableResponse();
}

export async function DELETE(request: Request) {
  const token = bearerToken(request);
  const uploadRequest = token ? revokeRequestedUpload(token) : undefined;

  return uploadRequest
    ? NextResponse.json(
        { request: uploadRequest },
        { headers: NO_STORE_HEADERS },
      )
    : unavailableResponse();
}

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([a-f0-9]{64})$/);
  return match?.[1];
}

function unavailableResponse() {
  return NextResponse.json(
    {
      error: {
        code: "upload_request_unavailable",
        message: "This upload request is unavailable.",
      },
    },
    { headers: NO_STORE_HEADERS, status: 404 },
  );
}
