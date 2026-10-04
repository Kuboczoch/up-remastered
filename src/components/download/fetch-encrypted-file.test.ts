/** @jest-environment node */
import { afterEach, expect, it, jest } from "@jest/globals";
import { fetchEncryptedFile } from "./fetch-encrypted-file";
import { MAX_ENCRYPTED_ENVELOPE_BYTES } from "@/components/upload/encryption";

it.each([null, "1"])(
  "bounds streamed bytes with content-length %s and cancels overflow",
  async (length) => {
    const cancel = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const releaseLock = jest.fn();
    const read = jest
      .fn<() => Promise<ReadableStreamReadResult<Uint8Array>>>()
      .mockResolvedValueOnce({
        done: false,
        value: new Uint8Array(MAX_ENCRYPTED_ENVELOPE_BYTES),
      })
      .mockResolvedValueOnce({ done: false, value: new Uint8Array(1) });
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      headers: new Headers(length === null ? {} : { "content-length": length }),
      body: { getReader: () => ({ read, cancel, releaseLock }) },
    } as unknown as Response);
    const progress = jest.fn();
    await expect(
      fetchEncryptedFile("A7K2Q", undefined, progress),
    ).rejects.toThrow("32 MiB");
    expect(read).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(releaseLock).toHaveBeenCalledTimes(1);
    expect(progress.mock.calls).toEqual([[MAX_ENCRYPTED_ENVELOPE_BYTES]]);
  },
);
it("accepts exactly the bound despite underdeclared content-length", async () => {
  const bytes = new Uint8Array(MAX_ENCRYPTED_ENVELOPE_BYTES);
  bytes[bytes.length - 1] = 42;
  global.fetch = jest
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(bytes, { headers: { "content-length": "1" } }),
    );
  const result = await fetchEncryptedFile("A7K2Q");
  expect(result.byteLength).toBe(MAX_ENCRYPTED_ENVELOPE_BYTES);
  expect(new Uint8Array(result).at(-1)).toBe(42);
});
it("releases the reader when an aborted body read rejects", async () => {
  const releaseLock = jest.fn();
  const aborted = new DOMException("Cancelled", "AbortError");
  const read = jest
    .fn<() => Promise<ReadableStreamReadResult<Uint8Array>>>()
    .mockRejectedValue(aborted);
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
    ok: true,
    headers: new Headers(),
    body: { getReader: () => ({ read, releaseLock }) },
  } as unknown as Response);
  const controller = new AbortController();
  controller.abort();
  await expect(fetchEncryptedFile("A7K2Q", controller.signal)).rejects.toBe(
    aborted,
  );
  expect(releaseLock).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith(
    "/A7K2Q",
    expect.objectContaining({ signal: controller.signal }),
  );
});
const original = global.fetch;
afterEach(() => {
  global.fetch = original;
});
it("fetches only the raw ID route with no key, referrer, or credentials", async () => {
  const fetch = jest
    .fn<typeof global.fetch>()
    .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  global.fetch = fetch;
  expect(new Uint8Array(await fetchEncryptedFile("A7K2Q"))).toEqual(
    new Uint8Array([1, 2, 3]),
  );
  expect(fetch).toHaveBeenCalledWith(
    "/A7K2Q",
    expect.objectContaining({
      referrerPolicy: "no-referrer",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
    }),
  );
});
it("explains unavailable links and bounds received ciphertext", async () => {
  global.fetch = jest
    .fn<typeof global.fetch>()
    .mockResolvedValue(new Response(null, { status: 404 }));
  await expect(fetchEncryptedFile("A7K2Q")).rejects.toThrow(
    /expired|download limit/,
  );
  global.fetch = jest
    .fn<typeof global.fetch>()
    .mockResolvedValue(
      new Response("", { headers: { "content-length": "999999999" } }),
    );
  await expect(fetchEncryptedFile("A7K2Q")).rejects.toThrow(/32 MiB/);
});
