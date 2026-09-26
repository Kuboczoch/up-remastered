import { afterEach, describe, expect, it } from "@jest/globals";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import {
  createPublicUploadConfiguration,
  createShareXConfiguration,
  createShellUploadScript,
} from "./upload-utilities";

const execFileAsync = promisify(execFile);
let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { force: true, recursive: true });
  tempDir = undefined;
});

describe("upload utilities", () => {
  it("maps validated limits to the upstream public shape", () => {
    expect(
      createPublicUploadConfiguration({
        defaultExpirationMs: 3_600_000,
        maxExpirationMs: 86_400_000,
        maxUploadBytes: 1024,
      }),
    ).toEqual({
      defaultFileLifetime: 3_600_000,
      maxFileLifetime: 86_400_000,
      maxPermanentFileSize: 0,
      maxTemporaryFileSize: 1024,
      permanentAllowed: false,
    });
  });

  it("generates upstream-compatible ShareX configuration", () => {
    expect(createShareXConfiguration("https://up.example.test")).toEqual({
      Body: "MultipartFormData",
      DestinationType: "ImageUploader, TextUploader, FileUploader",
      FileFormName: "file",
      Name: "UP file hosting",
      RequestMethod: "POST",
      RequestURL: "https://up.example.test/api/upload",
      URL: "https://up.example.test/u/$json:key$",
      Version: "13.1.0",
    });
  });

  it("generates a valid executable shell helper with safe failure handling", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "up-shell-"));
    const scriptPath = join(tempDir, "upload.sh");
    const curlPath = join(tempDir, "curl");
    const uploadPath = join(tempDir, "file with spaces.txt");
    await writeFile(
      scriptPath,
      createShellUploadScript("https://up.example.test"),
    );
    await writeFile(curlPath, '#!/bin/sh\nprintf \'{"key":"A1b2C"}\'\n');
    await writeFile(uploadPath, "content");
    await chmod(curlPath, 0o755);

    await expect(
      execFileAsync("/bin/sh", ["-n", scriptPath]),
    ).resolves.toBeDefined();
    const result = await execFileAsync("/bin/sh", [scriptPath, uploadPath], {
      env: { ...process.env, PATH: `${tempDir}:${process.env.PATH}` },
    });

    expect(result.stdout).toBe("https://up.example.test/u/A1b2C\n");
    expect(createShellUploadScript("https://up.example.test")).toContain(
      "curl --fail-with-body --silent --show-error",
    );
  });
});
