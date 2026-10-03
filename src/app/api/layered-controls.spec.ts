import { expect, test } from "@playwright/test";

test("real server rejects invalid controls, atomically admits one body and enforces expiry", async ({
  request,
}) => {
  const file = {
    name: "limits.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("limit bytes"),
  };
  const invalidControls: Record<string, string>[] = [
    { maxDownloads: "1.5" },
    { maxDownloads: "11" },
    { encrypted: "sometimes" },
    { expiresInSeconds: "86401" },
  ];
  for (const options of invalidControls) {
    const invalid = await request.post("/api/upload", {
      multipart: { file, ...options },
    });
    expect(invalid.status()).toBe(400);
  }
  const created = await request.post("/api/upload", {
    multipart: { file, maxDownloads: "1", expiresInSeconds: "3600" },
  });
  expect(created.status()).toBe(201);
  const { upload } = await created.json();
  expect((await request.head(upload.shareUrl)).status()).toBe(200);
  expect((await request.head(upload.shareUrl)).status()).toBe(200);
  expect(
    (
      await request.get(upload.shareUrl, { headers: { Range: "bytes=1000-" } })
    ).status(),
  ).toBe(416);
  const requests = await Promise.all([
    request.get(upload.shareUrl, { headers: { Range: "bytes=0-1" } }),
    request.get(upload.shareUrl, {
      headers: { "If-None-Match": "invented-cache-tag" },
    }),
  ]);
  const accepted = requests.filter((response) =>
    [200, 206].includes(response.status()),
  );
  expect(accepted).toHaveLength(1);
  expect(requests.filter((response) => response.status() === 404)).toHaveLength(
    1,
  );
  expect((await request.get(upload.shareUrl)).status()).toBe(404);
  expect((await request.head(upload.shareUrl)).status()).toBe(404);
  const expiring = await request.post("/api/upload", {
    multipart: { file, expiresInSeconds: "1" },
  });
  expect(expiring.status()).toBe(201);
  const expires = (await expiring.json()).upload.shareUrl;
  await expect
    .poll(async () => (await request.get(expires)).status(), { timeout: 5000 })
    .toBe(404);
});
