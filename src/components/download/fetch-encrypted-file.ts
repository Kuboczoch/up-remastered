import { MAX_ENCRYPTED_ENVELOPE_BYTES } from "@/components/upload/encryption";

export async function fetchEncryptedFile(
  id: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(id))
    throw new Error("Invalid protected link. Ask the sender for a new link.");
  const response = await fetch(`/${encodeURIComponent(id)}`, {
    signal,
    referrerPolicy: "no-referrer",
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) {
    if ([404, 410, 403].includes(response.status))
      throw new Error(
        "This file is unavailable: it may have expired, been deleted, or reached its download limit. Ask the sender to upload it again.",
      );
    throw new Error(
      `Download failed (${response.status}). Check your connection and try again; a retry may use another download.`,
    );
  }
  const tooLarge = () =>
    new Error("This protected file exceeds the 32 MiB browser memory limit.");
  if (
    Number(response.headers.get("content-length")) >
    MAX_ENCRYPTED_ENVELOPE_BYTES
  ) {
    await response.body?.cancel();
    throw tooLarge();
  }
  if (!response.body)
    throw new Error(
      "The server returned no file. Ask the sender to upload it again.",
    );
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_ENCRYPTED_ENVELOPE_BYTES) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result.buffer;
}
