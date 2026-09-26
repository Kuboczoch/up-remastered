import { expect, test } from "@playwright/test";

test("serves public upload limits", async ({ request }) => {
  const response = await request.get("/api/configuration");

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({
    defaultFileLifetime: 3_600_000,
    maxFileLifetime: 86_400_000,
    maxPermanentFileSize: 0,
    maxTemporaryFileSize: 64,
    permanentAllowed: false,
  });
});

test("does not expose upstream's unreachable admin configuration", async ({
  request,
}) => {
  expect((await request.get("/api/admin/config")).status()).toBe(404);
  expect(
    (
      await request.patch("/api/admin/config", {
        data: { maxTemporaryFileSize: 1 },
      })
    ).status(),
  ).toBe(404);
});

test("generates ShareX and shell upload clients for the public origin", async ({
  request,
}) => {
  const shareXResponse = await request.get("/sharex");
  expect(shareXResponse.status()).toBe(200);
  expect(shareXResponse.headers()["content-disposition"]).toContain("up.sxcu");
  await expect(shareXResponse.json()).resolves.toMatchObject({
    FileFormName: "file",
    RequestURL: "http://127.0.0.1:3000/api/upload",
    URL: "http://127.0.0.1:3000/u/$json:key$",
  });

  const shellResponse = await request.get("/sh");
  expect(shellResponse.status()).toBe(200);
  expect(shellResponse.headers()["content-type"]).toContain(
    "text/x-shellscript",
  );
  const script = await shellResponse.text();
  expect(script).toContain("curl --fail-with-body --silent --show-error");
  expect(script).toContain("http://127.0.0.1:3000/api/upload");
  expect(script).toContain("Usage: $0 FILE");
});
