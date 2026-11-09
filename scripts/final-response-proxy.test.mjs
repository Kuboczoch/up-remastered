import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { test } from "node:test";
import {
  createFinalResponseProxy,
  mergeVary,
} from "./final-response-proxy.mjs";

async function fixture(t, handler) {
  const upstream = http.createServer(handler);
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const proxy = createFinalResponseProxy(upstream.address().port);
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  t.after(() => {
    proxy.closeAllConnections();
    upstream.closeAllConnections();
    proxy.close();
    upstream.close();
  });
  return proxy.address().port;
}
function request(port, options = {}, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, ...options },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

test("Vary union preserves framework spelling, case-insensitive duplicates and wildcard", () => {
  assert.equal(
    mergeVary("rsc, Next-URL, cookie", ["Cookie", "Accept-Language"]),
    "rsc, Next-URL, cookie, Accept-Language",
  );
  assert.equal(mergeVary("*", ["Cookie"]), "*");
});
for (const type of ["text/html; charset=utf-8", "text/x-component"]) {
  test(`final ${type} preserves all framework tokens and cookie fields`, async (t) => {
    const vary =
      "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding";
    const port = await fixture(t, (_req, res) => {
      res.writeHead(200, {
        "Content-Type": type,
        Vary: vary,
        "Set-Cookie": ["a=1", "b=2"],
      });
      res.end("representation");
    });
    const result = await request(port);
    assert.equal(result.headers.vary, `${vary}, Accept-Language, Cookie`);
    assert.deepEqual(result.headers["set-cookie"], ["a=1", "b=2"]);
    assert.equal(result.body.toString(), "representation");
  });
}
test("locale header decodes saved preferences like Next without changing upstream cookies", async (t) => {
  const port = await fixture(t, (req, res) => {
    assert.match(req.headers.cookie, /^up-locale=/);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("representation");
  });
  for (const [cookie, expected] of [
    ["up-locale=%70%6c", "pl"],
    ["up-locale=%", "en"],
    ["up-locale=en; up-locale=%70%6c", "pl"],
    ["up-locale=pl; up-locale=%", "pl"],
  ]) {
    const result = await request(port, {
      path: "/",
      headers: { Cookie: cookie, "Accept-Language": "en" },
    });
    assert.equal(result.headers["content-language"], expected);
  }
});

test("raw range, HEAD, filenames, validators and cache contracts remain unchanged", async (t) => {
  const port = await fixture(t, (req, res) => {
    assert.equal(req.headers.range, "bytes=1-3");
    res.writeHead(206, {
      "Content-Type": "application/octet-stream",
      "Content-Range": "bytes 1-3/5",
      "Content-Length": "3",
      "Content-Disposition": 'attachment; filename="raw.txt"',
      ETag: '"same"',
      Vary: "Accept",
      "Cache-Control": "private, no-store",
    });
    res.end(Buffer.from([0, 255, 128]));
  });
  for (const method of ["GET", "HEAD"]) {
    const result = await request(port, {
      method,
      headers: { Range: "bytes=1-3" },
    });
    assert.equal(result.status, 206);
    assert.equal(result.headers.vary, "Accept");
    assert.equal(result.headers["content-range"], "bytes 1-3/5");
    assert.equal(result.headers["content-length"], "3");
    assert.equal(
      result.headers["content-disposition"],
      'attachment; filename="raw.txt"',
    );
    assert.equal(result.headers.etag, '"same"');
    assert.equal(result.headers["cache-control"], "private, no-store");
    assert.deepEqual(
      result.body,
      method === "HEAD" ? Buffer.alloc(0) : Buffer.from([0, 255, 128]),
    );
  }
});
test("health/API status and machine body pass through unchanged", async (t) => {
  const port = await fixture(t, (req, res) => {
    assert.equal(req.url, "/api/health?probe=1");
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end('{"code":"UNAVAILABLE"}');
  });
  const result = await request(port, { path: "/api/health?probe=1" });
  assert.equal(result.status, 503);
  assert.equal(result.headers.vary, undefined);
  assert.equal(result.body.toString(), '{"code":"UNAVAILABLE"}');
});
test(
  "upload streams before completion and preserves Host, authorization, cookie and bytes",
  { timeout: 5000 },
  async (t) => {
    let first;
    const arrived = new Promise((resolve) => {
      first = resolve;
    });
    const port = await fixture(t, (req, res) => {
      assert.equal(req.headers.host, "public.example");
      assert.equal(req.headers.authorization, "Bearer test-capability");
      assert.equal(req.headers.cookie, "up_locale=pl");
      const chunks = [];
      req.on("data", (chunk) => {
        chunks.push(chunk);
        first();
      });
      req.on("end", () => res.end(Buffer.concat(chunks)));
    });
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      method: "POST",
      headers: {
        Host: "public.example",
        Authorization: "Bearer test-capability",
        Cookie: "up_locale=pl",
      },
    });
    const result = new Promise((resolve) =>
      req.on("response", (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }),
    );
    req.write(Buffer.from([0, 255]));
    await arrived;
    req.end(Buffer.from([128]));
    assert.deepEqual(await result, Buffer.from([0, 255, 128]));
  },
);
test(
  "cancelled upload aborts backend rather than buffering/retrying",
  { timeout: 5000 },
  async (t) => {
    let first, aborted;
    const arrived = new Promise((resolve) => {
      first = resolve;
    });
    const cancelled = new Promise((resolve) => {
      aborted = resolve;
    });
    const port = await fixture(t, (req) => {
      req.once("data", first);
      req.once("aborted", aborted);
    });
    const req = http.request({ hostname: "127.0.0.1", port, method: "POST" });
    req.on("error", () => {});
    req.write("partial");
    await arrived;
    req.destroy();
    await cancelled;
  },
);
test(
  "download and SSE stream immediately; downstream cancellation closes backend",
  { timeout: 5000 },
  async (t) => {
    let closed;
    const cancelled = new Promise((resolve) => {
      closed = resolve;
    });
    const port = await fixture(t, (_req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      });
      res.write("data: first\n\n");
      res.once("close", closed);
    });
    const req = http.get({ hostname: "127.0.0.1", port }, (res) => {
      assert.equal(res.headers.vary, undefined);
      res.once("data", (chunk) => {
        assert.equal(chunk.toString(), "data: first\n\n");
        res.destroy();
      });
    });
    req.on("error", () => {});
    await cancelled;
  },
);
test("hop-by-hop nominated headers are stripped in both directions", async (t) => {
  const port = await fixture(t, (req, res) => {
    assert.equal(req.headers["x-private-hop"], undefined);
    res.writeHead(200, {
      Connection: "x-private-hop",
      "X-Private-Hop": "secret",
    });
    res.end("ok");
  });
  const result = await request(port, {
    headers: { Connection: "x-private-hop", "X-Private-Hop": "secret" },
  });
  assert.equal(result.headers["x-private-hop"], undefined);
});
