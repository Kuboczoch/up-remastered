/** @jest-environment node */
import { afterEach, expect, it, jest } from "@jest/globals";
import { fetchEncryptedFile } from "./fetch-encrypted-file";
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
