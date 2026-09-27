import { expect, test } from "@playwright/test";
import { request as httpRequest } from "node:http";
import { brotliDecompressSync, gunzipSync } from "node:zlib";

type RawResponse = {
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
  status: number;
};

function getRawResponse(
  url: URL,
  acceptEncoding: string,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      url,
      { headers: { "accept-encoding": acceptEncoding } },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            body: Buffer.concat(chunks),
            headers: response.headers,
            status: response.statusCode ?? 0,
          });
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

function decompress(body: Buffer, encoding: string): Buffer {
  if (encoding === "gzip") {
    return gunzipSync(body);
  }

  if (encoding === "br") {
    return brotliDecompressSync(body);
  }

  throw new Error(`Unexpected content encoding: ${encoding}`);
}

test("compresses framework HTML in the production server", async ({
  baseURL,
}) => {
  const origin = new URL(baseURL ?? "http://127.0.0.1:3000");
  const frameworkResponses = [
    { content: "Share temporary files and text.", path: "/", status: 200 },
    {
      content: "Page not found",
      path: "/this-route/does-not-exist",
      status: 404,
    },
  ];

  for (const expected of frameworkResponses) {
    const gzipResponse = await getRawResponse(
      new URL(expected.path, origin),
      "gzip",
    );

    expect(gzipResponse.status).toBe(expected.status);
    expect(gzipResponse.headers["content-encoding"]).toBe("gzip");
    expect(gzipResponse.headers.vary).toContain("Accept-Encoding");
    expect(gzipResponse.body.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));
    expect(gunzipSync(gzipResponse.body).toString()).toContain(
      expected.content,
    );
  }

  // Next's Node server may select gzip or Brotli as its implementation evolves.
  const negotiatedResponse = await getRawResponse(origin, "br, gzip");
  const encoding = negotiatedResponse.headers["content-encoding"];

  expect(encoding).toMatch(/^(br|gzip)$/);
  expect(
    decompress(negotiatedResponse.body, String(encoding)).toString(),
  ).toContain("Share temporary files and text.");
});

test("does not grant wildcard cross-origin access", async ({ request }) => {
  for (const path of ["/", "/api/configuration"]) {
    const response = await request.get(path, {
      headers: { origin: "https://untrusted.example" },
    });

    expect(response.headers()["access-control-allow-origin"]).not.toBe("*");
  }
});
