import "server-only";

import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

import { getUploadDirectory } from "@/server/config/uploads";

export type PendingUploadFile = {
  storagePath?: string;
  storedName?: string;
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

  const sanitizedName = trimmedName
    .replaceAll(/[^0-9A-Za-z._ -]/g, "_")
    .replaceAll(/^\.+/g, "_");

  return sanitizedName || "upload";
}

export async function createPendingUploadFile(): Promise<PendingUploadFile> {
  const uploadDirectory = getUploadDirectory();
  await mkdir(uploadDirectory, { recursive: true });

  const tempPath = resolve(uploadDirectory, `.upload-${randomUUID()}.tmp`);
  assertPathWithinDirectory(tempPath, uploadDirectory);

  return {
    tempPath,
  };
}

export function assignPendingUploadId(
  pendingFile: PendingUploadFile,
  uploadId: string,
): void {
  const uploadDirectory = getUploadDirectory();
  const storedName = `${uploadId}.bin`;
  const storagePath = resolve(uploadDirectory, storedName);

  assertPathWithinDirectory(storagePath, uploadDirectory);

  pendingFile.storagePath = storagePath;
  pendingFile.storedName = storedName;
}

function assertAssignedUploadFile(
  pendingFile: PendingUploadFile,
): asserts pendingFile is PendingUploadFile & {
  storagePath: string;
  storedName: string;
} {
  if (!pendingFile.storagePath || !pendingFile.storedName) {
    throw new Error("Pending upload file must have an assigned upload ID.");
  }
}

export function createPendingUploadWriteStream(pendingFile: PendingUploadFile) {
  return createWriteStream(pendingFile.tempPath, { flags: "wx" });
}

export async function commitPendingUploadFile(
  pendingFile: PendingUploadFile,
): Promise<void> {
  assertAssignedUploadFile(pendingFile);
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
  assertAssignedUploadFile(pendingFile);
  await rm(pendingFile.storagePath, { force: true });
}
