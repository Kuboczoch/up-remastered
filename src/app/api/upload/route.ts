import { NextResponse } from "next/server";

import { createUpload } from "@/server/uploads/create-upload";
import { isUploadRequestError } from "@/server/uploads/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const upload = await createUpload(request);

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
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status },
      );
    }

    throw error;
  }
}
