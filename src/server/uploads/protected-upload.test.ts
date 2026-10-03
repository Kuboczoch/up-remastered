import { afterEach, beforeEach, expect, it } from "@jest/globals";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { encryptFile } from "@/components/upload/encryption";
import { createUpload } from "./create-upload";

let dir: string;
let env: NodeJS.ProcessEnv;
beforeEach(async () => {
  env = { ...process.env };
  dir = await mkdtemp(join(tmpdir(), "up-protected-"));
  Object.assign(process.env, {
    DATABASE_URL: pathToFileURL(join(dir, "db.sqlite")).toString(),
    UPLOAD_DIR: join(dir, "files"),
    UP_PUBLIC_ORIGIN: "https://up.example",
    MAX_UPLOAD_SIZE: "4096",
    MAX_STORED_BYTES: "1048576",
    DEFAULT_EXPIRATION_HOURS: "1",
    MAX_EXPIRATION_HOURS: "24",
  });
});
afterEach(async () => {
  process.env = env;
  await rm(dir, { force: true, recursive: true });
});
function request(file: File, field = "true") {
  const form = new FormData();
  form.set("encrypted", field);
  form.set("file", file);
  return new Request("https://up.example/api/upload", {
    method: "POST",
    body: form,
  });
}
it("accepts real encrypted envelopes and returns a keyless dedicated receiver URL", async () => {
  const { file, key } = await encryptFile(
    new File(["private"], "private.txt", { type: "text/plain" }),
  );
  const result = await createUpload(request(file), () => "ABCDE");
  expect(result).toMatchObject({
    shareUrl: "https://up.example/decrypt/ABCDE",
    originalName: "encrypted.up",
    mimeType: "application/octet-stream",
  });
  expect(JSON.stringify(result)).not.toContain(key);
  expect(
    (await readFile(join(dir, "db.sqlite"))).includes(
      Buffer.from("private.txt"),
    ),
  ).toBe(false);
});
it.each(["false", "1", "", "TRUE"])(
  "rejects unsupported protected flag %j",
  async (field) => {
    const { file } = await encryptFile(new File(["x"], "a.txt"));
    await expect(createUpload(request(file, field))).rejects.toMatchObject({
      status: 400,
      code: "invalid_encrypted_upload",
    });
  },
);
it.each([
  new File([new Uint8Array(160)], "encrypted.up", {
    type: "application/octet-stream",
  }),
  new File(["plaintext"], "encrypted.up", { type: "application/octet-stream" }),
  new File([new Uint8Array(160)], "private.txt", {
    type: "application/octet-stream",
  }),
  new File([new Uint8Array(160)], "encrypted.up", { type: "text/plain" }),
])(
  "rejects fake, undersize, plaintext-named or plaintext-typed envelopes",
  async (file) => {
    await expect(createUpload(request(file))).rejects.toMatchObject({
      status: 400,
      code: "invalid_encrypted_upload",
    });
  },
);
