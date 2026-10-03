import { afterEach, describe, expect, it } from "@jest/globals";

import { formatBytes, uploadFile } from "./client-upload";

class FakeXMLHttpRequest {
  static response: unknown;
  static status = 201;
  static sentForm: FormData;

  private listeners = new Map<string, () => void>();
  private progressListener: ((event: ProgressEvent) => void) | undefined;

  response: unknown;
  responseType = "";
  status: number;
  upload = {
    addEventListener: (
      _name: string,
      listener: (event: ProgressEvent) => void,
    ) => {
      this.progressListener = listener;
    },
  };

  constructor() {
    this.response = FakeXMLHttpRequest.response;
    this.status = FakeXMLHttpRequest.status;
  }

  abort() {
    this.listeners.get("abort")?.();
  }

  addEventListener(name: string, listener: () => void) {
    this.listeners.set(name, listener);
  }

  open() {}

  send(body: Document | XMLHttpRequestBodyInit | null) {
    expect(body).toBeInstanceOf(FormData);
    FakeXMLHttpRequest.sentForm = body as FormData;
    this.progressListener?.({
      lengthComputable: true,
      loaded: 5,
      total: 10,
    } as ProgressEvent);
    queueMicrotask(() => this.listeners.get("load")?.());
  }
}

const originalXMLHttpRequest = global.XMLHttpRequest;

afterEach(() => {
  global.XMLHttpRequest = originalXMLHttpRequest;
});

describe("upload client", () => {
  it("reports progress and validates a successful response", async () => {
    FakeXMLHttpRequest.status = 201;
    FakeXMLHttpRequest.response = {
      accessToken: "token",
      upload: {
        expiresAt: "2026-01-02T00:00:00.000Z",
        id: "A7K2Q",
        originalName: "hello.txt",
        shareUrl: "https://up.example/u/A7K2Q",
        size: 5,
      },
    };
    global.XMLHttpRequest =
      FakeXMLHttpRequest as unknown as typeof XMLHttpRequest;
    const progress: number[] = [];

    const operation = uploadFile(
      new File(["hello"], "hello.txt", { type: "text/plain" }),
      (value) => progress.push(value),
      { expirationHours: 6 },
    );

    await expect(operation.promise).resolves.toMatchObject({
      accessToken: "token",
      id: "A7K2Q",
      originalName: "hello.txt",
      size: 5,
    });
    expect(progress).toEqual([50]);
    expect(FakeXMLHttpRequest.sentForm.get("expiresInHours")).toBe("6");
  });

  it("uses sanitized API error messages", async () => {
    FakeXMLHttpRequest.status = 413;
    FakeXMLHttpRequest.response = {
      error: { message: "Upload exceeds the maximum upload size." },
    };
    global.XMLHttpRequest =
      FakeXMLHttpRequest as unknown as typeof XMLHttpRequest;

    const operation = uploadFile(new File(["x"], "large.bin"), () => {});

    await expect(operation.promise).rejects.toThrow(
      "Upload exceeds the maximum upload size.",
    );
  });

  it("formats byte limits for people", () => {
    expect(formatBytes(64)).toBe("64 B");
    expect(formatBytes(1_048_576)).toBe("1 MiB");
  });
});
