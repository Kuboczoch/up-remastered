/** @jest-environment node */
import { afterEach, describe, expect, it } from "@jest/globals";
import { uploadFile } from "./client-upload";
import { decryptFile } from "./encryption";

class Request {
  static sent: FormData | undefined;
  static instance: Request;
  responseType = "";
  status = 201;
  response = {
    accessToken: "token",
    upload: {
      id: "A7K2Q",
      expiresAt: "2026-01-02",
      originalName: "encrypted.up",
      shareUrl: "https://up.example/decrypt/A7K2Q",
      size: 999,
    },
  };
  listeners = new Map<string, () => void>();
  upload = { addEventListener() {} };
  constructor() {
    Request.instance = this;
  }
  open() {}
  addEventListener(name: string, fn: () => void) {
    this.listeners.set(name, fn);
  }
  abort() {
    this.listeners.get("abort")?.();
  }
  send(form: FormData) {
    Request.sent = form;
    queueMicrotask(() => this.listeners.get("load")?.());
  }
}
const original = global.XMLHttpRequest;
afterEach(() => {
  global.XMLHttpRequest = original;
  Request.sent = undefined;
});
describe("upload options", () => {
  it("sends ciphertext and policies but never the key or original metadata", async () => {
    global.XMLHttpRequest = Request as unknown as typeof XMLHttpRequest;
    const result = await uploadFile(
      new File(["secret"], "private.txt", { type: "text/plain" }),
      () => {},
      { protection: true, expirationHours: 1, maxDownloads: 2 },
    ).promise;
    const form = Request.sent!;
    expect([...form.keys()]).toEqual([
      "expiresInHours",
      "maxDownloads",
      "encrypted",
      "file",
    ]);
    expect(form.get("expiresInHours")).toBe("1");
    expect(form.get("maxDownloads")).toBe("2");
    expect(form.get("encrypted")).toBe("true");
    const file = form.get("file") as File;
    expect(file.name).toBe("encrypted.up");
    expect(file.type).toBe("application/octet-stream");
    const key = new URL(result.shareUrl).hash.slice(5);
    expect(
      await (await decryptFile(await file.arrayBuffer(), key)).text(),
    ).toBe("secret");
    expect(result.originalName).toBe("private.txt");
    expect(result.size).toBe(6);
  });
  it("cancels while reading/encrypting without sending any request", async () => {
    global.XMLHttpRequest = Request as unknown as typeof XMLHttpRequest;
    const file = new File(["secret"], "private.txt");
    const operation = uploadFile(file, () => {}, { protection: true });
    operation.abort();
    await expect(operation.promise).rejects.toMatchObject({
      name: "AbortError",
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(Request.sent).toBeUndefined();
  });
});
