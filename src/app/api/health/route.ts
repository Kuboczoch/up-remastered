import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";

import { getUploadDirectory } from "@/server/config/uploads";
import { createSqliteConnection } from "@/server/db/client";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let connection: ReturnType<typeof createSqliteConnection> | undefined;

  try {
    connection = createSqliteConnection();
    connection.prepare("SELECT 1").get();

    const uploadDirectory = getUploadDirectory();
    await mkdir(uploadDirectory, { recursive: true });
    await access(uploadDirectory, constants.W_OK);

    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } finally {
    connection?.close();
  }
}
