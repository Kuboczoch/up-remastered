import { NextResponse } from "next/server";

import { getUploadLimits } from "@/server/config/uploads";
import { createPublicUploadConfiguration } from "@/server/integrations/upload-utilities";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(createPublicUploadConfiguration(getUploadLimits()));
}
