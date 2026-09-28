import { readFile } from "node:fs/promises";

import { expect, test, type APIRequestContext } from "@playwright/test";

type UploadedFile = {
  id: string;
  shareUrl: string;
};

async function upload(
  request: APIRequestContext,
  file: { buffer: Buffer; mimeType: string; name: string },
  fields: Record<string, string> = {},
): Promise<UploadedFile> {
  const response = await request.post("/api/upload", {
    multipart: { ...fields, file },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { upload: UploadedFile };
  return body.upload;
}

test("renders inert source and verified raster bytes natively", async ({
  page,
  request,
}) => {
  const source = Buffer.from("#!/bin/sh\nprintf 'safe\\n'\n");
  const sourceUpload = await upload(request, {
    buffer: source,
    mimeType: "application/x-sh",
    name: "example.sh",
  });

  const sourceResponse = await page.goto(sourceUpload.shareUrl);
  expect(sourceResponse?.status()).toBe(200);
  expect(sourceResponse?.headers()["content-type"]).toBe(
    "text/plain; charset=utf-8",
  );
  expect(sourceResponse?.headers()["content-disposition"]).toContain("inline");
  await expect(page.locator("pre")).toHaveText(source.toString());

  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    "base64",
  );
  const imageUpload = await upload(request, {
    buffer: pixel,
    mimeType: "application/octet-stream",
    name: "pixel.bin",
  });

  const imageResponse = await page.goto(imageUpload.shareUrl);
  expect(imageResponse?.status()).toBe(200);
  expect(imageResponse?.headers()["content-type"]).toBe("image/gif");
  expect(imageResponse?.headers()["content-disposition"]).toContain("inline");
  await expect(page.locator("img")).toBeVisible();
  expect(
    await page.locator("img").evaluate((image: HTMLImageElement) => ({
      height: image.naturalHeight,
      width: image.naturalWidth,
    })),
  ).toEqual({ height: 1, width: 1 });
});

test("downloads active content even when named as an image", async ({
  page,
  request,
}) => {
  const activeContent = Buffer.from("<html><script>alert(1)</script></html>");
  const uploadResult = await upload(request, {
    buffer: activeContent,
    mimeType: "image/png",
    name: "renamed.png",
  });
  await page.goto("/");

  const downloadPromise = page.waitForEvent("download");
  await page.evaluate((url) => {
    const link = document.createElement("a");
    link.href = url;
    document.body.append(link);
    link.click();
  }, uploadResult.shareUrl);
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("renamed.png");
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(await readFile(path!)).toEqual(activeContent);
});

test("preserves media ranges, HEAD, and forced downloads", async ({
  request,
}) => {
  const media = [
    {
      bytes: Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n"),
      contentType: "application/pdf",
      name: "document.pdf",
    },
    {
      bytes: Buffer.from([0xff, 0xfb, 0x90, 0x64, 0, 0]),
      contentType: "audio/mpeg",
      name: "sound.mp3",
    },
    {
      bytes: Buffer.concat([
        Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
        Buffer.from("\0\0webm\0", "binary"),
      ]),
      contentType: "video/webm",
      name: "clip.webm",
    },
  ];

  for (const fixture of media) {
    const uploaded = await upload(request, {
      buffer: fixture.bytes,
      mimeType: "application/octet-stream",
      name: fixture.name,
    });
    const head = await request.head(uploaded.shareUrl);
    expect(head.status()).toBe(200);
    expect(head.headers()["content-type"]).toBe(fixture.contentType);
    expect(head.headers()["content-length"]).toBe(
      String(fixture.bytes.byteLength),
    );
    expect(head.headers()["content-disposition"]).toContain("inline");
    expect(await head.body()).toHaveLength(0);

    const range = await request.get(uploaded.shareUrl, {
      headers: { range: "bytes=0-3" },
    });
    expect(range.status()).toBe(206);
    expect(range.headers()["content-range"]).toBe(
      `bytes 0-3/${fixture.bytes.byteLength}`,
    );
    expect(await range.body()).toEqual(fixture.bytes.subarray(0, 4));
  }

  const text = Buffer.from("forced download\n");
  const uploaded = await upload(request, {
    buffer: text,
    mimeType: "text/plain",
    name: "forced.txt",
  });
  const forced = await request.get(`${uploaded.shareUrl}?download=1`);
  expect(forced.status()).toBe(200);
  expect(forced.headers()["content-type"]).toBe("text/plain; charset=utf-8");
  expect(forced.headers()["content-disposition"]).toContain("attachment");
  expect(await forced.body()).toEqual(text);
});

test("downloads unsupported, active, and ambiguous content", async ({
  request,
}) => {
  const unsafe = [
    {
      bytes: Buffer.from([0, 1, 2, 3, 4]),
      declaredType: "application/octet-stream",
      name: "unknown.bin",
    },
    {
      bytes: Buffer.from("<!doctype html><script>alert(1)</script>"),
      declaredType: "image/png",
      name: "renamed.png",
    },
    {
      bytes: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>',
      ),
      declaredType: "image/svg+xml",
      name: "scripted.svg",
    },
    {
      bytes: Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.from("<script>alert(1)</script>"),
        Buffer.from([0xff, 0xd9]),
      ]),
      declaredType: "image/jpeg",
      name: "polyglot.jpg",
    },
  ];

  for (const fixture of unsafe) {
    const uploaded = await upload(request, {
      buffer: fixture.bytes,
      mimeType: fixture.declaredType,
      name: fixture.name,
    });
    const response = await request.get(uploaded.shareUrl);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/octet-stream");
    expect(response.headers()["content-disposition"]).toContain("attachment");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(await response.body()).toEqual(fixture.bytes);
  }
});

test("keeps expired files unavailable", async ({ page, request }) => {
  const uploaded = await upload(
    request,
    {
      buffer: Buffer.from("short lived\n"),
      mimeType: "text/plain",
      name: "expired.txt",
    },
    { expiresInSeconds: "1" },
  );

  await page.waitForTimeout(1_100);
  const response = await request.get(uploaded.shareUrl);
  expect(response.status()).toBe(404);
  expect(response.headers()["content-disposition"]).toBeUndefined();
  expect(await response.text()).toBe("File unavailable.\n");
});
