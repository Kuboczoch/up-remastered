import "server-only";

import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";

import { getUploadDirectory } from "@/server/config/uploads";

export type PendingUploadFile = {
  storagePath: string;
  storedName: string;
  tempPath: string;
};

function assertPathWithinDirectory(path: string, directory: string): void {
  const resolvedPath = resolve(path);
  const resolvedDirectory = resolve(directory);

  if (
    resolvedPath !== resolvedDirectory &&
    !resolvedPath.startsWith(`${resolvedDirectory}${sep}`)
  ) {
    throw new Error("Resolved upload path must stay inside UPLOAD_DIR.");
  }
}

export function sanitizeOriginalName(originalName: string): string {
  const trimmedName = basename(originalName.replaceAll("\\", "/")).trim();

  if (!trimmedName || trimmedName === "." || trimmedName === "..") {
    return "upload";
  }

  return trimmedName.replaceAll(/[\r\n"]/g, "_");
}

export async function createPendingUploadFile(
  storageKey: string,
): Promise<PendingUploadFile> {
  const uploadDirectory = getUploadDirectory();
  await mkdir(uploadDirectory, { recursive: true });

  const storedName = `${storageKey}.bin`;
  const storagePath = resolve(uploadDirectory, storedName);
  const tempPath = resolve(uploadDirectory, `${storedName}.tmp`);

  assertPathWithinDirectory(storagePath, uploadDirectory);
  assertPathWithinDirectory(tempPath, uploadDirectory);

  return {
    storagePath,
    storedName,
    tempPath,
  };
}

export function createPendingUploadWriteStream(pendingFile: PendingUploadFile) {
  return createWriteStream(pendingFile.tempPath, { flags: "wx" });
}

export async function commitPendingUploadFile(
  pendingFile: PendingUploadFile,
): Promise<void> {
  await rename(pendingFile.tempPath, pendingFile.storagePath);
}

export async function discardPendingUploadFile(
  pendingFile: PendingUploadFile,
): Promise<void> {
  await rm(pendingFile.tempPath, { force: true });
}

export async function deleteStoredUploadFile(
  pendingFile: PendingUploadFile,
): Promise<void> {
  await rm(pendingFile.storagePath, { force: true });
}
