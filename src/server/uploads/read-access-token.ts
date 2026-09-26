export async function readAccessToken(
  request: Request,
): Promise<string | undefined> {
  try {
    const body: unknown = await request.json();

    if (
      typeof body === "object" &&
      body !== null &&
      "accessToken" in body &&
      typeof body.accessToken === "string" &&
      body.accessToken.length > 0
    ) {
      return body.accessToken;
    }
  } catch {
    // Return one stable malformed-body result below.
  }

  return undefined;
}
