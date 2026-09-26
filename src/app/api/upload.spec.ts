import { expect, test } from "@playwright/test";

test("POST /api/upload accepts multipart files", async ({ request }) => {
  const response = await request.post("/api/upload", {
    multipart: {
      file: {
        buffer: Buffer.from("ok"),
        mimeType: "text/plain",
        name: "ok.txt",
      },
    },
  });

  expect(response.status()).toBe(201);

  const body = (await response.json()) as {
    upload: {
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
  expect(body.upload.shareUrl).toContain(`/${body.upload.id}`);
  expect(body.upload.shareUrl).not.toContain("/api/download/");

  const downloadResponse = await request.get(`/${body.upload.id}`);

  expect(downloadResponse.status()).toBe(200);
  expect(downloadResponse.headers()["content-type"]).toBe("text/plain");
  expect(downloadResponse.headers()["content-length"]).toBe("2");
  expect(downloadResponse.headers()["content-disposition"]).toBe(
    'attachment; filename="ok.txt"',
  );
  expect(await downloadResponse.text()).toBe("ok");

  const headResponse = await request.head(`/${body.upload.id}`);

  expect(headResponse.status()).toBe(200);
  expect(headResponse.headers()["content-length"]).toBe("2");
  expect(await headResponse.body()).toHaveLength(0);
});

test("POST /api/upload rejects files above the e2e upload limit", async ({
  request,
}) => {
  const response = await request.post("/api/upload", {
    multipart: {
      file: {
        buffer: Buffer.alloc(65, "x"),
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
