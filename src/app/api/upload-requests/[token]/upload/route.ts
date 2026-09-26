import { NextResponse } from "next/server";

import { isUploadRequestError } from "@/server/uploads/errors";
import { fulfillRequestedUpload } from "@/server/upload-requests/requested-upload";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const upload = await fulfillRequestedUpload(token, request);

    return NextResponse.json(
      {
        accessToken: upload.accessToken,
        key: upload.id,
        toDelete: upload.expiresAt,
        upload,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isUploadRequestError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    throw error;
  }
}
