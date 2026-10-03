import { expect, test } from "@playwright/test";

test("POST /api/upload accepts multipart files", async ({ request }) => {
  const response = await request.post("/api/upload", {
    multipart: {
      client: "upstream-compatible",
      file: {
        buffer: Buffer.from("ok"),
        mimeType: "text/plain",
        name: "ok.txt",
      },
    },
  });

  expect(response.status()).toBe(201);

  const body = (await response.json()) as {
    accessToken: string;
    key: string;
    toDelete: string;
    upload: {
      accessToken: string;
      expiresAt: string;
      id: string;
      originalName: string;
      shareUrl: string;
      size: number;
    };
  };

  expect(body.upload).toMatchObject({
    originalName: "ok.txt",
    size: 2,
  });
  expect(body.upload.id).toMatch(/^[0-9A-Z]{5}$/);
  expect(body.accessToken).toMatch(/^[a-f0-9]{128}$/);
  expect(body.key).toBe(body.upload.id);
  expect(body.toDelete).toBe(body.upload.expiresAt);
  expect(body.upload.accessToken).toBe(body.accessToken);
  expect(body.upload.shareUrl).toContain(`/${body.upload.id}`);
  expect(body.upload.shareUrl).not.toContain("/api/download/");

  const downloadResponse = await request.get(`/${body.upload.id}`);

  expect(downloadResponse.status()).toBe(200);
  expect(downloadResponse.headers()["content-type"]).toBe(
    "text/plain; charset=utf-8",
  );
  expect(downloadResponse.headers()["content-length"]).toBe("2");
  expect(downloadResponse.headers()["content-disposition"]).toBe(
    "inline; filename=\"ok.txt\"; filename*=UTF-8''ok.txt",
  );
  expect(await downloadResponse.text()).toBe("ok");

  const headResponse = await request.head(`/${body.upload.id}`);

  expect(headResponse.status()).toBe(200);
  expect(headResponse.headers()["content-length"]).toBe("2");
  expect(await headResponse.body()).toHaveLength(0);

  const rangeResponse = await request.get(`/u/${body.upload.id}`, {
    headers: { range: "bytes=0-0" },
  });
  expect(rangeResponse.status()).toBe(206);
  expect(rangeResponse.headers()["content-range"]).toBe("bytes 0-0/2");
  expect(await rangeResponse.text()).toBe("o");

  const detailsResponse = await request.get(`/api/u/${body.upload.id}/details`);
  expect(detailsResponse.status()).toBe(200);
  await expect(detailsResponse.json()).resolves.toMatchObject({
    key: body.upload.id,
    name: "ok.txt",
    permanent: false,
    size: 2,
    type: "text/plain; charset=utf-8",
  });

  const deniedResponse = await request.post(`/api/u/${body.upload.id}/verify`, {
    data: { accessToken: "wrong" },
  });
  expect(deniedResponse.status()).toBe(403);

  const malformedResponse = await request.post(
    `/api/u/${body.upload.id}/verify`,
    { data: {} },
  );
  expect(malformedResponse.status()).toBe(400);

  const verifyResponse = await request.post(`/api/u/${body.upload.id}/verify`, {
    data: { accessToken: body.accessToken },
  });
  expect(verifyResponse.status()).toBe(200);
  await expect(verifyResponse.json()).resolves.toEqual({
    message: null,
    success: true,
  });

  const deniedDeleteResponse = await request.delete(
    `/api/u/${body.upload.id}`,
    { data: { accessToken: "wrong" } },
  );
  expect(deniedDeleteResponse.status()).toBe(403);
  expect((await request.get(`/u/${body.upload.id}`)).status()).toBe(200);

  const deleteResponse = await request.delete(`/api/u/${body.upload.id}`, {
    data: { accessToken: body.accessToken },
  });
  expect(deleteResponse.status()).toBe(200);
  expect(await deleteResponse.body()).toHaveLength(0);
  expect((await request.get(`/u/${body.upload.id}`)).status()).toBe(404);
});

test("POST /api/upload normalizes malformed multipart requests", async ({
  request,
}) => {
  const response = await request.post("/api/upload", {
    data: "broken",
    headers: { "content-type": "multipart/form-data" },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    error: {
      code: "invalid_multipart",
      message: "Malformed multipart request.",
    },
  });
});

test("POST /api/upload rejects files above the e2e upload limit", async ({
  request,
}) => {
  const response = await request.post("/api/upload", {
    multipart: {
      file: {
        buffer: Buffer.alloc(513, "x"),
        mimeType: "text/plain",
        name: "too-large.txt",
      },
    },
  });

  expect(response.status()).toBe(413);

  const body = (await response.json()) as {
    error: { code: string; message: string };
  };

  expect(body.error).toMatchObject({
    code: "upload_too_large",
    message: "Upload exceeds the maximum upload size.",
  });
});
