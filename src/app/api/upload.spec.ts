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
  expect(body.upload.shareUrl).toContain(`/api/download/${body.upload.id}`);
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
