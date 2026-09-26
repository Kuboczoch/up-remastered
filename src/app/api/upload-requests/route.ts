import { NextResponse } from "next/server";

import { isUploadRequestError } from "@/server/uploads/errors";
import { createRequestedUpload } from "@/server/upload-requests/requested-upload";

export const runtime = "nodejs";

const MAX_CREATE_BODY_BYTES = 1024;

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_CREATE_BODY_BYTES) {
      return errorResponse(
        413,
        "request_too_large",
        "Request body is too large.",
      );
    }

    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > MAX_CREATE_BODY_BYTES) {
      return errorResponse(
        413,
        "request_too_large",
        "Request body is too large.",
      );
    }

    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      return errorResponse(
        400,
        "invalid_json",
        "Request body must be valid JSON.",
      );
    }

    return NextResponse.json(createRequestedUpload(input), { status: 201 });
  } catch (error) {
    if (isUploadRequestError(error)) {
      return errorResponse(error.status, error.code, error.message);
    }
    throw error;
  }
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
