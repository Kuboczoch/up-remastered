import { NextResponse } from "next/server";

import { getPublicOrigin } from "@/server/config/public-url";
import { createShareXConfiguration } from "@/server/integrations/upload-utilities";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(createShareXConfiguration(getPublicOrigin()), {
    headers: {
      "Content-Disposition": 'attachment; filename="up.sxcu"',
    },
  });
}
