import { NextResponse } from "next/server";

import { getPublicUploadDetails } from "@/server/uploads/manage-upload";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const details = getPublicUploadDetails(key);

  if (!details) {
    return NextResponse.json(
      { message: "File not found.", success: false },
      { status: 404 },
    );
  }

  return NextResponse.json(details);
}
