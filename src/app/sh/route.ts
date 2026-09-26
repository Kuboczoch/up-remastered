import { getPublicOrigin } from "@/server/config/public-url";
import { createShellUploadScript } from "@/server/integrations/upload-utilities";

export const runtime = "nodejs";

export function GET() {
  return new Response(createShellUploadScript(getPublicOrigin()), {
    headers: {
      "Content-Disposition": 'attachment; filename="up-upload.sh"',
      "Content-Type": "text/x-shellscript; charset=utf-8",
    },
  });
}
