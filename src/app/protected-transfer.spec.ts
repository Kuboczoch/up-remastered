import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { createServer, request as httpRequest } from "node:http";

async function protectedUpload(page: Page, limit = "1", origin = "/") {
  await page.goto(origin);
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
  await page.getByRole("button", { name: /Advanced options/ }).click();
  await page.getByRole("switch", { name: "Save history" }).check();
  await page.getByRole("switch", { name: "Key protect" }).check();
  await page.getByLabel("Expires after").selectOption("1");
  await page.locator("#download-limit").fill(limit);
  await page.getByRole("button", { name: "Close advanced options" }).click();
  await page.locator("#file-picker").setInputFiles({
    buffer: Buffer.from("private original\u0000binary\u00ff"),
    name: "private-original.txt",
    mimeType: "text/plain",
  });
  await expect(
    page.getByRole("heading", { name: "private-original.txt" }).first(),
  ).toBeVisible();
  return new URL(await page.locator("#share-url").inputValue());
}
function metadata(url: URL) {
  const db = new DatabaseSync(fileURLToPath(process.env.DATABASE_URL!));
  try {
    return db
      .prepare(
        "SELECT *, original_name AS originalName, mime_type AS mimeType, storage_path AS storagePath, max_downloads AS maxDownloads FROM upload_metadata WHERE id = ?",
      )
      .get(url.pathname.split("/").at(-1)!)!;
  } finally {
    db.close();
  }
}

test("real protected upload roundtrip, fragment privacy, consent and one-download limit", async ({
  page,
  context,
  request,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const traffic: string[] = [];
  const multipart: Buffer[] = [];
  const rawFetches: string[] = [];
  // A byte-preserving proxy observes real browser multipart bytes (Playwright
  // omits binary multipart parts from Request.postDataBuffer).
  const upstream = new URL(process.env.UP_PUBLIC_ORIGIN!);
  const proxy = createServer((incoming, outgoing) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      if (incoming.url === "/api/upload") multipart.push(Buffer.concat(chunks));
    });
    const forwarded = httpRequest(
      new URL(incoming.url!, upstream),
      {
        method: incoming.method,
        headers: { ...incoming.headers, host: upstream.host },
      },
      (response) => {
        outgoing.writeHead(response.statusCode!, response.headers);
        response.pipe(outgoing);
      },
    );
    forwarded.on("error", () => {
      outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(forwarded);
  });
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  const address = proxy.address() as { port: number };
  try {
    page.on("request", (r) => {
      traffic.push(
        r.url() + JSON.stringify(r.headers()) + (r.postData() ?? ""),
      );
    });
    const url = await protectedUpload(
      page,
      "1",
      `http://127.0.0.1:${address.port}`,
    );
    const link = url.toString();
    const key = url.hash.slice(5);
    expect(url.pathname).toMatch(/^\/decrypt\/[A-Za-z0-9]+$/);
    expect(url.hash).toMatch(/^#key=[A-Za-z0-9_-]{43}$/);
    expect(multipart).toHaveLength(1);
    for (const forbidden of [
      key,
      "private original",
      "private-original.txt",
      "text/plain",
    ])
      expect(multipart[0].includes(Buffer.from(forbidden))).toBe(false);
    for (const storage of ["localStorage", "sessionStorage"] as const)
      expect(
        await page.evaluate((s) => JSON.stringify(window[s]), storage),
      ).not.toContain(key);
    await expect(page.getByText("Key not saved")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open file", exact: true }),
    ).toHaveAttribute("href", link);
    await expect(
      page.getByRole("link", { name: "Download file", exact: true }),
    ).toHaveAttribute("href", link);
    await page
      .getByRole("button", { name: "Copy URL", exact: true })
      .first()
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      link,
    );
    await page.getByRole("button", { name: "Show QR code" }).click();
    const qr = await QRCode.toString(link, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
    });
    const expectedPath = /<path stroke="#000000" d="([^"]+)"/.exec(qr)?.[1];
    expect(expectedPath).toBeTruthy();
    await expect(
      page.getByRole("dialog").locator('svg path[stroke="#000000"]'),
    ).toHaveAttribute("d", expectedPath!);
    await page.getByRole("button", { name: "Close QR code" }).click();
    const row = metadata(url);
    expect(row.originalName).toBe("encrypted.up");
    expect(row.mimeType).toBe("application/octet-stream");
    expect(row.maxDownloads).toBe(1);
    expect(JSON.stringify(row)).not.toContain(key);
    expect(JSON.stringify(row)).not.toContain("private-original.txt");
    const stored = await readFile(row.storagePath as string);
    for (const forbidden of [
      key,
      "private original",
      "private-original.txt",
      "text/plain",
    ])
      expect(stored.includes(Buffer.from(forbidden))).toBe(false);
    const rawPath = url.pathname.replace("/decrypt", "");
    expect((await request.head(rawPath)).status()).toBe(200);
    expect(
      (
        await request.get(rawPath, { headers: { range: "bytes=999999-" } })
      ).status(),
    ).toBe(416);
    page.on("request", (r) => {
      if (new URL(r.url()).pathname === rawPath) rawFetches.push(r.url());
    });
    await page.goto(link);
    await page.getByLabel("Decryption key").fill("A".repeat(43));
    await page.getByRole("button", { name: "Decrypt file" }).click();
    await expect(
      page.locator(".decrypt-experience [role=alert]"),
    ).toContainText(/key|damaged|authentication/i);
    await expect(
      page.getByRole("link", { name: "Save decrypted file" }),
    ).toBeHidden();
    await page.getByLabel("Decryption key").fill(key);
    await page.getByRole("button", { name: "Decrypt file" }).click();
    await expect(
      page.getByRole("link", { name: "Save decrypted file" }),
    ).toBeVisible();
    const waiting = page.waitForEvent("download");
    await page.getByRole("link", { name: "Save decrypted file" }).click();
    const downloaded = await waiting;
    expect(downloaded.suggestedFilename()).toBe("private-original.txt");
    expect(await readFile((await downloaded.path())!)).toEqual(
      Buffer.from("private original\u0000binary\u00ff"),
    );
    expect(rawFetches).toHaveLength(1);
    expect((await request.get(rawPath)).status()).toBe(404);
    expect(traffic.join("\n")).not.toContain(key);
    for (const fragment of [
      "",
      "#key=invalid",
      `#key=${key}&key=${key}`,
      `#key=${"B".repeat(43)}`,
    ]) {
      await page.goto(url.origin + url.pathname + fragment);
      await expect(page.getByText(/Missing or invalid key/)).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Decrypt file" }),
      ).toBeDisabled();
    }
    expect(rawFetches).toHaveLength(1);
  } finally {
    proxy.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      proxy.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

for (const phase of ["fetch", "crypto"] as const) {
  test(`receiver cancellation during ${phase} permits a subsequent real retry`, async ({
    page,
  }) => {
    const url = await protectedUpload(page, "3");
    await expect(page.locator(".share-note")).toContainText(
      "keys are not saved in this app’s upload history",
    );
    const rawPath = url.pathname.replace("/decrypt", "");
    const rawFetches: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === rawPath)
        rawFetches.push(request.url());
    });
    // Gate a real network response or real Web Crypto result, not replacement
    // ciphertext/plaintext. Cancellation must never offer that first result.
    await page.addInitScript(
      ({ phase, rawPath }) => {
        const state = window as typeof window & {
          receiverEntered: boolean;
          releaseReceiver: () => void;
        };
        state.receiverEntered = false;
        const gate = new Promise<void>((resolve) => {
          state.releaseReceiver = resolve;
        });
        if (phase === "crypto") {
          const original = crypto.subtle.decrypt.bind(crypto.subtle);
          let first = true;
          crypto.subtle.decrypt = async (...args) => {
            const result = await original(...args);
            if (first) {
              first = false;
              state.receiverEntered = true;
              await gate;
            }
            return result;
          };
        } else {
          const original = window.fetch.bind(window);
          let first = true;
          window.fetch = async (...args) => {
            const response = await original(...args);
            if (
              first &&
              new URL(String(args[0]), location.href).pathname === rawPath
            ) {
              first = false;
              state.receiverEntered = true;
              const signal = args[1]?.signal;
              await new Promise<void>((resolve, reject) => {
                const abort = () =>
                  reject(new DOMException("Cancelled", "AbortError"));
                if (signal?.aborted) abort();
                else signal?.addEventListener("abort", abort, { once: true });
                void gate.then(() => {
                  signal?.removeEventListener("abort", abort);
                  resolve();
                });
              });
            }
            return response;
          };
        }
      },
      { phase, rawPath },
    );
    await page.goto(url.toString());
    await page.getByRole("button", { name: "Decrypt file" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { receiverEntered: boolean })
              .receiverEntered,
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Cancel decryption" }).click();
    if (phase === "crypto") {
      await expect(
        page.getByRole("button", { name: "Downloading and decrypting…" }),
      ).toBeDisabled();
      await expect(page.getByLabel("Decryption key")).toBeDisabled();
      await expect(page.getByRole("status")).toContainText(
        "Cancelling decryption",
      );
    }
    await page.evaluate(() =>
      (
        window as typeof window & { releaseReceiver: () => void }
      ).releaseReceiver(),
    );
    await expect(
      page.getByRole("button", { name: "Decrypt file" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("link", { name: "Save decrypted file" }),
    ).toBeHidden();
    await expect(page.locator(".decrypt-experience [role=alert]")).toBeHidden();
    await page.getByRole("button", { name: "Decrypt file" }).click();
    await expect(
      page.getByRole("link", { name: "Save decrypted file" }),
    ).toBeVisible();
    const waiting = page.waitForEvent("download");
    await page.getByRole("link", { name: "Save decrypted file" }).click();
    const downloaded = await waiting;
    expect(downloaded.suggestedFilename()).toBe("private-original.txt");
    expect(await readFile((await downloaded.path())!)).toEqual(
      Buffer.from("private original\u0000binary\u00ff"),
    );
    expect(rawFetches).toHaveLength(phase === "crypto" ? 1 : 2);
  });
}

for (const state of ["corrupt", "expired", "exhausted"] as const) {
  test(`protected receiver handles ${state} without offering a plaintext download`, async ({
    page,
    request,
  }) => {
    const url = await protectedUpload(page);
    const row = metadata(url);
    if (state === "corrupt") {
      const bytes = await readFile(row.storagePath as string);
      bytes[bytes.length - 1] ^= 1;
      await writeFile(row.storagePath as string, bytes);
    } else if (state === "expired") {
      const db = new DatabaseSync(fileURLToPath(process.env.DATABASE_URL!));
      try {
        db.prepare(
          "UPDATE upload_metadata SET expires_at = ? WHERE id = ?",
        ).run(Date.now() - 60000, row.id);
      } finally {
        db.close();
      }
    } else {
      expect(
        (await request.get(url.pathname.replace("/decrypt", ""))).status(),
      ).toBe(200);
    }
    await page.goto(url.toString());
    await page.getByRole("button", { name: "Decrypt file" }).click();
    await expect(
      page.locator(".decrypt-experience [role=alert]"),
    ).toContainText(
      state === "corrupt"
        ? /key|damaged|authentication/i
        : /unavailable|expired|limit/i,
    );
    await expect(
      page.getByRole("link", { name: "Save decrypted file" }),
    ).toBeHidden();
  });
}
