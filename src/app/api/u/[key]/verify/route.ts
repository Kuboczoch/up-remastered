import { NextResponse } from "next/server";

import { verifyUploadAccess } from "@/server/uploads/manage-upload";
import { readAccessToken } from "@/server/uploads/read-access-token";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message, success: false }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const token = await readAccessToken(request);

  if (!token) {
    return errorResponse("A valid accessToken is required.", 400);
  }

  const { key } = await params;
  const result = verifyUploadAccess(key, token);

  if (result === "not-found") {
    return errorResponse("File not found.", 404);
  }

  if (result === "forbidden") {
    return errorResponse("Invalid access token.", 403);
  }

  return NextResponse.json({ message: null, success: true });
}
