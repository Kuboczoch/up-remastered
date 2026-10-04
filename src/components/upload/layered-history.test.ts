import { expect, test } from "@jest/globals";
import type { UploadResult } from "./client-upload";
import { saveUploadHistoryEntry } from "./upload-history";
test("stores every UploadResult field without uploaded binary data", () => {
  const upload: UploadResult = {
    accessToken: "token",
    id: "AAAAA",
    originalName: "private.txt",
    size: 2,
    expiresAt: "2099-01-01T00:00:00Z",
    shareUrl: "https://up.example/AAAAA",
  };
  let serialized = "";
  const storage = {
    getItem: () => null,
    setItem: (_key: string, value: string) => {
      serialized = value;
    },
  };
  const withBinary = { ...upload, blob: new Blob(["not history metadata"]) };
  saveUploadHistoryEntry(storage, withBinary);
  const [saved] = JSON.parse(serialized);
  expect(saved).toMatchObject(upload);
  expect(Object.keys(saved).sort()).toEqual(
    [...Object.keys(upload), "savedAt"].sort(),
  );
});
